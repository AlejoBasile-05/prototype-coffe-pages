/**
 * Proyección de la fila singleton de ajustes a la forma del formulario
 * (Tarea 17 §6.7).
 *
 * ⛔ Sin Zod ni I/O acá: es la traducción entre `BusinessSettingsDTO`
 *    (inglés, null, OpeningHours disperso) y los campos del formulario
 *    (español, strings vacías, siete filas).
 */
import "server-only";

import { WEEKDAY_KEYS, WEEKDAY_LABELS } from "@/lib/domain";
import type {
  BusinessSettingsDTO,
  DayScheduleRow,
  SettingsFormModel,
  WeekdayKey,
} from "@/lib/domain";
import { normalizeArgentinePhone, isSettingsConfigured } from "@/lib/validation/ajustes";
import { camposEditados } from "@/lib/domain/audit-campos";
import type { HorarioInput } from "@/lib/validation/ajustes";
import { updateBusinessSettings } from "@/server/services/settings.service";
import type { AjustesInput } from "@/server/schemas/ajustes.schema";
import type { SettingsWriter } from "@/server/services/repository-ports";

const EMPTY_DAY: HorarioInput = { estado: "sin_informar", abre: "", cierra: "" };

/**
 * Proyección para el formulario. Los `null` del DTO se convierten en
 * `""`: un `<input value={null}>` es un input sin controlar, y React
 * se queja en desarrollo. La conversión inversa la valida la action.
 */
export const getSettingsFormForAdmin = (settings: BusinessSettingsDTO): SettingsFormModel => ({
  nombre: settings.name,
  telefonoWhatsapp: settings.whatsappPhone,
  direccion: settings.address ?? "",
  instagram: settings.instagramUrl ?? "",
  mensajeCierre: settings.closingMessage ?? "",
  avisoLegal: settings.legalNotice ?? "",
  dias: WEEKDAY_KEYS.map((key) => toDayRow(key, settings.openingHours[key])),
  isConfigured: isSettingsConfigured(settings),
});

/**
 * Guarda los ajustes del negocio.
 *
 * ⛔ `normalizeArgentinePhone` se llama primero: si es inválido, el
 *    `ValidationError` ya trae el `fieldErrors` del teléfono pegado al
 *    campo, y la action lo muestra sin haber abierto la base. La
 *    normalización del resto es idempotente: la segunda pasada sobre
 *    `updateBusinessSettings` no cambia el resultado.
 */
export const updateSettingsFromAdmin = async (
  dependencies: { readonly settingsRepository: SettingsWriter },
  input: AjustesInput,
): Promise<BusinessSettingsDTO> => {
  normalizeArgentinePhone(input.telefonoWhatsapp);

  return updateBusinessSettings(
    { settingsRepository: dependencies.settingsRepository },
    {
      name: input.nombre,
      whatsappPhone: input.telefonoWhatsapp,
      address: input.direccion,
      instagramUrl: input.instagram,
      openingHours: toOpeningHours(input.horarios),
      closingMessage: input.mensajeCierre,
      legalNotice: input.avisoLegal,
    },
  );
};

/**
 * De las siete filas de la grilla al `OpeningHours` disperso. La
 * clave se omite cuando el estado es "sin_informar" y queda en `null`
 * cuando es "cerrado": hay que distinguirlos para que el JSON-LD del
 * menú no publique un "cerrado a las 3 de la mañana" en un día que el
 * local no politó (§5.8 y Tarea 18 §5.7).
 */
const toOpeningHours = (
  horarios: Record<string, HorarioInput | undefined>,
): BusinessSettingsDTO["openingHours"] => {
  const result: Record<string, { readonly opens: string; readonly closes: string } | null> = {};

  for (const key of WEEKDAY_KEYS) {
    const horario = horarios[key];
    if (horario === undefined || horario.estado === "sin_informar") continue;
    if (horario.estado === "cerrado") {
      result[key] = null;
      continue;
    }
    result[key] = { opens: horario.abre, closes: horario.cierra };
  }

  return result;
};

const toDayRow = (
  key: WeekdayKey,
  entry: { readonly opens: string; readonly closes: string } | null | undefined,
): DayScheduleRow => {
  if (entry === null) {
    return { key, label: WEEKDAY_LABELS[key], estado: "cerrado", abre: "", cierra: "" };
  }
  if (entry === undefined) {
    return { key, label: WEEKDAY_LABELS[key], ...EMPTY_DAY };
  }
  return {
    key,
    label: WEEKDAY_LABELS[key],
    estado: "informado",
    abre: entry.opens,
    cierra: entry.closes,
  };
};

/**
 * Campos del formulario de ajustes que quedaron distintos de lo que quedó
 * guardado (Tarea 19 §7.1). Es lo que va al log de `ajustes.actualizados`.
 *
 * ⛔ La comparación reutiliza `getSettingsFormForAdmin`: es la MISMA
 *    proyección que ve el formulario, así que el log y la pantalla no
 *    pueden discrepar sobre qué significa "telefonoWhatsapp".
 *
 * ⛔ No hay que podar la proyección para descartar `isConfigured`: la
 *    comparación sólo mira las claves que trae el `input`, y ese campo lo
 *    calcula el servidor y nunca lo manda el cliente.
 */
export const camposEditadosDeAjustes = (
  guardados: BusinessSettingsDTO,
  input: AjustesInput,
): readonly string[] => camposEditados(getSettingsFormForAdmin(guardados), input);
