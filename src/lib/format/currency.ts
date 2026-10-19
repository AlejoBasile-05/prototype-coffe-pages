/**
 * Formato de moneda para los precios del catálogo.
 *
 * La moneda y el locale salen de `PROTOTYPE_CONFIG.currency`, no de
 * valores hardcodeados: cambiar el prototipo de ARS/es-AR a USD/en-US es
 * cambiar `src/config/prototype.ts` y nada más. Con el locale por
 * defecto (`es-AR`) un precio sin centavos rinde `$ 1.200` con separador
 * de miles, que es como se lee un precio de menú en Argentina.
 *
 * Un importe con centavos rinde `$ 4.351,65`: hay dos formateadores y la
 * función elige según el importe, nunca recorta un decimal que el cliente
 * vio. Los formateadores se instancian a nivel de módulo —dependen solo de
 * la config, que no cambia en runtime—: construir un `Intl.NumberFormat`
 * por render es sorprendentemente caro para lo que vale.
 *
 * `formatCurrency` no valida el input: recibe números ya decididos por la
 * capa de servicio y no los reinterpreta. La aritmética del carrito
 * (sumas y redondeos) es responsabilidad de `roundCurrency`.
 */
import { PROTOTYPE_CONFIG } from "@/config/prototype";

const CURRENCY_CODE = PROTOTYPE_CONFIG.currency.code;
const CURRENCY_LOCALE = PROTOTYPE_CONFIG.currency.locale;

const FORMATTER_CURRENCY = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: "currency",
  currency: CURRENCY_CODE,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Importes con centavos: `$ 4.351,65`. Los precios del catálogo son enteros
 * por el CHECK de la base, pero un snapshot del carrito puede traer
 * centavos y `$ 4.352` sería un precio distinto del que vio el cliente.
 */
const FORMATTER_CURRENCY_CENTS = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: "currency",
  currency: CURRENCY_CODE,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  return Number.isInteger(amount)
    ? FORMATTER_CURRENCY.format(amount)
    : FORMATTER_CURRENCY_CENTS.format(amount);
}

/**
 * Alias de compatibilidad.
 *
 * `formatARS` era el nombre original y sigue apareciendo en componentes y
 * mensajes de WhatsApp. Se mantiene mientras no se migren todos los
 * consumidores; el nombre correcto de acá en adelante es
 * `formatCurrency`, que no asume la moneda del prototipo.
 *
 * @deprecated Usar `formatCurrency`.
 */
export const formatARS = formatCurrency;

const CENTS = 100;

/**
 * Redondea a dos decimales con `Math.round`. El `Number.EPSILON`
 * corrige el error de coma flotante clásico: `1.005 * 100` da
 * `100.49999999999999` en IEEE 754, y sin el epsilon `Math.round`
 * devuelve 1 en vez de 1.01.
 *
 * No usa `toFixed`, que devuelve string: devolver string obliga a un
 * `Number()` en cada llamada y ahí es donde aparece el `NaN`.
 */
export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * CENTS) / CENTS;
}
