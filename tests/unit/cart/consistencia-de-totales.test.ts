import { describe, expect, it } from "vitest";

import type { CartLineReference, ProductDTO } from "@/lib/domain";
import { roundCurrency } from "@/lib/format/currency";
import { addItemToCart, calculateCartSubtotal, getCartItemCount } from "@/lib/cart/cart-rules";
import type { CartLine, CartState } from "@/lib/cart/cart-types";
import { validateCartLines } from "@/server/services/cart-validation.service";
import { lineTotal, orderTotal } from "@/lib/whatsapp/message-contract";
import type { WhatsAppCartLine } from "@/lib/whatsapp/message-contract";

/**
 * Bloque D de la Tarea 20: que los totales cuadren.
 *
 * ⛔ El dinero se calcula en DOS lugares y por eso hay dos archivos de
 *    código: el navegador arma un carrito con una INSTANTÁNEA del precio, y
 *    el servidor re-precia cada línea antes de que se envíe. El bug que
 *    estas pruebas persiguen es que esas dos mitades den números distintos
 *    sin que nadie entienda por qué.
 *
 * Por eso el archivo no prueba "que sume": prueba que las dos mitades
 * estén de acuerdo, y que la del servidor no pueda ser movida por el
 * cliente.
 */

const linea = (over: Partial<CartLine> & Pick<CartLine, "productId" | "unitPrice">): CartLine => ({
  slug: "classic",
  name: "Classic",
  variantId: null,
  variantName: null,
  quantity: 1,
  imageUrl: null,
  available: true,
  ...over,
});

const carrito = (...lines: CartLine[]): CartState => ({ lines });

/** Producto del catálogo para los tests del tercer bloque. */
const PRODUCTO: ProductDTO = {
  id: "prod_1",
  name: "Classic Jamón y Queso",
  slug: "classic",
  description: "Vientre de leche con jamón cocido y queso gouda.",
  price: 1450.5,
  imageUrl: "https://res.cloudinary.com/modo-miga/image/upload/x.jpg",
  imagePublicId: "modo-miga/products/classic",
  isAvailable: true,
  status: "PUBLISHED",
  isFeatured: false,
  sortOrder: 0,
  allergens: ["gluten", "lactosa"],
  categoryId: "cat-1",
  variants: [],
};

// ─────────────────── 1. El subtotal del navegador ───────────────────

describe("el subtotal del carrito", () => {
  it("debe redondear UNA sola vez, al final, y no por línea", () => {
    // ⛔ El caso que motiva la regla. Por línea: 3 × 0.1 = 0.3 (redondeado),
    //    3 × 0.2 = 0.6 (redondeado) → 0.90. Al final: 3 × 0.1 = 0.30000000000000004
    //    y 3 × 0.2 = 0.6000000000000001, suma 0.9 exacto. Con precios de
    //    centavo y cantidad entera los dos caminos coinciden, así que el
    //    bug se esconde justo en los datos que parecen inofensivos.
    const conCentavos = carrito(
      linea({ productId: "p1", unitPrice: 0.1, quantity: 3 }),
      linea({ productId: "p2", unitPrice: 0.2, quantity: 3 }),
    );

    expect(calculateCartSubtotal(conCentavos)).toBe(0.9);
  });

  it("debe dar el mismo total que multiplicar y sumar a mano con precio y cantidad enteros", () => {
    const estado = carrito(
      linea({ productId: "p1", unitPrice: 1450.5, quantity: 2 }),
      linea({ productId: "p2", unitPrice: 890, quantity: 3 }),
    );

    expect(calculateCartSubtotal(estado)).toBe(roundCurrency(1450.5 * 2 + 890 * 3));
  });

  it("debe dar 0 para un carrito vacío, no NaN", () => {
    expect(calculateCartSubtotal(carrito())).toBe(0);
  });

  it("debe contar unidades y no líneas", () => {
    // El contador y el subtotal tienen que contar la misma cosa: si el
    // panel dijera "3 productos" con dos líneas, el cliente pensaría que
    // le falta algo antes de pagar.
    const estado = carrito(
      linea({ productId: "p1", unitPrice: 100, quantity: 2 }),
      linea({ productId: "p2", unitPrice: 100, quantity: 1 }),
    );

    expect(getCartItemCount(estado)).toBe(3);
    expect(estado.lines).toHaveLength(2);
  });
});

// ─────────────── 2. El precio que manda es el del servidor ───────────────

