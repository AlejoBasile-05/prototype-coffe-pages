/**
 * Acceso a datos de la configuración del negocio (tabla singleton).
 *
 * La base refuerza el singleton con `CHECK (id = '1')` (Tarea 03 §13);
 * este repositorio lee y escribe siempre la fila `"1"`.
 */
import "server-only";

import { prisma } from "@/server/infra/prisma";
import { PROTOTYPE_CONFIG } from "@/config/prototype";
import type { BusinessSettingsDTO, OpeningHours } from "@/lib/domain";

/** Id de la fila singleton. La base lo refuerza con una CHECK. */
const SINGLETON_ID = "1";

/**
 * Valores por defecto si la fila singleton no existe.
 *
 * Una base recién migrada no tiene esta fila hasta que corre el seed
 * (Tarea 05). Los servicios deben ser resilientes a esa ausencia en lugar
 * de romper el catálogo entero.
 *
 * ⚠️ `whatsappPhone` es un placeholder NO asignado (misma regla que los
 * datos MOCK de la Tarea 00): si estaerte valor llegara a producción, un
 * pedido se mandaría a un número ajeno. La Tarea 21 valida el teléfono
 * real antes del deploy.
 */
export const DEFAULT_BUSINESS_SETTINGS: BusinessSettingsDTO = {
  name: PROTOTYPE_CONFIG.brand.name,
  whatsappPhone: "5492610000000",
  address: null,
  instagramUrl: null,
  openingHours: {},
  closingMessage: null,
  legalNotice: null,
};

const SETTINGS_SELECT = {
  name: true,
  whatsappPhone: true,
  address: true,
  instagramUrl: true,
  openingHours: true,
  closingMessage: true,
  legalNotice: true,
} as const;

/** Lector del singleton. Nunca lanza: devuelve defaults si falta la fila. */
export const findBusinessSettings = async (): Promise<BusinessSettingsDTO> => {
  const settings = await prisma.businessSettings.findUnique({
    where: { id: SINGLETON_ID },
    select: SETTINGS_SELECT,
  });

  if (!settings) {
    console.warn(
      "[settings] No existe la fila business_settings (id=1). Se usan los valores por defecto. Ejecutar el seed.",
    );
    return DEFAULT_BUSINESS_SETTINGS;
  }

  return {
    ...settings,
    // `openingHours` es Json en Postgres → `unknown` en TypeScript.
    // Se valida con un type guard en lugar de castear a ciegas.
    openingHours: parseOpeningHours(settings.openingHours),
  };
};

export interface SaveBusinessSettingsInput {
  readonly name: string;
  readonly whatsappPhone: string;
  readonly address: string | null;
  readonly instagramUrl: string | null;
  readonly openingHours: OpeningHours;
  readonly closingMessage: string | null;
  readonly legalNotice: string | null;
}

/** `upsert` porque la fila singleton puede no existir todavía. */
export const saveBusinessSettings = async (
  input: SaveBusinessSettingsInput,
): Promise<BusinessSettingsDTO> => {
  const settings = await prisma.businessSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...input },
    update: { ...input },
    select: SETTINGS_SELECT,
  });

  return { ...settings, openingHours: parseOpeningHours(settings.openingHours) };
};

/**
 * Type guard para el campo `Json`.
 *
 * Postgres no garantiza la forma de un jsonb. Sin esta validación, un
 * `openingHours` corrupto rompería el catálogo en runtime con un error
 * difícil de rastrear. Ante la duda, degrada a vacío (Tarea 04 §9).
 */
const parseOpeningHours = (value: unknown): OpeningHours => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as OpeningHours;
};
