/** Encaje del mensaje en el límite: de **legibilidad**, no de plataforma
 * (lo lee una persona atendiendo a otro cliente). */
import {
  lineTotal,
  orderTotal,
  type MessageVariant,
  type WhatsAppBusiness,
  type WhatsAppCartLine,
  type WhatsAppCustomer,
  type WhatsAppOrderMessage,
} from "./message-contract";
import { renderMessageLines } from "./message-variants";

/** Tope del mensaje. Pasado este número se recorta, nunca se corta. */
export const MAX_MESSAGE_LENGTH = 1800;

/** Tope del nombre de un producto: el **único** campo cortable y solo
 * como último recurso (un precio a medio escribir se lee como otro). */
export const MAX_ITEM_NAME_LENGTH = 60;

const NOTES_OMITTED_NOTICE = "Comentarios: no entran en el mensaje, te los escribo acá en el chat";
const NAME_SHORTENED_NOTICE =
  "el nombre del producto va recortado, te lo escribo completo en el chat";
const itemsOmittedNotice = (count: number): string =>
  count === 1
    ? "+ 1 producto más: el total es parcial, el resto lo coordinamos en el chat"
    : `+ ${count} productos más: el total es parcial, el resto lo coordinamos en el chat`;

export interface TruncationContext {
  readonly variant: MessageVariant;
  readonly items: readonly WhatsAppCartLine[];
  readonly customer: WhatsAppCustomer;
  readonly business: WhatsAppBusiness;
}

// ⚠️ `withNotes: false` hace cierto el aviso de notas omitidas; con el
// contexto entero el mensaje duplicaría el texto largo.
const render = (
  context: TruncationContext,
  items: readonly WhatsAppCartLine[],
  notice: string | null,
  withNotes: boolean,
): string =>
  renderMessageLines({
    ...context,
    items,
    notice,
    customer: withNotes ? context.customer : { ...context.customer, notes: null },
  }).join("\n");

// Un aviso por cada cosa que se perdió: un recorte no anunciado hace que
// el encargado complete el pedido con lo que le parece.
const buildNotice = (
  omittedItems: number,
  notesOmitted: boolean,
  nameShortened = false,
): string | null => {
  const parts: string[] = [];
  if (omittedItems > 0) parts.push(itemsOmittedNotice(omittedItems));
  if (notesOmitted) parts.push(NOTES_OMITTED_NOTICE);
  if (nameShortened) parts.push(NAME_SHORTENED_NOTICE);
  return parts.length === 0 ? null : parts.join(" ");
};

const hasNotes = (customer: WhatsAppCustomer): boolean =>
  customer.notes !== null && customer.notes.length > 0;

/** Índice de descarte: precio total de línea ascendente. */
const discardOrder = (items: readonly WhatsAppCartLine[]): WhatsAppCartLine[] =>
  [...items].sort((a, b) => lineTotal(a) - lineTotal(b));

const shortenName = (name: string): string =>
  name.length <= MAX_ITEM_NAME_LENGTH
    ? name
    : `${name.slice(0, MAX_ITEM_NAME_LENGTH - 1).trimEnd()}…`;

const result = (
  text: string,
  kept: readonly WhatsAppCartLine[],
  isTruncated: boolean,
  omittedItemCount: number,
  withNotes: boolean,
): WhatsAppOrderMessage => ({
  text,
  isTruncated,
  omittedItemCount,
  hasNotes: withNotes,
  total: orderTotal(kept),
});

/**
 * El mensaje más completo que entra en `MAX_MESSAGE_LENGTH`. Orden fijo:
 * 1) completo con notas, 2) sin notas, 3) descarte del más barato al más
 * caro, 4) un ítem con nombre recortado. Si entra cortado, lo dice.
 */
export const buildFittingMessage = (context: TruncationContext): WhatsAppOrderMessage => {
  const { items, customer } = context;
  const notesDropped = hasNotes(customer);
  const full = render(context, items, null, true);

  if (full.length <= MAX_MESSAGE_LENGTH) {
    // `detailed` no incluye las notas nunca: informar `hasNotes: true`
    // ahí sería mentir sobre lo que se mandó.
    return result(full, items, false, 0, hasNotes(customer) && context.variant !== "detailed");
  }

  const withoutNotes = render(context, items, buildNotice(0, notesDropped), false);

  if (withoutNotes.length <= MAX_MESSAGE_LENGTH) {
    return result(withoutNotes, items, true, 0, false);
  }

  // `Set` por identidad de objeto (filtrar no cambia el orden, que es lo
  // que espera el local). `slice(0, -1)`: el último ítem nunca se
  // descarta — sin líneas el pedido está vacío, no recortado.
  const dropped = new Set<WhatsAppCartLine>();
  for (const candidate of discardOrder(items).slice(0, -1)) {
    dropped.add(candidate);
    const kept = items.filter((line) => !dropped.has(line));
    const text = render(context, kept, buildNotice(dropped.size, notesDropped), false);

    if (text.length <= MAX_MESSAGE_LENGTH) {
      return result(text, kept, true, dropped.size, false);
    }
  }

  const mostRelevant = discardOrder(items).at(-1);

  // `items` no vacío está garantizado por el servicio; el chequeo hace
  // explícita la precondición sin usar el `!` prohibido.
  if (mostRelevant === undefined) {
    return result(withoutNotes, items, true, 0, false);
  }

  const shortened = shortenName(mostRelevant.name);
  const kept: readonly WhatsAppCartLine[] = [{ ...mostRelevant, name: shortened }];

  // El nombre recortado tiene aviso propio: sin él, el encargado no
  // sabe que le mandaron la mitad del nombre. ⛔ El precio nunca se toca.
  const text = render(
    context,
    kept,
    buildNotice(items.length - 1, notesDropped, shortened !== mostRelevant.name),
    false,
  );

  return result(text, kept, true, items.length - 1, false);
};