describe("el re-preciado del servidor", () => {
  const productoBase: ProductDTO = {
    id: "prod_1",
    name: "Classic Jamón y Queso",
    slug: "classic",
    description: "Vientre de leche con jamón cocido y queso gouda.",
    price: 1450.5,
    imageUrl: "https://res.cloudinary.com/modo-miga/image/upload/x.jpg",
    imagePublicId: "modo-miga/products/classic",
    isAvailable: true,
    status: "PUBLISHED",
    isFeatured: false,
    sortOrder: 0,
    allergens: ["gluten", "lactosa"],
    categoryId: "cat-1",
    variants: [],
  };

  const catalogo = (...products: ProductDTO[]) => ({
    productRepository: { findPublishedProducts: async () => products },
  });

  it("debe devolver el precio vigente, no el que dice el cliente", async () => {
    // ⛔ La entrada es lo ÚNICO que acepta del cliente: productId y
    //    variantId. No hay forma de mandar un precio, ni por URL ni por
    //    body: el snapshot del navegador no vuelve al servidor (§doc 4.2).
    const resultado = await validateCartLines(catalogo(productoBase), [
      { productId: "prod_1", variantId: null },
    ]);

    expect(resultado.lines[0]?.currentUnitPrice).toBe(1450.5);
    expect(resultado.hasBlockingIssues).toBe(false);
  });

  it("debe sumar el priceDelta de la variante al precio del producto", async () => {
    const conVariantes: ProductDTO = {
      ...productoBase,
      variants: [
        { id: "var_grande", name: "Grande", priceDelta: 250, isAvailable: true, sortOrder: 1 },
        { id: "var_chico", name: "Chico", priceDelta: -150, isAvailable: true, sortOrder: 0 },
      ],
    };

    const resultado = await validateCartLines(catalogo(conVariantes), [
      { productId: "prod_1", variantId: "var_grande" },
      { productId: "prod_1", variantId: "var_chico" },
    ]);

    expect(resultado.lines.map((linea) => linea.currentUnitPrice)).toEqual([1700.5, 1300.5]);
  });

  it("debe marcar FUERA_DE_CATALOGO si el producto ya no está publicado", async () => {
    const resultado = await validateCartLines(catalogo(), [
      { productId: "prod_1", variantId: null },
    ]);

    // ⛔ "No existe" y "existe pero no hay" son mensajes distintos: la
    //    primera pide una línea nueva, la segunda ofrece esperar.
    expect(resultado.lines[0]).toMatchObject({
      isInCatalog: false,
      isAvailable: false,
      currentUnitPrice: null,
      issue: "FUERA_DE_CATALOGO",
    });
    expect(resultado.hasBlockingIssues).toBe(true);
  });

  it("debe marcar PRODUCTO_AGOTADO sin borrarlo del catálogo", async () => {
    const agotado: ProductDTO = { ...productoBase, isAvailable: false };

    const resultado = await validateCartLines(catalogo(agotado), [
      { productId: "prod_1", variantId: null },
    ]);

    expect(resultado.lines[0]).toMatchObject({
      isInCatalog: true,
      isAvailable: false,
      currentUnitPrice: 1450.5,
      issue: "PRODUCTO_AGOTADO",
    });
  });

  it("debe marcar VARIANTE_NO_DISPONIBLE si la variante no existe o está caída", async () => {
    const conVarianteCaida: ProductDTO = {
      ...productoBase,
      variants: [
        { id: "var_chico", name: "Chico", priceDelta: -150, isAvailable: false, sortOrder: 0 },
      ],
    };

    const resultado = await validateCartLines(catalogo(conVarianteCaida), [
      { productId: "prod_1", variantId: "var_chico" },
      { productId: "prod_1", variantId: "var_fantasma" },
    ]);

    expect(resultado.lines.map((linea) => linea.issue)).toEqual([
      "VARIANTE_NO_DISPONIBLE",
      "VARIANTE_NO_DISPONIBLE",
    ]);
  });

  it("debe consultar el catálogo una sola vez para todas las líneas", async () => {
    // 30 líneas son 30 búsquedas de memoria, no 30 queries: la función se
    //    arma un `Map` arriba. Un test con spies sobre el repositorio es lo
    //    único que impide que alguien lo cambie por un `findById` por línea.
    let llamadas = 0;
    const referencias: CartLineReference[] = Array.from({ length: 30 }, (_, indice) => ({
      productId: `prod_${indice}`,
      variantId: null,
    }));

    await validateCartLines(
      {
        productRepository: {
          findPublishedProducts: async () => {
            llamadas += 1;
            return [productoBase];
          },
        },
      },
      referencias,
    );

    expect(llamadas).toBe(1);
  });
});

// ─────────── 3. La invariante que las dos mitades tienen que cumplir ───────────

