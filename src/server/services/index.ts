/**
 * Composition root de la capa de servicio.
 *
 * Cablea los repositorios concretos (capa 4) con los servicios (capa 3)
 * una sola vez por import. Las rutas importan de acá y NO conocen los
 * repositorios:
 * `rg "server/repositories" src/app src/components` → cero.
 *
 * ⛔ Es el ÚNICO archivo del proyecto que importa repositorios para armar
 *    servicios. Los tests unitarios de los servicios corren sin base de
 *    datos porque el servicio recibe sus dependencias por parámetro y el
 *    cableado ocurre acá, una sola vez.
 *
 * ⚠️ Los nombres públicos coinciden con los del servicio a propósito. Quien
 *    importa de `@/server/services` nunca ve los parámetros de inyección;
 *    quien testea el servicio sí. Un archivo, dos formas de entrar, sin un
 *    `index.ts` que reexporte y esconda de dónde salen las cosas.
 */
import "server-only";

import type {
  BusinessSettingsDTO,
  CartLineReference,
  CartValidationResult,
  CatalogDTO,
  CategoryDTO,
  ProductDTO,
  ProductRow,
} from "@/lib/domain";
import * as categoryRepository from "@/server/repositories/category.repository";
import * as productRepository from "@/server/repositories/product.repository";
import type {
  CategoryAdminLister,
  CategoryAdminWriter,
  ProductAdminReader,
  ProductAdminPorts,
  ProductSitemapReader,
  SettingsWriter,
} from "./repository-ports";
import { readSitemapEntries } from "./seo.service";
import {
  createProductFromAdmin as crearProducto,
  updateProductFromAdmin as actualizarProducto,
  archiveProductFromAdmin as archivarProducto,
  camposEditadosDeProducto,
} from "./product-admin.service";
import { uploadProductImage, replaceProductImage } from "./image.service";
import type { ProductoAltaInput, ProductoEdicionInput } from "@/lib/validation/producto-admin";
import * as settingsRepository from "@/server/repositories/settings.repository";
import * as orderRepository from "@/server/repositories/order.repository";
import { listOrdersForBoard, registerCheckoutOrder } from "./order.service";
import type { RegisterOrderLine } from "./order.service";
import { transitionOrder } from "./order-admin.service";
import type { OrderDTO, OrderStatus } from "@/lib/domain";
import type { WhatsAppCustomer } from "@/lib/whatsapp/message-contract";

import { validateCartLines } from "./cart-validation.service";
import {
  getCatalogForPublic,
  getFeaturedProductsForPublic,
  getProductBySlugForPublic,
} from "./catalog.service";
import {
  getProductsForAdmin as readProductsForAdmin,
  setProductAvailability as writeProductAvailability,
  type SetProductAvailabilityInput,
} from "./product.service";
import { getBusinessSettings } from "./settings.service";

const readSettings = (): Promise<BusinessSettingsDTO> =>
  getBusinessSettings({ settingsRepository });

/** Catálogo público completo: secciones cacheadas por tag + ajustes. */
export function getPublicCatalog(): Promise<CatalogDTO> {
  return getCatalogForPublic({
    productRepository,
    categoryRepository,
    getBusinessSettings: readSettings,
  });
}

/**
 * Ficha pública de producto.
 *
 * ⚠️ Lanza `ResourceNotFoundError` si el slug no existe o no está
 * publicado: la página lo traduce a `notFound()`.
 */
export function getPublicProductBySlug(slug: string): Promise<ProductDTO> {
  return getProductBySlugForPublic({ productRepository }, slug);
}

/** Destacados de la home (ya filtrados a publicados). */
export function getPublicFeaturedProducts(limit = 4): Promise<readonly ProductDTO[]> {
  return getFeaturedProductsForPublic({ productRepository }, limit);
}

/** Ajustes del negocio normalizados. Sin caché, por diseño (Tarea 08). */
export function getPublicBusinessSettings(): Promise<BusinessSettingsDTO> {
  return readSettings();
}

/** Revalidación del carrito (Tarea 13): composition root del endpoint público. */
export function validatePublicCartLines(
  references: readonly CartLineReference[],
): Promise<CartValidationResult> {
  return validateCartLines({ productRepository }, references);
}

/**
 * Productos para la tabla del panel. Incluye `DRAFT` y `ARCHIVED`.
 *
 * ⛔ Sin caché: la lista está detrás de una sesión y el admin la cambia
 *    seguido. Los objetos que se pasan implementan SOLO el puerto que
 *    declara `product.service`: es la forma de dejar escrita la regla de
 *    ISP en el punto donde se cablea.
 */
export function getProductsForAdmin(): Promise<readonly ProductRow[]> {
  return readProductsForAdmin({
    productRepository: { findAllProductsForAdmin: productRepository.findAllProductsForAdmin },
    categoryRepository: {
      findAllCategoriesForAdmin: categoryRepository.findAllCategoriesForAdmin,
    },
  });
}

/**
 * Listado de categorías para el formulario de alta del panel.
 *
 * ⛔ Una lectura, no una transformación: el formulario no necesita saber
 *    que hay una tabla por categoría, y la dirección de dependencia
 *    (panel → servicio) deja a la capa de presentación sin recordar
 *    que debajo hay repositorios.
 */
export function getAllCategoriesForAdmin(): Promise<readonly CategoryDTO[]> {
  return categoryRepository.findAllCategoriesForAdmin();
}

/**
 * Un producto por id para la ruta de edición. Sin caché, igual que el
 * listado: es un dato que el panel acaba de cambiar.
 */
export async function getProductForAdminById(id: string): Promise<ProductDTO | null> {
  return productRepository.findProductByIdForAdmin(id);
}

