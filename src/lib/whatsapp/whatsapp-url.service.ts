/**
 * Deep-link de WhatsApp.
 *
 * ⛔ Sin `import "server-only"`: sin I/O, arma un string. Lo mismo lo
 * usa el botón flotante del catálogo (Tarea 10) y la página de éxito
 * (Tarea 13).
 */
import { ValidationError } from "@/lib/domain";
import { isE164Phone, normalizeArgentinePhone, sanitizePhoneDigits } from "@/lib/format/phone";

export const WHATSAPP_BASE_URL = "https://wa.me";

/**
 * Cómo viajan los saltos de línea.
 *
 * `"lf"` envía `\n` como `%0A`, que es lo correcto y funciona en todas
 * las versiones de WhatsApp vigentes.
 *
 * `"crlf"` reemplaza por `%0D%0A`. Es el arreglo para clientes antiguos
 * que pegan todo en una sola línea, y **no** se activa a ciegas: primero
 * hay que VER el problema en un teléfono real (Tarea 12 §9, fila
 * "salto de línea pegado"). La verificación es: pegar la URL en el
 * navegador del teléfono y mirar el draft en el chat. Cambiar el modo
 * es cambiar esta constante y sola.
 */
export type LineBreakMode = "lf" | "crlf";
export const LINE_BREAK_MODE: LineBreakMode = "lf";

/** `wa.me` tolera el `+` y los espacios, pero no los necesita y algunos clientes fallan. */
const toDestination = (phone: string): string => {
  const digits = sanitizePhoneDigits(phone);
  return isE164Phone(digits) ? digits : normalizeArgentinePhone(phone);
};

// Lookup y no comparación: con `mode === "crlf"` TypeScript estrecha la
// constante con literal a "lf" y rechaza la comparación (TS2367). Una
// tabla de estrategias además hace que agregar un modo no toque lógica.
const LINE_BREAK_ENCODERS: Record<LineBreakMode, (encoded: string) => string> = {
  lf: (encoded) => encoded,
  crlf: (encoded) => encoded.replace(/%0A/g, "%0D%0A"),
};

const encodeMessage = (message: string): string =>
  LINE_BREAK_ENCODERS[LINE_BREAK_MODE](encodeURIComponent(message));

/**
 * Arma la URL que abre el chat con el mensaje ya escrito.
 *
 * `encodeURIComponent` no es opcional: sin él, un `&` en la dirección
 * corta el parámetro `text`, un `#` trunca la URL y los acentos rompen
 * el draft.
 */
export const buildWhatsAppUrl = (phone: string, message: string): string => {
  let destination: string;

  try {
    destination = toDestination(phone);
  } catch {
    // Se re-lanza con la clave del campo del panel, no la del cliente.
    throw new ValidationError(
      {
        whatsappPhone: [
          "El número de WhatsApp del local no está bien configurado. Corregilo en Ajustes.",
        ],
      },
      "No se puede abrir WhatsApp",
    );
  }

  if (message.length === 0) {
    throw new ValidationError(
      { message: ["El mensaje está vacío. No hay nada que enviar."] },
      "No se puede abrir WhatsApp",
    );
  }

  return `${WHATSAPP_BASE_URL}/${destination}?text=${encodeMessage(message)}`;
};