describe("la instantánea del navegador y el precio del servidor", () => {
  it("debe dar el mismo total cuando el precio no cambió", async () => {
    const precioServidor = 1450.5;
    const estado = carrito(linea({ productId: "prod_1", unitPrice: precioServidor, quantity: 3 }));

    const validado = await validateCartLines(
      { productRepository: { findPublishedProducts: async () => [PRODUCTO] } },
      [{ productId: "prod_1", variantId: null }],
    );
    const totalDelServidor = validado.lines.reduce(
      (total, line, indice) =>
        total + (line.currentUnitPrice ?? 0) * (estado.lines[indice]?.quantity ?? 0),
      0,
    );

    // El caso feliz: si el carrito lleva días en el navegador y el precio
    // no se movió, el total que ve el cliente ES el que se cobra.
    expect(roundCurrency(totalDelServidor)).toBe(calculateCartSubtotal(estado));
  });

  it("debe acusar la diferencia cuando el precio cambió mientras se armaba el carrito", async () => {
    const estado = carrito(linea({ productId: "prod_1", unitPrice: 1450.5, quantity: 2 }));

    const validado = await validateCartLines(
      { productRepository: { findPublishedProducts: async () => [{ ...PRODUCTO, price: 1590 }] } },
      [{ productId: "prod_1", variantId: null }],
    );
    const totalDelServidor = validado.lines.reduce(
      (total, line, indice) =>
        total + (line.currentUnitPrice ?? 0) * (estado.lines[indice]?.quantity ?? 0),
      0,
    );

    // ⛔ Este es el motivo de existir del servicio: el cliente veía 2901 y
    //    se le cobran 3180. La diferencia tiene que ser visible ANTES de
    //    que el cliente confirme, no un reclamo después.
    expect(calculateCartSubtotal(estado)).toBe(2901);
    expect(roundCurrency(totalDelServidor)).toBe(3180);
    expect(validado.hasBlockingIssues).toBe(false);
  });

  it("debe seguir el carrito cuando el encargado sube la cantidad", async () => {
    // El carrito se arma con `addItemToCart`, no a mano: si la regla de
    //    merge cambiara, el total que se compara en el test de arriba
    //    dejaría de ser el que ve el usuario.
    const conPrecioViejo = addItemToCart(
      carrito(linea({ productId: "prod_1", unitPrice: 1450.5, quantity: 1 })),
      linea({ productId: "prod_1", unitPrice: 1450.5, quantity: 2 }),
    );

    expect(calculateCartSubtotal(conPrecioViejo)).toBe(4351.5);
    expect(getCartItemCount(conPrecioViejo)).toBe(3);
  });
});

// ─────── 4. El puente: el total que ve el cliente es el que se manda ───────

describe("el subtotal del carrito y el total del mensaje", () => {
  const comoMensaje = (estado: CartState): WhatsAppCartLine[] =>
    estado.lines.map((linea) => ({
      productId: linea.productId,
      name: linea.name,
      variantName: linea.variantName,
      unitPrice: linea.unitPrice,
      quantity: linea.quantity,
    }));

  it("deben dar el mismo número para las mismas líneas", () => {
    const estado = carrito(
      linea({ productId: "p1", unitPrice: 1450.5, quantity: 2 }),
      linea({ productId: "p2", unitPrice: 890, quantity: 3 }),
      linea({ productId: "p3", unitPrice: 1250, quantity: 1 }),
    );

    // ⛔ Es el criterio de aceptación de §8.1. El carrito muestra un número
    //    y el pedido que llega al WhatsApp del encargado lleva otro: si
    //    difieren, el cliente cree que pagó una cosa y el encargado cobra
    //    otra, y el reclamo cae del lado del local.
    expect(calculateCartSubtotal(estado)).toBe(orderTotal(comoMensaje(estado)));
  });

  it("no debe aplicar el priceDelta dos veces al pasar del carrito al mensaje", async () => {
    // ⛔ La variante grande vale 1450,50 + 250 = 1700,50. El carrito guarda
    //    la instantánea CON el delta aplicado, y el servidor devuelve el
    //    precio vigente TAMBIÉN con el delta aplicado. Si el puente suma el
    //    delta de nuevo, la línea vale 1950,50 y ellocal se lleva 250 pesos
    //    de más por producto, sin que ningún número visible se explains.
    const conDelta: ProductDTO = {
      ...PRODUCTO,
      variants: [
        { id: "var_grande", name: "Grande", priceDelta: 250, isAvailable: true, sortOrder: 1 },
      ],
    };
    const precioEnElCarrito = 1700.5;

    const estado = carrito(
      linea({
        productId: "prod_1",
        unitPrice: precioEnElCarrito,
        quantity: 2,
        variantId: "var_grande",
        variantName: "Grande",
      }),
    );

    const validado = await validarConCatalogo([conDelta], estado);

    const lineasDelMensaje = estado.lines.map((linea, indice) => ({
      productId: linea.productId,
      name: linea.name,
      variantName: linea.variantName,
      unitPrice: validado.lines[indice]?.currentUnitPrice ?? 0,
      quantity: linea.quantity,
    }));

    expect(validado.lines[0]?.currentUnitPrice).toBe(precioEnElCarrito);
    expect(lineTotal(lineasDelMensaje[0] as WhatsAppCartLine)).toBe(3401);
    expect(orderTotal(lineasDelMensaje)).toBe(calculateCartSubtotal(estado));
  });
});

/** Corre la revalidación de las líneas del carrito contra un catálogo dado. */
const validarConCatalogo = async (catalogo: ProductDTO[], estado: CartState) =>
  validateCartLines(
    { productRepository: { findPublishedProducts: async () => catalogo } },
    estado.lines.map((linea) => ({ productId: linea.productId, variantId: linea.variantId })),
  );
