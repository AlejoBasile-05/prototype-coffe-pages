import { describe, expect, it } from "vitest";

import { buildProductJsonLd, buildRestaurantJsonLd, serializeJsonLd } from "@/lib/domain/schema-org";
import type { BusinessSettingsDTO } from "@/lib/domain";

const SITE = "https://modo-miga.com.ar";

const AJUSTES_COMPLETOS: BusinessSettingsDTO = {
  name: "Mi Negocio San Rafael",
  whatsappPhone: "5492615551234",
  address: "Belgrano 1234, San Rafael",
  instagramUrl: "https://instagram.com/modomiga",
  openingHours: {
    monday: null,
    tuesday: { opens: "09:00", closes: "21:00" },
    wednesday: { opens: "09:00", closes: "21:00" },
    thursday: { opens: "09:00", closes: "21:00" },
    friday: { opens: "09:00", closes: "22:00" },
    saturday: { opens: "09:00", closes: "22:00" },
    sunday: { opens: "10:00", closes: "20:00" },
  },
  closingMessage: "Cerrado los lunes.",
  legalNotice: null,
};

describe("JSON-LD", () => {
  it("debe serializar el contenido y escapar los divisores de tag", () => {
    const salida = serializeJsonLd({
      name: "Jamon </script><script>alert(1)</script>",
    });

    expect(salida).not.toContain("<");
    expect(salida).toContain("\\u003c");
    expect(JSON.parse(salida)).toEqual({
      name: "Jamon </script><script>alert(1)</script>",
    });
  });

  it("debe construir el Restaurant con los datos del negocio", () => {
    const resultado = buildRestaurantJsonLd({
      settings: AJUSTES_COMPLETOS,
      siteUrl: SITE,
      imageUrl: "https://res.cloudinary.com/demo/x.jpg",
      locality: "San Rafael",
      region: "Mendoza",
      country: "AR",
    });

    expect(resultado).not.toBeNull();
    expect(resultado?.name).toBe("Mi Negocio San Rafael");
    expect(resultado?.telephone).toBe("+5492615551234");
    expect(resultado?.sameAs).toEqual(["https://instagram.com/modomiga"]);
    expect(resultado?.url).toBe("https://modo-miga.com.ar/");
    expect(resultado?.menu).toBe("https://modo-miga.com.ar/menu");
  });

  it("omite los días sin horario (null y ausente) de openingHoursSpecification", () => {
    const construido = buildRestaurantJsonLd({
      settings: AJUSTES_COMPLETOS,
      siteUrl: SITE,
      imageUrl: "https://res.cloudinary.com/demo/x.jpg",
      locality: "San Rafael",
      region: "Mendoza",
      country: "AR",
    });

    // El lunes es null en el DTO: no se publica. El array tiene a los
    // seis días que sí cargaron.
    const spec = construido?.openingHoursSpecification ?? [];
    expect(spec).toHaveLength(6);
    expect(JSON.stringify(construido)).not.toContain("Monday");
  });

  it("omite openingHoursSpecification si ningún día está informado", () => {
    const sinHorarios = {
      ...AJUSTES_COMPLETOS,
      openingHours: {
        monday: null,
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null,
        saturday: null,
        sunday: null,
      },
    };

    const construido = buildRestaurantJsonLd({
      settings: sinHorarios,
      siteUrl: SITE,
      imageUrl: "https://res.cloudinary.com/demo/x.jpg",
      locality: "San Rafael",
      region: "Mendoza",
      country: "AR",
    });

    // La clave no existe: Google listaría "abierto los 6 días" si quedara.
    expect(construido).not.toBeNull();
    expect(JSON.stringify(construido)).not.toContain("openingHoursSpecification");
  });

  it("no publica un restaurante cuando dirección o Instagram están de relleno", () => {
    const conPlaceholder = {
      ...AJUSTES_COMPLETOS,
      address: "Dirección pendiente",
      instagramUrl: null,
    };

    expect(
      buildRestaurantJsonLd({
        settings: conPlaceholder,
        siteUrl: SITE,
        imageUrl: "https://res.cloudinary.com/demo/x.jpg",
        locality: "San Rafael",
        region: "Mendoza",
        country: "AR",
      }),
    ).toBeNull();
  });

  it("debe construir el Product con precio y disponibilidad", () => {
    const resultado = buildProductJsonLd(
      {
        slug: "cafe-con-leche",
        name: "Café con leche",
        description: "Café con leche caliente",
        price: 1450.5,
        imageUrl: "https://res.cloudinary.com/demo/foto.jpg",
        isAvailable: true,
      },
      SITE,
    );

    expect(resultado.name).toBe("Café con leche");
    expect(resultado.offers).toMatchObject({
      "@type": "Offer",
      price: 1450.5,
      priceCurrency: "ARS",
      availability: "https://schema.org/InStock",
    });
    expect(resultado.url).toBe("https://modo-miga.com.ar/producto/cafe-con-leche");
  });

  it("debe omitir la descripción cuando el producto la tiene en null", () => {
    const resultado = buildProductJsonLd(
      {
        slug: "x",
        name: "Sin desc",
        description: null,
        price: 100,
        imageUrl: "https://res.cloudinary.com/demo/foto.jpg",
        isAvailable: true,
      },
      SITE,
    );

    expect(JSON.stringify(resultado)).not.toContain("description");
  });

  it("debe marcar OutOfStock para un producto agotado", () => {
    const resultado = buildProductJsonLd(
      {
        slug: "agotado",
        name: "Agotado",
        description: null,
        price: 500,
        imageUrl: "https://res.cloudinary.com/demo/foto.jpg",
        isAvailable: false,
      },
      SITE,
    );

    expect(resultado.offers.availability).toBe("https://schema.org/OutOfStock");
  });
});
