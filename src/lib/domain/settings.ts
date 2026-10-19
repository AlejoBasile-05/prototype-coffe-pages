/** DTOs de la configuración del negocio (capa 0 · dominio). */
import { PROTOTYPE_CONFIG } from "@/config/prototype";

/** Día a horario de apertura. `null` = cerrado ese día. */
export type OpeningHours = Readonly<
  Record<string, { readonly opens: string; readonly closes: string } | null>
>;

export interface BusinessSettingsDTO {
  readonly name: string;
  /** E.164 sin `+`. Ej: "5492615551234". */
  readonly whatsappPhone: string;
  readonly address: string | null;
  readonly instagramUrl: string | null;
  readonly openingHours: OpeningHours;
  readonly closingMessage: string | null;
  readonly legalNotice: string | null;
}

/**
 * Los siete días del negocio.
 *
 * ⛔ Viven en el dominio y no en el formulario: son el vocabulario de
 *    `OpeningHours` y de la columna `jsonb`, y tres capas los necesitan
 *    (grilla del panel, normalizador, JSON-LD de la Tarea 18).
 *
 * Las claves van en inglés minúsculo porque son las que se guardan en la
 * base. Los labels se generan con `Intl.DateTimeFormat` a partir del
 * locale del prototipo, así que cambian con la config y no con el código.
 */
export const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/**
 * Locale del prototipo. La config no tiene todavía un campo de idioma
 * propio, así que se reutiliza `currency.locale`: es el único locale de la
 * config y expresa el idioma de la UI.
 */
const LOCALE = PROTOTYPE_CONFIG.currency.locale;

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  timeZone: "UTC",
});

/** 2024-01-01 fue lunes. La semana de referencia arranca ahí y avanza por día. */
const REFERENCE_MONDAY_UTC = Date.UTC(2024, 0, 1, 12);
const DAY_MS = 86_400_000;

/** `Intl` devuelve "martes" en minúscula; la UI los muestra capitalizados. */
const capitalize = (value: string): string =>
  value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);

const weekdayLabel = (dayOffset: number): string =>
  capitalize(WEEKDAY_FORMATTER.format(new Date(REFERENCE_MONDAY_UTC + dayOffset * DAY_MS)));

export const WEEKDAY_LABELS: Readonly<Record<WeekdayKey, string>> = {
  monday: weekdayLabel(0),
  tuesday: weekdayLabel(1),
  wednesday: weekdayLabel(2),
  thursday: weekdayLabel(3),
  friday: weekdayLabel(4),
  saturday: weekdayLabel(5),
  sunday: weekdayLabel(6),
};

/**
 * Un día de la grilla del formulario de ajustes.
 *
 * ⛔ El `""` donde el DTO tiene `null` es a propósito: un
 *    `<input value={null}>` es un input sin controlar.
 */
export interface DayScheduleRow {
  readonly key: WeekdayKey;
  readonly label: string;
  readonly estado: "sin_informar" | "informado" | "cerrado";
  readonly abre: string;
  readonly cierra: string;
}

export type DayScheduleState = DayScheduleRow["estado"];

/**
 * Todo lo que la pantalla de ajustes necesita saber.
 *
 * ⛔ Las claves van en español, como las del payload del formulario
 *    (§5.11), y no como las del DTO. Esta forma es la de la pantalla.
 */
export interface SettingsFormModel {
  readonly nombre: string;
  readonly telefonoWhatsapp: string;
  readonly direccion: string;
  readonly instagram: string;
  readonly mensajeCierre: string;
  readonly avisoLegal: string;
  /** Siempre siete filas, en el orden de `WEEKDAY_KEYS`. */
  readonly dias: readonly DayScheduleRow[];
  /** `false` mientras el teléfono sea el de relleno. La ruta lo muestra. */
  readonly isConfigured: boolean;
}
