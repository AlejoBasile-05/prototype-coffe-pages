/**
 * La forma del carrito. Dominio puro: sin React, sin Zustand, sin I/O.
 *
 * `CartLine.unitPrice` es un SNAPSHOT del precio al momento de agregar,
 * no una referencia al producto: el producto puede cambiar de precio o
 * desaparecer del catálogo y la línea sigue siendo la que el cliente
 * vio cuando la agregó. La Tarea 13 revalida contra el servidor antes
 * de armar el mensaje de WhatsApp.
 *
 * `| null` y no `?:`: `variantId: null` significa "este producto no
 * tiene variantes"; `variantId` ausente significaría que el dato no
 * llegó, y esa es una integración rota, no el caso normal.
 */
export const MAX_QUANTITY_PER_ITEM = 20;
export const MAX_DISTINCT_LINES = 30;

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  variantId: string | null;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  available: boolean;
}

export interface CartState {
  lines: CartLine[];
}
