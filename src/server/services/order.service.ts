/**
 * Servicio de comandas (Tarea 23).
 *
 * El registro es la mitad pública del dominio de pedidos: lo llama la
 * Server Action del checkout SIN sesión de admin. Por eso este servicio
 * es quien cotiza — el cliente nunca manda un precio — y quién corta
 * cuando una línea ya no se puede cumplir.
 */
import "server-only";

import { ConflictError, ValidationError } from "@/lib/domain";
import type { CartLineReference, OrderDTO, ProductDTO } from "@/lib/domain";
import { roundCurrency } from "@/lib/format/currency";
import { orderTotal } from "@/lib/whatsapp/message-contract";
import type { WhatsAppCartLine, WhatsAppCustomer } from "@/lib/whatsapp/message-contract";

import type { CreateOrderInput } from "@/server/repositories/order.repository";
import type { CartAvailabilityReader } from "./cart-validation.service";
import { validateCartLines } from "./cart-validation.service";

/** Solo las operaciones de escritura de comandas que el servicio usa (ISP). */
export interface OrderWriter {
  createOrder(input: CreateOrderInput): Promise<OrderDTO>;
}

export interface RegisterOrderLine {
  readonly productId: string;
  readonly quantity: number;
}

const toReference = (line: RegisterOrderLine): CartLineReference => ({
  productId: line.productId,
  // Sin variantes en v1 (decisión D-02): la referencia siempre es plana.
  // La columna `variantName` existe en la tabla para el día en que se
  // abra esa decisión, y mientras tanto queda en null.
  variantId: null,
});

/**
 * Registra una comanda a partir de ítems + datos del cliente ya
 * validados por Zod.
 *
 * Secuencia:
 *   1. Revalida contra el catálogo REAL (`validateCartLines`): entre el
 *      clic del cliente y esta ejecución pudo agotarse un producto o
 *      cambiar un precio.
 *   2. Con issue bloqueante → `ConflictError`. El checkout ya lo
 *      mostraba; esto es la segunda frontera, no la primera.
 *   3. COTIZA con el precio vigente en base, ignorando cualquier
 *      instantánea del navegador.
 *   4. Persiste comanda + líneas en una sola transacción (repositorio).
 */
export const registerCheckoutOrder = async (
  dependencies: {
    readonly productRepository: CartAvailabilityReader;
    readonly orderRepository: OrderWriter;
  },
  input: { readonly items: readonly RegisterOrderLine[]; readonly customer: WhatsAppCustomer },
): Promise<OrderDTO> => {
  if (input.items.length === 0) {
    throw new ValidationError({ items: ["El pedido no tiene productos."] });
  }

  const references = input.items.map(toReference);
  const validation = await validateCartLines(
    { productRepository: dependencies.productRepository },
    references,
  );

  if (validation.hasBlockingIssues) {
    throw new ConflictError(
      "Hay productos del pedido que ya no están disponibles.",
      { code: "ORDER_NOT_REGISTERABLE" },
    );
  }

  const products = await dependencies.productRepository.findPublishedProducts();
  const byId = new Map(products.map((product: ProductDTO) => [product.id, product]));

  const lines: WhatsAppCartLine[] = input.items.map((line) => {
    const product = byId.get(line.productId);
    // validateCartLines ya garantizó que existe y está disponible; si no,
    // es una carrera contra una despublicación y se corta igual.
    if (product === undefined) {
      throw new ConflictError("Un producto del pedido dejó de existir mientras se confirmaba.");
    }
    return {
      productId: product.id,
      name: product.name,
      variantName: null,
      unitPrice: product.price,
      quantity: line.quantity,
    };
  });

  return dependencies.orderRepository.createOrder({
    customerName: input.customer.fullName,
    customerPhone: input.customer.phone,
    fulfillment: input.customer.fulfillment === "delivery" ? "DELIVERY" : "PICKUP",
    address: input.customer.address,
    notes: input.customer.notes,
    total: orderTotal(lines),
    items: lines.map((line) => ({
      productId: line.productId,
      productName: line.name,
      variantName: line.variantName,
      unitPrice: roundCurrency(line.unitPrice),
      quantity: line.quantity,
    })),
  });
};

/**
 * Comandas del turno para el tablero.
 *
 * El borde del "día" se calcula en la zona del NEGOCIO, no del servidor:
 * Vercel corre en UTC y el local cierra de noche con el reloj de Mendoza
 * (UTC-3, sin horario de verano). Pedir "desde las 00:00 UTC" partiría
 * el turno a las 21:00 del día anterior.
 */
export interface OrderBoardReader {
  findOrdersForBoard(options: { readonly dayStartUtc: Date; readonly limit?: number }): Promise<
    OrderDTO[]
  >;
}

const BUSINESS_TIME_ZONE = "America/Argentina/Mendoza";

/** Medianoche de HOY en Mendoza, expresada en UTC para la query. */
const startOfBusinessDayUtc = (now: Date): Date => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "00";

  // Mendoza no tiene DST: el offset es siempre -03:00.
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00-03:00`);
};

export const listOrdersForBoard = (
  dependencies: { readonly orderRepository: OrderBoardReader },
  now: Date = new Date(),
): Promise<OrderDTO[]> =>
  dependencies.orderRepository.findOrdersForBoard({ dayStartUtc: startOfBusinessDayUtc(now) });
