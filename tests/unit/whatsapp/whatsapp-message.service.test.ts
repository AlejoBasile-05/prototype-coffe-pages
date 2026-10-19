import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/domain";
import type { BuildWhatsAppMessageInput, WhatsAppCartLine } from "@/lib/whatsapp/message-contract";
import { MAX_MESSAGE_LENGTH } from "@/lib/whatsapp/message-truncation";
import { buildWhatsAppMessage, buildWhatsAppOrder } from "@/lib/whatsapp/whatsapp-message.service";

const BUSINESS = { name: "Mi Negocio", whatsappPhone: "5492615551234" } as const;

const customer = (overrides: Partial<BuildWhatsAppMessageInput["customer"]> = {}) => ({
  fullName: "Juan Pérez",
  phone: "2615551234",
  fulfillment: "pickup" as const,
  address: null,
  notes: null,
  ...overrides,
});

const line = (overrides: Partial<WhatsAppCartLine> = {}): WhatsAppCartLine => ({
  productId: "p1",
  name: "Classic Jamón y Queso",
  variantName: null,
  unitPrice: 1450,
  quantity: 1,
  ...overrides,
});

describe("buildWhatsAppMessage", () => {
  it("debe armar la Variante C con los literales de la Tarea 00", () => {
    const message = buildWhatsAppMessage({
      items: [
        line({ quantity: 2 }),
        line({ productId: "p2", name: "Bebida Coca 500ml", unitPrice: 800 }),
      ],
      customer: customer({ fulfillment: "delivery", address: "San Rafael, Av. San Martín 1234" }),
      business: BUSINESS,
    });

    expect(message).toBe(
      [
        "¡Hola! Quiero hacer un pedido en *Mi Negocio*:",
        "",
        "• 2 x Classic Jamón y Queso — $2.900",
        "• 1 x Bebida Coca 500ml — $800",
        "",
        "*Total: $3.700*",
        "",
        "*Mis datos:*",
        "Nombre: Juan Pérez",
        "Teléfono: 5492615551234",
        "Entrega en: San Rafael, Av. San Martín 1234",
        "",
        "¡Gracias!",
      ].join("\n"),
    );
  });

  it("debe escribir Retiro en el local y omitir la dirección cuando es retiro", () => {
    const message = buildWhatsAppMessage({
      items: [line()],
      customer: customer(),
      business: BUSINESS,
    });

    expect(message).toContain("Retiro en el local");
    expect(message).not.toContain("Entrega en:");
  });

  it("debe conservar los acentos sin romper el mensaje", () => {
    const message = buildWhatsAppMessage({
      items: [line({ name: "Ñoqui de queso gratinado" })],
      customer: customer(),
      business: BUSINESS,
    });

    expect(message).toContain("Ñoqui de queso gratinado");
    expect(message).not.toContain("\\u00f1");
  });

  it("debe sacar el asterisco del texto del cliente para no romper las negritas", () => {
    const message = buildWhatsAppMessage({
      items: [line({ name: "Miga *Premium*" })],
      customer: customer({ notes: "sin *mayonesa*" }),
      business: BUSINESS,
    });

    expect(message).toContain("Miga Premium");
    expect(message).toContain("Comentarios: sin mayonesa");
  });

  it("debe borrar los caracteres de control y las marcas bidireccionales", () => {
    const nul = String.fromCharCode(0);
    const bidi = String.fromCharCode(0x202e);
    const message = buildWhatsAppMessage({
      items: [line({ name: `Miga${nul}Premium${bidi}` })],
      customer: customer({ fullName: `Juan${nul} Pérez` }),
      business: BUSINESS,
    });

    expect(message).not.toContain(nul);
    expect(message).not.toContain(bidi);
  });

  it("debe incluir la variante entre paréntesis en la línea", () => {
    const message = buildWhatsAppMessage({
      items: [line({ variantName: "Doble" })],
      customer: customer(),
      business: BUSINESS,
    });

    expect(message).toContain("1 x Classic Jamón y Queso (Doble)");
  });

  it("debe tratar una variante vacía como si no hubiera variante", () => {
    const message = buildWhatsAppMessage({
      items: [line({ variantName: "" })],
      customer: customer(),
      business: BUSINESS,
    });

    expect(message).not.toContain("()");
  });

  it("debe lanzar ValidationError con un carrito vacío, sin devolver un string vacío", () => {
    expect(() =>
      buildWhatsAppMessage({ items: [], customer: customer(), business: BUSINESS }),
    ).toThrow(ValidationError);
  });

  it("debe sumar el total con roundCurrency, sin residuo de punto flotante", () => {
    const order = buildWhatsAppOrder({
      items: [
        line({ productId: "a", unitPrice: 0.1, quantity: 1 }),
        line({ productId: "b", unitPrice: 0.1, quantity: 1 }),
        line({ productId: "c", unitPrice: 0.1, quantity: 1 }),
      ],
      customer: customer(),
      business: BUSINESS,
    });

    // Sin `roundCurrency`, la suma da 0.30000000000000004.
    expect(order.total).toBe(0.3);
    expect(order.text).toContain("*Total: $0,30*");
  });

  it("debe recortar las notas primero y decirlo en el mensaje", () => {
    const order = buildWhatsAppOrder({
      items: [line()],
      customer: customer({ notes: "a".repeat(MAX_MESSAGE_LENGTH) }),
      business: BUSINESS,
    });

    expect(order.isTruncated).toBe(true);
    expect(order.hasNotes).toBe(false);
    expect(order.text).toContain("no entran en el mensaje");
  });

  it("debe avisar que el total es parcial cuando descarta ítems", () => {
    const order = buildWhatsAppOrder({
      items: Array.from({ length: 30 }, (_, index) =>
        line({
          productId: `p${index}`,
          name: `Sándwich de jamón y queso con tomate y palta ${index}`,
          unitPrice: 1000,
          quantity: 1,
        }),
      ),
      customer: customer(),
      business: BUSINESS,
    });

    expect(order.isTruncated).toBe(true);
    expect(order.omittedItemCount).toBeGreaterThan(0);
    expect(order.text).toContain("el total es parcial");
  });

  it("debe recortar solo el nombre del producto y jamás un precio", () => {
    const order = buildWhatsAppOrder({
      items: [line({ name: "Sándwich ".repeat(300), unitPrice: 1450, quantity: 1 })],
      customer: customer(),
      business: BUSINESS,
    });

    expect(order.text).toContain("Sándwich Sándwich Sándwich Sándwich Sándwich Sándwich Sándw…");
    expect(order.text).toContain("— $1.450");
    // El nombre recortado tiene su propio aviso: el del "total parcial"
    // se reserva para los ítems que quedaron afuera.
    expect(order.omittedItemCount).toBe(0);
    expect(order.text).toContain("va recortado");
    expect(order.text).not.toContain("el total es parcial");
    expect(order.text.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
  });

  it("debe quitar las notas del mensaje cuando avisa que no entran", () => {
    const notas = "Sin mayonesa, sin cebolla, con la salsa aparte. ".repeat(40);
    const order = buildWhatsAppOrder({
      items: Array.from({ length: 8 }, (_, index) =>
        line({ productId: `p${index}`, name: `Sándwich ${index}`, unitPrice: 1000, quantity: 1 }),
      ),
      customer: customer({ notes: notas }),
      business: BUSINESS,
    });

    expect(order.isTruncated).toBe(true);
    expect(order.hasNotes).toBe(false);
    expect(order.text).toContain("no entran en el mensaje");
    // ⛔ El aviso y el texto de las notas no pueden estar los dos: el
    // aviso sería falso.
    expect(order.text).not.toContain("sin la salsa aparte");
  });

  it("debe dejar intacto un nombre largo que entra sin recorte", () => {
    const name = "Sándwich ".repeat(40);

    const order = buildWhatsAppOrder({
      items: [line({ name, unitPrice: 1450, quantity: 1 })],
      customer: customer(),
      business: BUSINESS,
    });

    expect(order.isTruncated).toBe(false);
    expect(order.text).toContain(name.trimEnd());
  });

  it("debe no truncar un mensaje que entra justo en el límite", () => {
    // El caso del borde se prueba con el valor real del renderer, no con
    // un número inventado.
    const base = buildWhatsAppMessage({
      items: [line()],
      customer: customer(),
      business: BUSINESS,
    });
    const relleno = "x".repeat(MAX_MESSAGE_LENGTH - base.length);

    const justo = buildWhatsAppOrder({
      items: [line({ name: `Classic Jamón y Queso${relleno}` })],
      customer: customer(),
      business: BUSINESS,
    });

    expect(justo.text.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    expect(justo.isTruncated).toBe(false);
  });

  it("debe informar hasNotes en false con la variante detailed aunque el cliente mande notas", () => {
    // `detailed` no tiene línea de comentarios: informar `true` sería
    // una mentira sobre lo que se mandó.
    const order = buildWhatsAppOrder({
      items: [line()],
      customer: customer({ notes: "sin mayonesa" }),
      business: BUSINESS,
      variant: "detailed",
    });

    expect(order.hasNotes).toBe(false);
    expect(order.text).not.toContain("sin mayonesa");
  });

  it("debe sostener treinta líneas sin desbordar el límite", () => {
    const order = buildWhatsAppOrder({
      items: Array.from({ length: 30 }, (_, index) =>
        line({
          productId: `p${index}`,
          name: `Sándwich de la casa ${index}`,
          unitPrice: 2500,
          quantity: 1,
        }),
      ),
      customer: customer(),
      business: BUSINESS,
    });

    expect(order.text.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    expect(order.total).toBe(75000);
  });

  it("debe rechazar una cantidad fuera de rango", () => {
    expect(() =>
      buildWhatsAppMessage({
        items: [line({ quantity: 0 })],
        customer: customer(),
        business: BUSINESS,
      }),
    ).toThrow(ValidationError);
  });

  it("debe rechazar una cantidad mayor al tope del carrito", () => {
    expect(() =>
      buildWhatsAppMessage({
        items: [line({ quantity: 9999 })],
        customer: customer(),
        business: BUSINESS,
      }),
    ).toThrow(ValidationError);
  });

  it("debe rechazar un precio negativo o no finito", () => {
    expect(() =>
      buildWhatsAppMessage({
        items: [line({ unitPrice: -1 })],
        customer: customer(),
        business: BUSINESS,
      }),
    ).toThrow(ValidationError);
    expect(() =>
      buildWhatsAppMessage({
        items: [line({ unitPrice: Number.NaN })],
        customer: customer(),
        business: BUSINESS,
      }),
    ).toThrow(ValidationError);
  });

  it("debe rechazar un nombre de cliente demasiado corto", () => {
    expect(() =>
      buildWhatsAppMessage({
        items: [line()],
        customer: customer({ fullName: "J" }),
        business: BUSINESS,
      }),
    ).toThrow(ValidationError);
  });

  it("debe exigir la dirección cuando la entrega es a domicilio", () => {
    expect(() =>
      buildWhatsAppMessage({
        items: [line()],
        customer: customer({ fulfillment: "delivery", address: "corta" }),
        business: BUSINESS,
      }),
    ).toThrow(ValidationError);
  });

  it("debe rechazar el teléfono del negocio mal configurado con la clave whatsappPhone", () => {
    expect.assertions(2);
    try {
      buildWhatsAppMessage({
        items: [line()],
        customer: customer(),
        business: { name: "Mi Negocio", whatsappPhone: "261555" },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(Object.keys(error.fieldErrors)).toContain("whatsappPhone");
      }
    }
  });

  it("debe usar la variante que le piden, no la de default", () => {
    // Cantidad 2: el total ($2.900) no puede confundirse con el precio
    // de la línea ($1.450) en la variante sin precios por ítem.
    const minimal = buildWhatsAppMessage({
      items: [line({ quantity: 2 })],
      customer: customer(),
      business: BUSINESS,
      variant: "minimal",
    });
    const detailed = buildWhatsAppMessage({
      items: [line({ quantity: 2 })],
      customer: customer(),
      business: BUSINESS,
      variant: "detailed",
    });

    expect(minimal).not.toContain("¡Gracias!");
    // La variante B no lleva precio por línea: el único precio es el total.
    expect(minimal).toContain("2 x Classic Jamón y Queso");
    expect(minimal).not.toContain("2 x Classic Jamón y Queso — $2.900");
    expect(minimal).toContain("Total: $2.900");
    expect(detailed).toContain("¡Gracias!");
    expect(detailed).toContain("• 2 x Classic Jamón y Queso — $2.900");
  });
});
