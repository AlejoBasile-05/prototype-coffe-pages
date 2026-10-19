/**
 * Tipos del contrato de revalidación del carrito (Tarea 13).
 *
 * Viven en Capa 0 porque el cliente los necesita para tipar la respuesta
 * de `GET /api/cart/validate` y la regla `no-restricted-imports` prohíbe
 * a los Client Components importar `@/server/*`. La LÓGICA sigue en
 * `src/server/services/cart-validation.service.ts` con `server-only`;
 * acá solo viajan las formas de datos.
 */

/** Motivo por el que una línea no se puede enviar. */
export type CartLineIssue = "FUERA_DE_CATALOGO" | "PRODUCTO_AGOTADO" | "VARIANTE_NO_DISPONIBLE";

/** Lo único que el endpoint necesita saber: qué se quiere comprar. */
export interface CartLineReference {
  readonly productId: string;
  readonly variantId: string | null;
}

/**
 * `productId` o `productId:variantId`. Los ids de Prisma no tienen dos
 * puntos. Una línea sin variante viaja como `productId` a secas: el `:`
 * final de la versión anterior (`productId:`) era la causa del 400.
 */
const CART_LINE_REF_PATTERN = /^[a-zA-Z0-9_-]{1,36}(:[a-zA-Z0-9_-]{1,36})?$/;

export const serializeCartLineRef = (reference: CartLineReference): string =>
  reference.variantId === null
    ? reference.productId
    : `${reference.productId}:${reference.variantId}`;

/**
 * Acepta `productId` y `productId:variantId`. También normaliza el
 * `productId:` que mandaban los clientes ya cargados a `variantId: null`:
 * misma validación estricta de caracteres, sin romper la compatibilidad.
 */
export const parseCartLineRef = (raw: string): CartLineReference | null => {
  // Normaliza SOLO el formato legacy exacto (`productId:`: un solo dos
  // puntos, al final). Un `productId:var456:` tiene un separador de más
  // y se rechaza igual que antes.
  const isLegacyTrailingColon = raw.endsWith(":") && raw.indexOf(":") === raw.lastIndexOf(":");
  const normalized = isLegacyTrailingColon ? raw.slice(0, -1) : raw;

  if (!CART_LINE_REF_PATTERN.test(normalized)) return null;

  const [productId, variantId] = normalized.split(":");

  if (productId === undefined || productId.length === 0) return null;

  return { productId, variantId: variantId ?? null };
};

export interface ValidatedCartLine {
  readonly productId: string;
  readonly variantId: string | null;
  /** `false` si el producto fue archivado o despublicado. */
  readonly isInCatalog: boolean;
  readonly isAvailable: boolean;
  /** Precio vigente con el `priceDelta` aplicado. `null` si ya no existe. */
  readonly currentUnitPrice: number | null;
  /** Si hay `issue`, la línea no se puede enviar. */
  readonly issue: CartLineIssue | null;
}

export interface CartValidationResult {
  readonly lines: readonly ValidatedCartLine[];
  /** Hay al menos una línea que no se puede enviar. */
  readonly hasBlockingIssues: boolean;
}
