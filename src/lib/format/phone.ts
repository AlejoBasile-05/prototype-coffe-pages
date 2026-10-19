/**
 * Normalización de teléfonos. Capa 0: función pura, sin `import
 * "server-only"`: la usa el cliente (Tarea 13) y el panel admin
 * (Tarea 17), y se testea en `environment: "node"` sin mocks.
 *
 * El prefijo internacional sale de `PROTOTYPE_CONFIG.location.phoneCountryCode`
 * (por defecto `"54"`, Argentina). Las reglas de "9 móvil" son específicas
 * de WhatsApp en Argentina: se aplican solo cuando el código de país es
 * `"54"`. El resto de las reglas (sacar el `00`, reemplazar el `0` local,
 * sacar el `0` después del prefijo) sí son genéricas.
 *
 * ⛔ Este módulo es la ÚNICA implementación de `normalizeArgentinePhone`
 * del proyecto (Tarea 12 §4.3). `settings-normalizers.ts` la importa y
 * reetiqueta el error; no la reimplementa.
 */
import { PROTOTYPE_CONFIG } from "@/config/prototype";

import { ValidationError } from "@/lib/domain";

/** Prefijo internacional por defecto. Sin `+`, como exige `wa.me`. */
const COUNTRY_CODE = PROTOTYPE_CONFIG.location.phoneCountryCode;

/** WhatsApp en Argentina usa el `9` móvil. Solo aplica a ese país. */
const ARGENTINA_COUNTRY_CODE = "54";

/** E.164 admite 10 u 11 dígitos después del prefijo. Nada más. */
const e164PatternCache = new Map<string, RegExp>();
const e164Pattern = (countryCode: string): RegExp => {
  const cached = e164PatternCache.get(countryCode);
  if (cached) return cached;
  const pattern = new RegExp(`^${countryCode}\\d{10,11}$`);
  e164PatternCache.set(countryCode, pattern);
  return pattern;
};

/** Un teléfono escrito a mano nunca pasa de esto. Corta entradas absurdas antes de procesarlas. */
const MAX_INPUT_LENGTH = 32;

/** Caracteres de control y de control bidireccional. Se eliminan de toda entrada. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

/**
 * Teléfono en E.164 sin `+`, listo para `wa.me`.
 *
 * El branding no es decorativo: obliga a que quien arma una URL pase por
 * `normalizeArgentinePhone` o por el type guard. Un `string` suelto se
 * confunde con un teléfono ya normalizado y termina en un enlace roto.
 */
export type E164Phone = string & { readonly __brand: "E164Phone" };

/**
 * Se queda solo con los dígitos.
 *
 * ⛔ No aplica reglas de país: quitar el `00` internacional o agregar el
 * prefijo es responsabilidad de `normalizeArgentinePhone`. Esta función
 * responde una sola pregunta —"qué queda si borro todo lo que no es un
 * número"— y por eso sirve también para limpiar el teléfono del cliente
 * antes de guardarlo en `sessionStorage`.
 */
export const sanitizePhoneDigits = (raw: string): string =>
  raw.replace(CONTROL_CHARS, "").replace(BIDI_CONTROLS, "").replace(/\D/g, "");

/**
 * Type guard de E.164.
 *
 * ⛔ Capa 0 no puede usar `as`: el único `as` permitido en el proyecto es
 * el de un type guard justificado, y este lo es. Un `digits as E164Phone`
 * compila y miente: acepta `549` como si fuera un teléfono válido y el
 * deep-link manda al cliente a un número inexistente.
 *
 * El segundo parámetro permite validar contra otro país; por defecto usa
 * el `phoneCountryCode` del prototipo, que preserva el comportamiento
 * original.
 */
export const isE164Phone = (
  value: string,
  countryCode: string = COUNTRY_CODE,
): value is E164Phone => e164Pattern(countryCode).test(value);

