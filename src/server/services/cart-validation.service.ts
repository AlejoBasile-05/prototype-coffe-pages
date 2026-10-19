import "server-only";

import type {
  CartLineReference,
  CartValidationResult,
  ProductDTO,
  ValidatedCartLine,
} from "@/lib/domain";
import { roundCurrency } from "@/lib/format/currency";

// Los tipos del contrato (`CartLineIssue`, `CartLineReference`,
// `ValidatedCartLine`, `CartValidationResult`) viven en
// `src/lib/domain/cart-validation.ts` (Capa 0): el cliente los importa
// para tipar `useCartValidation` y la regla del proyecto le prohíbe
// importar nada de `@/server/*`.
export type {
  CartLineIssue,
  CartLineReference,
  CartValidationResult,
  ValidatedCartLine,
} from "@/lib/domain";

/**
 * Por qué el servicio existe: el carrito guarda una **instantánea** del
 * precio. Entre que el cliente agregó el sándwich y presionó "Enviar"
 * pueden pasar diez minutos y cambiar el precio. Mandar un precio viejo
 * genera una discusión que el encargado tiene que resolver en el chat,
 * que es exactamente lo que este proyecto quiere evitar.
 *
 * ⛔ No lee la query string ni responde: eso es del Route Handler. No
 * recibe el precio del carrito tampoco: la comparación la hace el
 * navegador, donde está la instantánea, y mandar precios por la URL los
 * expondría en el historial del navegador y en los logs del servidor.
 */

/** Solo la parte del repositorio que este servicio necesita (DIP). */
export interface CartAvailabilityReader {
  findPublishedProducts(options?: { readonly onlyAvailable?: boolean }): Promise<ProductDTO[]>;
}

const buildValidatedLine = (
  reference: CartLineReference,
  product: ProductDTO | undefined,
): ValidatedCartLine => {
  if (product === undefined) {
    return {
      productId: reference.productId,
      variantId: reference.variantId,
      isInCatalog: false,
      isAvailable: false,
      currentUnitPrice: null,
      issue: "FUERA_DE_CATALOGO",
    };
  }

  const variant =
    reference.variantId === null
      ? undefined
      : product.variants.find((item) => item.id === reference.variantId);

  const isVariantUnavailable =
    reference.variantId !== null && (variant === undefined || !variant.isAvailable);

  return {
    productId: reference.productId,
    variantId: reference.variantId,
    isInCatalog: true,
    isAvailable: product.isAvailable,
    currentUnitPrice: roundCurrency(product.price + (variant?.priceDelta ?? 0)),
    issue: isVariantUnavailable
      ? "VARIANTE_NO_DISPONIBLE"
      : product.isAvailable
        ? null
        : "PRODUCTO_AGOTADO",
  };
};

/**
 * Consulta el estado y el precio vigente de las líneas del carrito.
 *
 * Los productos se piden **todos** los publicados, incluidos los
 * agotados: si se pidieran solo los disponibles, un producto que se
 * agotó aparecería como "fuera de catálogo" y el mensaje sería falso.
 * La diferencia entre "no existe" y "existe pero no hay" importa: la
 * primera pide una línea nueva, la segunda ofrece esperar.
 *
 * La consulta va una sola vez y el cruce es un `Map`: 30 líneas son 30
 * búsquedas de memoria, no 30 queries.
 */
export const validateCartLines = async (
  dependencies: { readonly productRepository: CartAvailabilityReader },
  references: readonly CartLineReference[],
): Promise<CartValidationResult> => {
  const products = await dependencies.productRepository.findPublishedProducts();
  const byId = new Map(products.map((product) => [product.id, product]));

  const lines = references.map((reference) =>
    buildValidatedLine(reference, byId.get(reference.productId)),
  );

  return {
    lines,
    hasBlockingIssues: lines.some((line) => line.issue !== null),
  };
};
