/**
 * Contrato del dominio del carrito para el resto del sistema.
 *
 * La implementación vive en `@/lib/cart` (Tarea 11); este módulo la
 * reexporta para cumplir el contrato de la Tarea 12 §2.1
 * (`MAX_QUANTITY_PER_ITEM` y `CartLine` desde `@/lib/domain/cart`) sin
 * duplicar las constantes. Reexportar no rompe nada; una dependencia
 * circular sí — y este archivo no importa de dominio, así que no la crea.
 */
export {
  MAX_QUANTITY_PER_ITEM,
  MAX_DISTINCT_LINES,
  type CartLine,
  type CartState,
} from "@/lib/cart/cart-types";