/**
 * Lleva cualquier forma de escribir un teléfono a E.164 sin `+`.
 *
 * Acepta: `2615551234`, `+54 9 261 555-1234`, `0261 555 1234`,
 * `54 261 555 1234`, `0054 9 261 555-1234`, con espacios, guiones y
 * paréntesis.
 *
 * Reglas, en orden:
 *  1. Se queda solo con los dígitos.
 *  2. Saca el prefijo internacional `00`.
 *  3. Si no arranca con el prefijo: si arranca con `0` (formato `0261…`)
 *     reemplaza ese `0` por el prefijo; si no, le antepone el prefijo.
 *  4. `<prefijo>0…` es el prefijo seguido del `0` del `0…` local. Se saca
 *     ese `0`.
 *  5. (Solo Argentina) Un número de 12 dígitos sin el `9` móvil se asume
 *     celular y se le agrega el `9`, que es como funciona WhatsApp ahí.
 *
 * ⛔ No intenta arreglar la notación heredada `54 261 15 555-1234`: es
 * ambigua (el `15` se confunde con un prefijo real) y adivinar mal rompe
 * el pedido. Ante la duda lanza `ValidationError` y pide escribirlo como
 * lo muestra WhatsApp.
 *
 * ⚠️ La regla 5 es una suposición documentada, no una certeza. Por eso el
 * formulario muestra el valor ya normalizado antes de confirmar.
 *
 * **El código de área no se valida.** La tarea separa el teléfono del
 * cliente del teléfono del local, y un cliente que retira en San Rafael
 * puede estar en otra provincia. `261` es lo que usa el negocio, no una
 * regla del catálogo.
 *
 * El segundo parámetro permite normalizar contra otro país; por defecto
 * usa el `phoneCountryCode` del prototipo.
 */
export const normalizeArgentinePhone = (
  input: string,
  countryCode: string = COUNTRY_CODE,
): E164Phone => {
  let digits = sanitizePhoneDigits(input);

  if (digits.length === 0) {
    throw new ValidationError({ phone: ["Ingresá un número de teléfono."] }, "Teléfono inválido");
  }

  if (digits.length > MAX_INPUT_LENGTH) {
    throw new ValidationError(
      { phone: ["El número es demasiado largo. Revisá que no se haya pegado otra cosa."] },
      "Teléfono inválido",
    );
  }

  if (digits.startsWith("00")) digits = digits.slice(2);

  if (!digits.startsWith(countryCode)) {
    digits = digits.startsWith("0")
      ? `${countryCode}${digits.slice(1)}`
      : `${countryCode}${digits}`;
  }

  if (digits.startsWith(`${countryCode}0`)) {
    digits = `${countryCode}${digits.slice(countryCode.length + 1)}`;
  }

  if (
    countryCode === ARGENTINA_COUNTRY_CODE &&
    digits.length === 12 &&
    !digits.startsWith(`${countryCode}9`)
  ) {
    digits = `${countryCode}9${digits.slice(2)}`;
  }

  if (!isE164Phone(digits, countryCode)) {
    throw new ValidationError(
      {
        phone: [
          "El número no es válido. Escribilo como WhatsApp lo muestra, por ejemplo +54 9 261 555-1234.",
        ],
      },
      "Teléfono inválido",
    );
  }

  // El type guard de arriba ya estrechó `digits` a `E164Phone`: TypeScript
  // mantiene el estrechamiento en el resto del bloque, así que acá no hace
  // falta ningún `as`.
  return digits;
};

/**
 * Formato legible para mostrar en la UI: `+54 9 261 555-1234`.
 *
 * El cliente escribe el teléfono y necesita ver que se normalizó como
 * espera antes de confirmar. Mostrarlo crudo (`5492615551234`) genera
 * dudas y correcciones.
 *
 * El formato de presentación es el argentino (prefijo + `9` móvil + área
 * de 3 + número): preserva el comportamiento original. Un país distinto
 * debería su propio formateador de display.
 */
export const formatArgentinePhoneForDisplay = (phone: E164Phone): string => {
  // E.164 argentino móvil: 54 (0–1) + 9 (2) + área (3–5) + número (6–12).
  const area = phone.slice(3, 6);
  const rest = phone.slice(6);
  return `+54 9 ${area} ${rest.slice(0, 3)}-${rest.slice(3)}`;
};
