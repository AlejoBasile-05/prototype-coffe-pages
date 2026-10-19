/**
 * Datos estructurados de schema.org (Tarea 18 §6.7).
 *
 * ⛔ Módulo puro: sin React, sin Next, sin `process.env`, sin I/O. Los
 *    valores `siteUrl` y `imageUrl` llegan como argumentos.
 *
 * ⛔ Los campos ausentes se **omitien**, no se mandan como `""` ni como
 *    `null`: Google ignora las claves vacías y algunos validadores las
 *    marcan como error (§5.1).
 */
import { WEEKDAY_KEYS } from "@/lib/domain";
import { absoluteUrl } from "@/lib/domain/seo";
import type { BusinessSettingsDTO, WeekdayKey } from "@/lib/domain";

export interface OpeningHoursSpecification {
  readonly "@type": "OpeningHoursSpecification";
  readonly dayOfWeek: readonly string[];
  readonly opens: string;
  readonly closes: string;
}

export interface JsonLdRestaurant {
  readonly "@context": "https://schema.org";
  readonly "@type": "Restaurant";
  readonly name: string;
  readonly url: string;
  readonly image: string;
  readonly telephone: string;
  readonly address: {
    readonly "@type": "PostalAddress";
    readonly streetAddress: string;
    readonly addressLocality: string;
    readonly addressRegion: string;
    readonly addressCountry: string;
  };
  readonly sameAs: readonly string[];
  /** ⛔ Los días cerrados no aparecen (§5.3). La clave existe sólo si hay franjas. */
  readonly openingHoursSpecification?: readonly OpeningHoursSpecification[];
  readonly servesCuisine: string;
  readonly menu: string;
  readonly hasMenu: string;
}

export interface JsonLdProductInput {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly price: number;
  readonly imageUrl: string;
  readonly isAvailable: boolean;
}

export interface JsonLdProduct {
  readonly "@context": "https://schema.org";
  readonly "@type": "Product";
  readonly name: string;
  /** ⛔ Omisión a propósito si no hay descripción (§5.1). */
  readonly description?: string;
  readonly image: string;
  readonly url: string;
  readonly offers: {
    readonly "@type": "Offer";
    readonly price: number;
    readonly priceCurrency: "ARS";
    readonly availability: string;
    readonly url: string;
  };
}

export interface RestaurantJsonLdInput {
  readonly settings: BusinessSettingsDTO;
  readonly siteUrl: string;
  readonly imageUrl: string;
  readonly locality: string;
  readonly region: string;
  readonly country: string;
}

/** Día en schema.org. El vocabulario es dominio, no inglés creepypasta. */
const SCHEMA_DAY: Readonly<Record<WeekdayKey, string>> = {
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
  sunday: "https://schema.org/Sunday",
};

/**
 * ⛔ El resultado puede ser `null`: con datos de relleno no se publica
 *    un `Restaurant` a medio llenar, porque la credibilidad de Google es
 *    peor que el posicionamiento (§2.7 y §9.2).
 */
export const buildRestaurantJsonLd = (input: RestaurantJsonLdInput): JsonLdRestaurant | null => {
  const { settings } = input;
  if (settings.address === null || settings.instagramUrl === null) return null;

  const menu = absoluteUrl("/menu", input.siteUrl);
  const horarios = buildOpeningHours(settings);

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: settings.name,
    url: absoluteUrl("/", input.siteUrl),
    image: input.imageUrl,
    telephone: `+${settings.whatsappPhone}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address,
      addressLocality: input.locality,
      addressRegion: input.region,
      addressCountry: input.country,
    },
    sameAs: [settings.instagramUrl],
    ...(horarios.length === 0 ? {} : { openingHoursSpecification: horarios }),
    servesCuisine: "Sándwiches de miga",
    menu,
    hasMenu: menu,
  };
};

const buildOpeningHours = (settings: BusinessSettingsDTO): readonly OpeningHoursSpecification[] =>
  WEEKDAY_KEYS.flatMap((key) => {
    const franja = settings.openingHours[key];
    if (franja === null || franja === undefined) return [];
    return [
      {
        "@type": "OpeningHoursSpecification" as const,
        dayOfWeek: [SCHEMA_DAY[key]],
        opens: franja.opens,
        closes: franja.closes,
      },
    ];
  });

/**
 * Producto con `Offer`.
 *
 * ⛔ La descripción vacía NO sale de la clave: el estándar espera un
 *    texto real, y un `""` no es nada para el buscador (§5.1).
 */
export const buildProductJsonLd = (product: JsonLdProductInput, siteUrl: string): JsonLdProduct => {
  const url = absoluteUrl(`/producto/${product.slug}`, siteUrl);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description === null ? {} : { description: product.description }),
    image: product.imageUrl,
    url,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "ARS",
      availability: product.isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url,
    },
  };
};

/**
 * ⛔ El `<script>` se arma con `JSON.stringify`, nunca por string
 *    concatenado. Y antes de ese paso escapa los caracteres que cierran
 *    el tag del JSON-LD: un producto llamado `<script>alert(1)</script>`
 *    cierra el tag sin escape y el código corre. Ver §2.7.
 */
export const serializeJsonLd = (value: object): string =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
