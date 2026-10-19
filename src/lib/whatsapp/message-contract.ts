/**
 * Contrato de la construcción del mensaje de WhatsApp.
 *
 * Tipos, constantes y la aritmética derivada que todos los consumidores
 * necesitan. Sin plantillas, sin validación y sin efectos: si este archivo
 * hiciera una de esas cosas, alguien lo importaría por efecto y el ciclo
 * volvería.
 */
import { roundCurrency } from "@/lib/format/currency";

/** Modalidad de entrega. Los mismos valores que el enum del picker de la Tarea 13. */
export type Fulfillment = "delivery" | "pickup";

/**
 * Las tres variantes de la Tarea 00 §6.3.
 *
 * ⛔ No hay una cuarta sin que el encargado la pida. El formato se ajusta
 * con pedidos reales en la primera semana (Tarea 22) y ese ajuste se hace
 * acá, no sobre el código que arma el mensaje.
 */
export type MessageVariant = "detailed" | "minimal" | "hybrid";

/**
 * Variante por defecto. Cambiar esta constante cambia producción en el
 * próximo deploy, sin tocar lógica ni plantillas.
 */
export const DEFAULT_MESSAGE_VARIANT: MessageVariant = "hybrid";

/** Nombre de cada variante, para la pantalla de QA y el log de la Tarea 22. */
export const MESSAGE_VARIANT_LABELS: Readonly<Record<MessageVariant, string>> = {
  detailed: "Detallada",
  minimal: "Mínima",
  hybrid: "Híbrida con notas",
};

/** Una línea del carrito tal como viaja al mensaje. */
export interface WhatsAppCartLine {
  readonly productId: string;
  readonly name: string;
  readonly variantName: string | null;
  /** Instantánea del precio con el `priceDelta` ya aplicado. La revalida el checkout. */
  readonly unitPrice: number;
  readonly quantity: number;
}

/** Datos del cliente. `phone` entra en cualquier formato: lo normaliza el servicio. */
export interface WhatsAppCustomer {
  readonly fullName: string;
  readonly phone: string;
  readonly fulfillment: Fulfillment;
  readonly address: string | null;
  readonly notes: string | null;
}

/** Datos del negocio. `whatsappPhone` en E.164 sin `+`, como lo guarda la Tarea 08. */
export interface WhatsAppBusiness {
  readonly name: string;
  readonly whatsappPhone: string;
}

export interface BuildWhatsAppMessageInput {
  readonly items: readonly WhatsAppCartLine[];
  readonly customer: WhatsAppCustomer;
  readonly business: WhatsAppBusiness;
  /** Por defecto `DEFAULT_MESSAGE_VARIANT`. */
  readonly variant?: MessageVariant;
}

/** Lo que devuelve `buildWhatsAppOrder`. `text` es el producto final. */
export interface WhatsAppOrderMessage {
  readonly text: string;
  /** `true` si hubo que recortar notas o ítems. La UI avisa en el checkout. */
  readonly isTruncated: boolean;
  readonly omittedItemCount: number;
  /** `true` si las notas entraron en el mensaje. */
  readonly hasNotes: boolean;
  /** Total de los ítems que quedaron, ya redondeado. */
  readonly total: number;
}

/** Total de una línea. `roundCurrency` en el medio, no al final de la suma. */
export const lineTotal = (line: WhatsAppCartLine): number =>
  roundCurrency(line.unitPrice * line.quantity);

/** Total del pedido. Suma de líneas ya redondeadas: `0.1 + 0.2` nunca llega acá. */
export const orderTotal = (lines: readonly WhatsAppCartLine[]): number =>
  roundCurrency(lines.reduce((sum, line) => sum + lineTotal(line), 0));
