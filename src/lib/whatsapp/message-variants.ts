/**
 * Las tres plantillas del mensaje.
 *
 * Reciben datos **ya validados y saneados** por el servicio. Este módulo no
 * decide si un dato es correcto: solo lo escribe. Esa separación es la que
 * permite testear el formato exacto sin levantar un carrito.
 *
 * Las negritas son `*texto*`, NUNCA `**texto**`: WhatsApp interpreta un
 * asterisco a cada lado y dos producen dos asteriscos literales.
 */
import { formatARS } from "@/lib/format/currency";

import { lineTotal, orderTotal } from "./message-contract";
import type {
  BuildWhatsAppMessageInput,
  MessageVariant,
  WhatsAppBusiness,
  WhatsAppCartLine,
  WhatsAppCustomer,
} from "./message-contract";

export interface RenderMessageLinesInput extends BuildWhatsAppMessageInput {
  readonly variant: MessageVariant;
  /** Aviso de recorte. Ocupa el lugar de las notas: nunca se mezclan. */
  readonly notice: string | null;
}

/**
 * Precio en el mensaje.
 *
 * `Intl` en `es-AR` mete un espacio duro (U+00A0) entre el símbolo y el
 * número: `"$ 3.700"`. El mensaje acordado en la Tarea 00 §6.3 dice
 * `$3.700`. Normalizar acá hace que el resultado sea determinista sin
 * depender de cómo implemente `formatARS` la Tarea 11. Si esa función ya
 * normaliza el espacio, esta línea es un passthrough inofensivo.
 */
const renderPrice = (amount: number): string => formatARS(amount).replace(/\u00A0/g, "");

/** `2 x Jamón y Queso (Doble)`, la parte variable de una línea. */
const renderItemLabel = (line: WhatsAppCartLine): string => {
  const variant =
    line.variantName === null || line.variantName === "" ? "" : ` (${line.variantName})`;
  return `${line.quantity} x ${line.name}${variant}`;
};

const renderItemLine = (line: WhatsAppCartLine): string =>
  `• ${renderItemLabel(line)} — ${renderPrice(lineTotal(line))}`;

const greeting = (business: WhatsAppBusiness): string =>
  `¡Hola! Quiero hacer un pedido en *${business.name}*:`;

const customerLines = (customer: WhatsAppCustomer): string[] => {
  const lines = [`Nombre: ${customer.fullName}`, `Teléfono: ${customer.phone}`];
  if (customer.fulfillment === "delivery") {
    // El servicio garantiza que `address` no es null cuando es delivery.
    lines.push(`Entrega en: ${customer.address ?? ""}`.trimEnd());
  } else {
    lines.push("Retiro en el local");
  }
  return lines;
};

// D-01 línea 11: el bloque de comentarios va pegado al bloque de datos,
// sin línea en blanco antes.
const notesLine = (customer: WhatsAppCustomer): string[] => {
  if (customer.notes === null || customer.notes.length === 0) return [];
  return [`Comentarios: ${customer.notes}`];
};

/**
 * Bloque común de las variantes A y C. La única diferencia entre las dos es
 * el bloque de comentarios, y por eso comparten el esqueleto en vez de ser
 * dos plantillas copiadas que se desincronizan con el primer cambio.
 */
const renderWithDataBlock = (input: RenderMessageLinesInput, withNotes: boolean): string[] => {
  const { items, customer, business, notice } = input;

  return [
    greeting(business),
    "",
    ...items.map(renderItemLine),
    "",
    `*Total: ${renderPrice(orderTotal(items))}*`,
    "",
    "*Mis datos:*",
    ...customerLines(customer),
    ...(withNotes ? notesLine(customer) : []),
    // El aviso de recorte ocupa el lugar de las notas, pegado al bloque.
    ...(notice === null ? [] : [notice]),
    "",
    "¡Gracias!",
  ];
};

/** Variante A de la Tarea 00 §6.3. Sin comentarios: el bloque es literal. */
const renderDetailed = (input: RenderMessageLinesInput): string[] =>
  renderWithDataBlock(input, false);

/** Variante C: la detallada más el bloque de comentarios. Es la que se usa por defecto. */
const renderHybrid = (input: RenderMessageLinesInput): string[] => renderWithDataBlock(input, true);

/**
 * Variante B: mínima. Sin precios por línea, sin negritas, sin despedida.
 *
 * Es literal a la Tarea 00 §6.3. Sirve para medir en la primera semana si el
 * local lee mejor el resumen corto o el pedido detallado (Tarea 22).
 */
const renderMinimal = (input: RenderMessageLinesInput): string[] => {
  // ⛔ `business` no se desestructura: la variante corta no menciona el
  // nombre del local. Pedir un dato para no usarlo hace que la firma prometa
  // una dependencia que el renderer no tiene.
  const { items, customer } = input;
  const entrega =
    customer.fulfillment === "delivery"
      ? `entrega en ${customer.address ?? ""}`.trimEnd()
      : "retiro en el local";
  return [
    "Hola! Mi pedido:",
    ...items.map(renderItemLabel),
    `Total: ${renderPrice(orderTotal(items))}`,
    `Soy ${customer.fullName}, tel ${customer.phone}, ${entrega}.`,
    ...(input.notice === null ? [] : [input.notice]),
  ];
};

const RENDERERS: Readonly<Record<MessageVariant, (input: RenderMessageLinesInput) => string[]>> = {
  detailed: renderDetailed,
  minimal: renderMinimal,
  hybrid: renderHybrid,
};

export const renderMessageLines = (input: RenderMessageLinesInput): readonly string[] =>
  RENDERERS[input.variant](input);
