/**
 * Orquestador del seed de DEMO (scripts/sembrar-demo-mock.ts).
 *
 * Reutiliza los DATOS del seed oficial (`PRODUCTOS_SEED`, `CATEGORIAS_SEED`)
 * pero con dos diferencias deliberadas respecto al seed de la Tarea 05:
 *
 *  1. Los productos nacen en PUBLISHED: el propósito del script es ver la
 *     web funcionando. El seed oficial los deja en DRAFT salvo flag porque
 *     es la herramienta de arranque de ambientes; este script es solo de
 *     demo local y su entry point ya trae la guarda de producción.
 *
 *  2. NO toca `business_settings` salvo por un MERGE parcial de
 *     `openingHours` (y `closingMessage` solo si está vacío): el WhatsApp
 *     y el resto de los campos se preservan. Tampoco crea administradores:
 *     requiere credenciales de servicio que la demo no necesita (el panel
 *     queda fuera de alcance).
 *
 * Idempotente por slug, igual que el seed oficial.
 */
import { toCanonicalAllergen, type Allergen } from "../../src/lib/domain/allergens";
import {
  createCategory,
  findAllCategoriesForAdmin,
} from "../../src/server/repositories/category.repository";
import {
  createProduct,
  findAllProductsForAdmin,
} from "../../src/server/repositories/product.repository";
import {
  findBusinessSettings,
  saveBusinessSettings,
} from "../../src/server/repositories/settings.repository";

import { CATEGORIAS_SEED } from "./categorias.seed";
import { HORARIOS_DEMO, MENSAJE_CIERRE_DEMO } from "./negocio.seed";
import { PRODUCTOS_SEED, buildImagenDeRelleno, imageSampleFor } from "./productos.seed";

/**
 * MERGE parcial de settings: pisa SOLO `openingHours` con el set de demo
 * (Mar–Jue 08:30–20:30, Vie–Sáb hasta 22:30, Dom 09–13, Lun cerrado) y
 * completa `closingMessage` si está vacío. El resto de la fila —el
 * WhatsApp real incluido— queda intacto: este script es de demo, no de
 * provisión de negocio.
 *
 * Idempotente: dos corridas dejan el mismo estado.
 */
const sembrarHorariosDemo = async (): Promise<void> => {
  const actuales = await findBusinessSettings();

  await saveBusinessSettings({
    ...actuales,
    openingHours: { ...HORARIOS_DEMO },
    closingMessage:
      actuales.closingMessage === null || actuales.closingMessage === ""
        ? MENSAJE_CIERRE_DEMO
        : actuales.closingMessage,
  });

  console.log("[demo] business_settings: openingHours actualizados (merge parcial).");
};

export const ejecutarSeedDemo = async (): Promise<void> => {
  await sembrarHorariosDemo();

  const categoriasExistentes = new Map(
    (await findAllCategoriesForAdmin()).map((categoria) => [categoria.slug, categoria]),
  );

  let categoriasCreadas = 0;
  const idsPorSlug = new Map<string, string>();

  for (const categoria of CATEGORIAS_SEED) {
    const existente = categoriasExistentes.get(categoria.slug);
    if (existente !== undefined) {
      idsPorSlug.set(categoria.slug, existente.id);
      continue;
    }
    const creada = await createCategory({
      name: categoria.name,
      slug: categoria.slug,
      description: categoria.description,
      position: categoria.position,
      isVisible: categoria.isVisible,
    });
    idsPorSlug.set(categoria.slug, creada.id);
    categoriasCreadas += 1;
  }
  console.log(
    `[demo] Categorías: ${categoriasCreadas} creadas, ${CATEGORIAS_SEED.length - categoriasCreadas} ya existían.`,
  );

  const productosExistentes = new Map(
    (await findAllProductsForAdmin()).map((producto) => [producto.slug, producto]),
  );
  const yaPublicados = [...productosExistentes.values()].filter(
    (producto) => producto.status === "PUBLISHED",
  ).length;

  let productosCreados = 0;
  let alergenosDescartados = 0;

  for (const [index, producto] of PRODUCTOS_SEED.entries()) {
    if (productosExistentes.has(producto.slug)) continue;

    const categoryId = idsPorSlug.get(producto.categorySlug);
    if (categoryId === undefined) {
      console.error(
        `[demo] Producto "${producto.slug}": categoría "${producto.categorySlug}" inexistente, se omite.`,
      );
      continue;
    }

    const allergens = producto.allergens
      .map((valor) => toCanonicalAllergen(valor))
      .filter((valor): valor is Allergen => valor !== null);
    alergenosDescartados += producto.allergens.length - allergens.length;

    await createProduct({
      name: producto.name,
      slug: producto.slug,
      description: producto.description,
      price: producto.price,
      imageUrl: buildImagenDeRelleno(imageSampleFor(index)),
      // null a propósito: el asset de relleno es de la nube `demo` pública
      // de Cloudinary; no hay nada que destruir al reemplazar la foto.
      imagePublicId: null,
      categoryId,
      status: "PUBLISHED",
      isFeatured: producto.isFeatured,
      isAvailable: true,
      allergens,
      sortOrder: producto.sortOrder,
    });
    productosCreados += 1;
  }

  console.log(
    `[demo] Productos: ${productosCreados} creados (PUBLISHED), ` +
      `${PRODUCTOS_SEED.length - productosCreados} ya existían (${yaPublicados} publicados).`,
  );
  if (alergenosDescartados > 0) {
    console.warn(`[demo] ⚠️ ${alergenosDescartados} alérgenos fuera del glosario, descartados.`);
  }
  console.log(
    "[demo] Listo. Recordatorio: los productos son MOCK (precios inventados, imágenes de la nube demo " +
      "pública de Cloudinary). Antes de publicar el sitio, reemplazarlos (menú-maestro §0).",
  );
};
