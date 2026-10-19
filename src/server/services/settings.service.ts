/**
 * Orquestación de lectura y escritura de los ajustes del negocio.
 *
 * Las funciones puras de saneado viven en `@/lib/validation/ajustes` (capa 0
 * friendly, sin I/O). Acá vive el cableado.
 */
import "server-only";

import type { BusinessSettingsDTO } from "@/lib/domain";
import type { SaveBusinessSettingsInput, SettingsReader, SettingsWriter } from "./repository-ports";
import {
  isSettingsConfigured,
  normalizeArgentinePhone,
  normalizeBusinessSettings,
} from "@/lib/validation/ajustes";

/** Aviso único para los dos caminos: la fila no existe o el número es de relleno. */
const warnAboutPlaceholderPhone = (): void => {
  console.warn(
    "[settings] El número de WhatsApp es el de relleno. Configuralo en /admin/ajustes antes de recibir pedidos.",
  );
};

/**
 * Ajustes del negocio, normalizados y **sin caché**.
 *
 * Por qué sin caché (DESIGN.md §6.1): es una lectura de una sola fila por
 * clave primaria, de ocho columnas. Meterla en la caché obligaría a sumar
 * un tag, una invalidación y una clase de bug nueva, a cambio de ahorrar
 * unos milisegundos que nadie nota. El contenido del catálogo, que sí se
 * cachea, son veinte a cuarenta filas.
 *
 * ⚠️ `findBusinessSettings` ya devuelve los defaults y hace su
 * `console.warn` cuando la fila no existe. Este servicio no reimplementa
 * nada de eso: solo agrega el aviso que es de negocio (el número de
 * WhatsApp sigue siendo el de relleno) y propaga cualquier error de red,
 * no lo disimula con defaults inventados.
 */
export const getBusinessSettings = async (dependencies: {
  readonly settingsRepository: SettingsReader;
}): Promise<BusinessSettingsDTO> => {
  const settings = normalizeBusinessSettings(
    await dependencies.settingsRepository.findBusinessSettings(),
  );

  if (!isSettingsConfigured(settings)) warnAboutPlaceholderPhone();

  return settings;
};

/**
 * Guarda los ajustes del negocio.
 *
 * El input ya viene validado por Zod desde el Server Action (Tarea 17).
 * Acá solo se normaliza, porque `wa.me` es intolerante con los formatos
 * y un `+54 261…` guardado tal cual rompe el enlace del checkout.
 *
 * ⛔ No envuelve la escritura en `try/catch`: un `ConflictError` del
 * repositorio tiene que llegar al Server Action para mostrarse junto al
 * campo. Capturarlo devolvería un "guardado con éxito" falso.
 */
export const updateBusinessSettings = async (
  dependencies: { readonly settingsRepository: SettingsWriter },
  input: SaveBusinessSettingsInput,
): Promise<BusinessSettingsDTO> => {
  const normalized = normalizeBusinessSettings({
    name: input.name,
    whatsappPhone: normalizeArgentinePhone(input.whatsappPhone),
    address: input.address,
    instagramUrl: input.instagramUrl,
    openingHours: input.openingHours,
    closingMessage: input.closingMessage,
    legalNotice: input.legalNotice,
  });

  const saved = await dependencies.settingsRepository.saveBusinessSettings(normalized);

  if (!isSettingsConfigured(saved)) warnAboutPlaceholderPhone();

  return saved;
};
