/**
 * Dominio de comandas (Tarea 23).
 *
 * Capa 0: sin Next, sin Prisma, sin Supabase. Los tipos viajan hasta el
 * cliente (tarjeta del tablero, store de Realtime) y la máquina de
 * estados es la MISMA que valida la Server Action: dos definiciones de
 * "transición válida" se desincronizarían.
 */
import { t } from "@/config/prototype";

export const ORDER_STATUSES = ["PENDING", "PREPARING", "READY", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_FULFILLMENTS = ["DELIVERY", "PICKUP"] as const;
export type OrderFulfillment = (typeof ORDER_FULFILLMENTS)[number];

/** Etiqueta visible de cada estado en el tablero. */
export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  PENDING: t("pendingPlural"),
  PREPARING: t("preparingPlural"),
  READY: t("readyPlural"),
  CANCELLED: t("cancelledPlural"),
};

/**
 * A dónde puede ir cada estado. La única fuente de verdad de la máquina
 * de estados: la Server Action la consulta antes de escribir y la UI la
 * consulta para saber qué botones mostrar.
 *
 * Reglas del dominio:
 *   · El flujo avanza (PENDING → PREPARING → READY). No se vuelve atrás:
 *     un paso "para atrás" en la pantalla de cocina esconde errores en
 *     vez de corregirlos.
 *   · CANCELLED es terminal y alcanzable antes de entregar: corta los
 *     pedidos falsos o los anulados por el cliente en el chat.
 *   · READY es terminal: un pedido entregado no se "des-entrega".
 */
const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: [],
  CANCELLED: [],
};

/** Estados destino permitidos desde `status`. Array vacío en los terminales. */
export const nextStatusesFor = (status: OrderStatus): readonly OrderStatus[] =>
  TRANSITIONS[status];

/** Guardia de la Server Action. Sin ella, un payload armado a mano salta pasos. */
export const canTransitionOrder = (from: OrderStatus, to: OrderStatus): boolean =>
  TRANSITIONS[from].includes(to);

/** Columnas activas del tablero. CANCELLED existe en la base pero no ocupa columna. */
export const BOARD_STATUSES: readonly OrderStatus[] = ["PENDING", "PREPARING", "READY"];

/** `#0045`. El cuid existe para la base; el humano habla por este número. */
export const formatOrderNumber = (orderNumber: number): string =>
  `#${String(orderNumber).padStart(4, "0")}`;

/** Línea de la comanda tal como la consume la UI. Precios ya en `number`. */
export interface OrderItemDTO {
  readonly productName: string;
  readonly variantName: string | null;
  readonly unitPrice: number;
  readonly quantity: number;
}

/** Comanda completa para el tablero. */
export interface OrderDTO {
  readonly id: string;
  readonly orderNumber: number;
  readonly status: OrderStatus;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly fulfillment: OrderFulfillment;
  readonly address: string | null;
  readonly notes: string | null;
  readonly total: number;
  readonly items: readonly OrderItemDTO[];
  /** ISO string: Date no cruza el límite servidor→cliente sin serializar. */
  readonly createdAt: string;
}
