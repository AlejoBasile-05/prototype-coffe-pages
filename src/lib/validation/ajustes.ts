/**
 * Funciones puras de saneado de los ajustes del negocio.
 *
 * ⛔ Movido desde `src/server/services/settings-normalizers.ts` a
 *    `src/lib/validation/ajustes.ts` por la Tarea 17 §2.5: el cliente
 *    del formulario de WhatsApp usa la normalización en vivo, así que
 *    esta capa 0 no puede seguir viviendo en el servidor.
 *
 * ⛔ Sin `import "server-only"` y sin I/O: igual que la versión
 *    original. Los 40 casos de test siguen pasando sin tocar un nombre.
 */
import { z } from "zod";

import { ValidationError } from "@/lib/domain";
import type { BusinessSettingsDTO, OpeningHours, DayScheduleState } from "@/lib/domain";
import { WEEKDAY_KEYS } from "@/lib/domain";
import { normalizeArgentinePhone as normalizePhoneLayer0 } from "@/lib/format/phone";

// ─────────────────────── Constantes de negocio ──────────────────────

/** E.164 argentino con móvil: `54` + `9` + área + número. 12–13 dígitos. */
const PHONE_PATTERN = /^54\d{10,11}$/;

/**
 * Forma del número de relleno de `DEFAULT_BUSINESS_SETTINGS` (Tarea 04):
 * `549261` seguido de solo ceros. Si el resultado normalizado tiene esta
 * forma, el admin todavía no cargó el número real.
 */
const PLACEHOLDER_LOCAL_NUMBER = /^5492610+$/;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// ─────────────────────── Normalizadores puros ──────────────────────

/**
 * Lleva cualquier forma razonable de escribir el teléfono a E.164 sin `+`.
 *
 * La implementación única vive en `@/lib/format/phone` (Tarea 12 §4.3):
 * acá solo se reetiqueta el error de `phone` a `whatsappPhone`. Dos
 * copias divergirían — la Tarea 17 valida el número del local y la 13
 * el del cliente — y un local recibiendo pedidos a un número viejo es
 * el peor bug posible de este sistema.
 */
export const normalizeArgentinePhone = (raw: string): string => {
  try {
    return normalizePhoneLayer0(raw);
  } catch (error) {
    // La versión de Capa 0 reporta con la clave genérica `phone`: no sabe
    // si es el número del negocio o el del cliente. Acá se reetiqueta a
    // `whatsappPhone`, que es el nombre del campo del formulario de
    // ajustes (Tarea 17).
    if (error instanceof ValidationError) {
      const fieldErrors = error.fieldErrors;
      throw new ValidationError(
        { whatsappPhone: fieldErrors.whatsappPhone ?? fieldErrors.phone ?? [] },
        "Teléfono de WhatsApp inválido",
      );
    }
    throw error;
  }
};

/**
 * Sanea la URL de Instagram. Devuelve `null` en lugar de una URL rota:
 * un `javascript:` o un perfil inexistente rompen el pie de página entero.
 */
export const normalizeInstagramUrl = (raw: string | null): string | null => {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.hostname.length === 0) return null;
    return `https://${url.hostname}${url.pathname.replace(/\/+$/, "")}${url.search}`;
  } catch {
    return null;
  }
};

/**
 * Valida la forma de los horarios día por día.
 *
 * El type guard del repositorio (Tarea 04) solo verifica que el jsonb sea
 * un objeto. Un `{ "lunes": { opens, closes } }` pasa ese filtro y
 * revienta la grilla de horarios de la UI. Esta función es la segunda
 * barrera.
 *
 * Reglas:
 *  · Solo se conservan las siete claves canónicas en inglés minúscula.
 *  · Un día con valor `null` se conserva: significa "cerrado".
 *  · Un día ausente NO se completa: ausente es "no informado" y la UI lo
 *    muestra como `—`. Ponerlo "cerrado" sería mentir.
 *  · `HH:MM` en 24 h, con cero a la izquierda.
 *  · No se valida que el cierre sea posterior a la apertura: un local que
 *    cierra de madrugada es un caso válido.
 */
export const normalizeOpeningHours = (raw: unknown): OpeningHours => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const result: Record<string, { readonly opens: string; readonly closes: string } | null> = {};

  for (const day of WEEKDAY_KEYS) {
    if (!(day in source)) continue;

    const entry = source[day];
    if (entry === null) {
      result[day] = null;
      continue;
    }
    if (typeof entry !== "object" || Array.isArray(entry)) continue;

    const { opens, closes } = entry as { readonly opens?: unknown; readonly closes?: unknown };
    if (typeof opens !== "string" || typeof closes !== "string") continue;
    if (!TIME_PATTERN.test(opens) || !TIME_PATTERN.test(closes)) continue;

    result[day] = { opens, closes };
  }

  return result;
};

/** El negocio todavía no cargó sus datos y el teléfono es el de relleno. */
export const isSettingsConfigured = (settings: BusinessSettingsDTO): boolean =>
  PHONE_PATTERN.test(settings.whatsappPhone) &&
  !PLACEHOLDER_LOCAL_NUMBER.test(settings.whatsappPhone);

/** Aplica el mismo saneado a la lectura y a la escritura. Sin I/O. */
export const normalizeBusinessSettings = (stored: BusinessSettingsDTO): BusinessSettingsDTO => ({
  ...stored,
  name: stored.name.trim(),
  openingHours: normalizeOpeningHours(stored.openingHours),
  instagramUrl: normalizeInstagramUrl(stored.instagramUrl),
  address: stored.address === null ? null : stored.address.trim() || null,
  closingMessage: stored.closingMessage === null ? null : stored.closingMessage.trim() || null,
  legalNotice: stored.legalNotice === null ? null : stored.legalNotice.trim() || null,
});

// ─────────────────────── El Zod del día (cliente) ────────────────────

/**
 * Horario de un día, tal como viaja dentro del formulario (Tarea 17 §5.10).
 *
 * El doc dice que esta forma vive acá porque el fieldset la usa para
 * validar mientras se tipea, y el `AjustesSchema` del servidor la importa
 * de vuelta. Es la única Zod del formulario que sale de
 * `src/server/schemas/`: la regla de §2.5 dice que el Zod que el cliente
 * consume va a `src/lib/validation`.
 */
export const HorarioInputSchema = z
  .object({
    estado: z.enum(["sin_informar", "informado", "cerrado"]),
    // Sin `optional`: el valor por defecto es `""`. Un string vacío
    // es la ausencia en el formulario y `TIME_PATTERN` es la única
    // forma válida de hora en un día "informado" (§5.7).
    abre: z.string().max(5).default(""),
    cierra: z.string().max(5).default(""),
  })
  .superRefine((horario, contexto) => {
    // "Informado" sin horas es imposible: un select en ese estado quedó
    // vacío. Un "cerrado" con basura igual pasa, porque no se usa (§5.7).
    if (horario.estado !== "informado") return;

    if (!TIME_PATTERN.test(horario.abre)) {
      contexto.addIssue({
        code: "custom",
        message: "Formato de 24 horas (ej: 09:00).",
        path: ["abre"],
      });
    }
    if (!TIME_PATTERN.test(horario.cierra)) {
      contexto.addIssue({
        code: "custom",
        message: "Formato de 24 horas (ej: 21:00).",
        path: ["cierra"],
      });
    }
  });

export interface HorarioInput {
  readonly estado: DayScheduleState;
  readonly abre: string;
  readonly cierra: string;
}
