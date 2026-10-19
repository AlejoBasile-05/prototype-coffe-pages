/** Servicio de dominio que arma el mensaje de WhatsApp. ⛔ SIN
 * `import "server-only"`: sin I/O; corre en el navegador (Tarea 13). */
import { PROTOTYPE_CONFIG } from "@/config/prototype";
import { MAX_QUANTITY_PER_ITEM, ValidationError } from "@/lib/domain";
import { isE164Phone, normalizeArgentinePhone, sanitizePhoneDigits } from "@/lib/format/phone";

import {
  DEFAULT_MESSAGE_VARIANT,
  type BuildWhatsAppMessageInput,
  type WhatsAppBusiness,
  type WhatsAppCartLine,
  type WhatsAppCustomer,
  type WhatsAppOrderMessage,
} from "./message-contract";
import { buildFittingMessage } from "./message-truncation";

/** Caracteres que no pueden viajar en un mensaje de chat. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Marcas bidireccionales (U+202E invierte el texto visible en pantalla). Se eliminan. */
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

const MAX_NAME_LENGTH = 80;
const MAX_ADDRESS_LENGTH = 240;
const MIN_ADDRESS_LENGTH = 10;

// El truncado por notas queda en `buildFittingMessage`; un tope más
// bajo haría inalcanzable la primera etapa de recorte.
const MAX_NOTES_LENGTH = 2000;

/** Limpieza de texto libre: normaliza finales de línea, borra controles
 * y marcas bidi, quita el `*` y colapsa espacios. */
const cleanText = (value: string): string =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(BIDI_CONTROLS, "")
    .replace(/\*/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();

const validateLine = (line: WhatsAppCartLine): WhatsAppCartLine => {
  const quantityOk =
    Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= MAX_QUANTITY_PER_ITEM;
  if (!quantityOk) {
    throw new ValidationError(
      { cart: [`"${line.name}" tiene una cantidad inválida. Volvé al carrito y revisala.`] },
      "Carrito inválido",
    );
  }

  if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
    throw new ValidationError(
      { cart: [`"${line.name}" tiene un precio inválido.`] },
      "Carrito inválido",
    );
  }

  return {
    ...line,
    name: cleanText(line.name),
    variantName: line.variantName === null ? null : cleanText(line.variantName),
  };
};

// Claves de `fieldErrors` = campos del formulario de la Tarea 13.
const validateCustomer = (customer: WhatsAppCustomer): WhatsAppCustomer => {
  const fullName = cleanText(customer.fullName);

  if (fullName.length < 2 || fullName.length > MAX_NAME_LENGTH) {
    throw new ValidationError(
      { fullName: ["Ingresá tu nombre."] },
      "Datos del cliente incompletos",
    );
  }

  const phone = normalizeArgentinePhone(customer.phone);

  const notes = customer.notes === null ? null : cleanText(customer.notes);
  if (notes !== null && notes.length > MAX_NOTES_LENGTH) {
    throw new ValidationError(
      { notes: [`Las notas pueden tener hasta ${MAX_NOTES_LENGTH} caracteres.`] },
      "Datos del cliente incompletos",
    );
  }

  if (customer.fulfillment === "pickup") {
    return { fullName, phone, fulfillment: "pickup", address: null, notes };
  }

  const address = customer.address === null ? "" : cleanText(customer.address);

  if (address.length < MIN_ADDRESS_LENGTH || address.length > MAX_ADDRESS_LENGTH) {
    throw new ValidationError(
      { address: ["Ingresá la dirección de entrega, entre 10 y 240 caracteres."] },
      "Falta la dirección de entrega",
    );
  }

  return { fullName, phone, fulfillment: "delivery", address, notes };
};

/** El teléfono del negocio no se corrige desde acá: el error es para el encargado. */
const validateBusiness = (business: WhatsAppBusiness): WhatsAppBusiness => {
  const name = cleanText(business.name);

  if (name.length === 0) {
    throw new ValidationError(
      { businessName: ["El negocio no tiene nombre configurado."] },
      "Negocio sin configurar",
    );
  }

  const digits = sanitizePhoneDigits(business.whatsappPhone);
  if (!isE164Phone(digits)) {
    throw new ValidationError(
      {
        whatsappPhone: [
          "El número de WhatsApp del local no está bien configurado. Corregilo en Ajustes.",
        ],
      },
      "Número de WhatsApp inválido",
    );
  }

  return { name, whatsappPhone: digits };
};

/** Arma el mensaje con el detalle del truncado. La Tarea 13 la usa para
 * avisar; `buildWhatsAppMessage` es el caso común (solo el string). */
export const buildWhatsAppOrder = (input: BuildWhatsAppMessageInput): WhatsAppOrderMessage => {
  if (input.items.length === 0) {
    // Un string vacío rompería el deep-link (`wa.me?text=`): lo frena acá.
    throw new ValidationError(
      { cart: [PROTOTYPE_CONFIG.messages.cartEmpty] },
      "No hay productos para enviar",
    );
  }

  return buildFittingMessage({
    variant: input.variant ?? DEFAULT_MESSAGE_VARIANT,
    items: input.items.map(validateLine),
    customer: validateCustomer(input.customer),
    business: validateBusiness(input.business),
  });
};

/** El producto final del proyecto: el texto que llega al chat. */
export const buildWhatsAppMessage = (input: BuildWhatsAppMessageInput): string =>
  buildWhatsAppOrder(input).text;