/**
 * El bloque de escritura del panel (Tarea 16 §6.3).
 *
 * ⛔ ÚNICO archivo que junta el servicio con los repositorios (los tipos
 *    en `repository-ports.ts` los declara estructuralmente, y la capa 4
 *    los satisface por forma) y el servicio de imágenes (que sube a
 *    Cloudinary). Quien importa de `@/server/services` recibe funciones
 *    sin `deps` y nunca ve de dónde salen.
 */
const productAdminPorts: ProductAdminPorts = {
  productRepository: {
    createProduct: productRepository.createProduct,
    updateProduct: productRepository.updateProduct,
    archiveProduct: productRepository.archiveProduct,
    findProductByIdForAdmin: productRepository.findProductByIdForAdmin,
  },
  imageService: { uploadProductImage, replaceProductImage },
};

export function createProductFromAdmin(
  input: ProductoAltaInput,
  file: File | null,
): Promise<ProductDTO> {
  return crearProducto(productAdminPorts, input, file);
}

export function updateProductFromAdmin(
  input: ProductoEdicionInput,
  file: File | null,
): Promise<ProductDTO> {
  return actualizarProducto(productAdminPorts, input, file);
}

export function archiveProductFromAdmin(id: string): Promise<ProductDTO> {
  return archivarProducto(productAdminPorts, id);
}

/**
 * Qué campos del formulario quedaron distintos de lo guardado (Tarea 19
 * §7.1). Lo consume el log de `producto.actualizado`: los NOMBRES, nunca
 * los valores. Puro, sin dependencias inyectadas, así que va reexportado
 * tal cual.
 */
export { camposEditadosDeProducto };

/**
 * ⛔ ÚNICO camino de escritura de disponibilidad. La Tarea 16 lo reutiliza.
 *
 * Recibe el **valor destino** y lo aplica: nunca "alterna". Dos clics
 * simultáneos no pueden desincronizarse porque el servidor no decide el
 * nuevo valor (Tarea 04 §7).
 */
export function setProductAvailability(input: SetProductAvailabilityInput): Promise<ProductDTO> {
  return writeProductAvailability(
    {
      productRepository: { toggleProductAvailability: productRepository.toggleProductAvailability },
    },
    input,
  );
}

/**
 * Ajustes del negocio para la barra lateral y el dashboard. Sin caché.
 *
 * Mismo servicio que `getPublicBusinessSettings` y no una copia: los dos
 * call sites leen los mismos datos, detrás de la fila singleton, y el
 * nombre distinto dice quién pregunta (el local, no el cliente).
 */
export function getSettingsForAdmin(): Promise<BusinessSettingsDTO> {
  return readSettings();
}

export type { ProductRow, SetProductAvailabilityInput } from "./product.service";

/**
 * Categorías y ajustes del panel (Tarea 17 §6.3).
 *
 * ⛔ Mismo criterio que la Tarea 16: las actions no inventan un
 *    composition root nuevo. Importan el servicio ya cableado, y el
 *    accessor logra que la puerta se acuerde de los repositorios en un
 *    solo lugar (este).
 */
export const getCategoryAdminDependencies = (): {
  productRepository: ProductAdminReader;
  categoryRepository: CategoryAdminLister & CategoryAdminWriter;
} => ({
  productRepository: { findAllProductsForAdmin: productRepository.findAllProductsForAdmin },
  categoryRepository: {
    findAllCategoriesForAdmin: categoryRepository.findAllCategoriesForAdmin,
    createCategory: categoryRepository.createCategory,
    updateCategory: categoryRepository.updateCategory,
    deleteCategory: categoryRepository.deleteCategory,
  },
});

export const getSettingsAdminDependencies = (): {
  settingsRepository: SettingsWriter;
} => ({
  settingsRepository: {
    findBusinessSettings: settingsRepository.findBusinessSettings,
    saveBusinessSettings: settingsRepository.saveBusinessSettings,
  },
});

/**
 * Registro de comanda desde el checkout (Tarea 23).
 *
 * ⛔ Es la ÚNICA escritura pública del sistema. No pide sesión porque
 *    es el cliente quien la dispara; las defensas (rate limit, honeypot,
 *    revalidación y cotización server-side) viven en la action y en el
 *    servicio, no acá.
 */
export function registerPublicOrder(input: {
  readonly items: readonly RegisterOrderLine[];
  readonly customer: WhatsAppCustomer;
}): Promise<OrderDTO> {
  return registerCheckoutOrder(
    {
      productRepository: {
        findPublishedProducts: productRepository.findPublishedProducts,
      },
      orderRepository: { createOrder: orderRepository.createOrder },
    },
    input,
  );
}

/** Comandas del turno para el tablero. Sin caché: es la pantalla viva del local. */
export function getOrdersForBoard(): Promise<OrderDTO[]> {
  return listOrdersForBoard({ orderRepository });
}

/** Transición de estado del tablero, con la máquina de dominio aplicada. */
export function transitionOrderFromAdmin(input: {
  readonly id: string;
  readonly to: OrderStatus;
}): Promise<OrderDTO> {
  return transitionOrder({ orderRepository }, input);
}

/**
 * Sitemap. El tag es el mismo del catálogo: publicar un producto lo
 * saca del sitemap y del menú juntos, sin que el tag `products` se
 * desincronice (§6.5).
 */
export function getSeoDependencies(): {
  productRepository: ProductSitemapReader;
  getSitemapEntries: typeof readSitemapEntries;
  getContentUpdatedAt: () => Promise<Date>;
} {
  return {
    productRepository,
    getSitemapEntries: readSitemapEntries,
    getContentUpdatedAt: () => settingsRepository.findBusinessSettings().then(() => new Date()),
  };
}
