import type { BusinessSettingsDTO, CategoryDTO, OpeningHours, ProductDTO } from "@/lib/domain";

/**
 * Puertos de la capa de servicio (DIP + ISP, Tarea 08 §5).
 *
 * Contratos ESTRUCTURALES: no declaran `implements` sobre nada. Los
 * repositorios de la Tarea 04 los satisfacen por forma, sin importarlos
 * y sin saber que existen.
 *
 * ⛔ Solo declaraciones de tipo: se borran al compilar. Por eso los tests
 *    unitarios de los servicios no cargan Prisma ni la base.
 *
 * **Un puerto por servicio, no un puerto gigante:** cada servicio declara
 * solo lo que consume. `category.service` no puede llamar a
 * `deleteCategory` aunque exista, porque no lo ve en su tipo.
 */
export interface ProductCatalogReader {
  findPublishedProducts(options?: { readonly onlyAvailable?: boolean }): Promise<ProductDTO[]>;
  findPublishedProductBySlug(slug: string): Promise<ProductDTO | null>;
  findFeaturedProducts(limit?: number): Promise<ProductDTO[]>;
}

export interface CategoryCatalogReader {
  findVisibleCategories(): Promise<CategoryDTO[]>;
}

export interface CategoryAdminReader {
  findCategoryById(id: string): Promise<CategoryDTO | null>;
}

/**
 * Listado completo para el panel: incluye `DRAFT` y `ARCHIVED`.
 *
 * ⛔ No lleva caché ni tag. Es una lectura de admin sobre datos que el
 *    admin acaba de cambiar, detrás de una sesión.
 */
export interface ProductAdminReader {
  findAllProductsForAdmin(): Promise<ProductDTO[]>;
}

/**
 * Escritura de disponibilidad.
 *
 * ⚠️ Recibe el **valor destino**. Dos clics simultáneos no pueden
 * desincronizarse porque el servidor nunca "alterna": aplica lo que le
 * mandan (Tarea 04 §7).
 */
export interface ProductAvailabilityWriter {
  toggleProductAvailability(id: string, isAvailable: boolean): Promise<ProductDTO>;
}

/** Listado de categorías para poder poner el nombre en la fila de la tabla. */
export interface CategoryAdminLister {
  findAllCategoriesForAdmin(): Promise<CategoryDTO[]>;
}

/**
 * Escritura sobre productos desde el panel (Tarea 16 §6.3).
 *
 * ⛔ Interfaz estructural, no import de tipos de la capa 4: el servicio
 *    recibe exactamente esto, y el composition root de la capa 3 es el
 *    ÚNICO lugar que junta el servicio con Prisma y Cloudinary (§4.1).
 *
 * El payload de `updateProduct` está escrito a mano porque el tipo
 * `UpdateProductInput` del repositorio usa `exactOptionalPropertyTypes`:
 * `Partial` solo no es asignable. El `slug` sigue siendo opcional, pero
 * la firma es estricta sobre su presencia.
 */
export interface ProductAdminWriterCreateInput {
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly price: number;
  readonly imageUrl: string;
  readonly imagePublicId: string | null;
  readonly categoryId: string;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readonly isFeatured: boolean;
  readonly isAvailable: boolean;
  readonly allergens: readonly string[];
  readonly sortOrder: number;
}

export interface ProductAdminWriterUpdateInput {
  readonly name?: string;
  readonly slug?: string;
  readonly description?: string | null;
  readonly price?: number;
  readonly imageUrl?: string;
  readonly imagePublicId?: string | null;
  readonly categoryId?: string;
  readonly status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readonly isFeatured?: boolean;
  readonly isAvailable?: boolean;
  readonly allergens?: readonly string[];
  readonly sortOrder?: number;
}

export interface ProductAdminWriter {
  createProduct(input: ProductAdminWriterCreateInput): Promise<ProductDTO>;
  updateProduct(id: string, input: ProductAdminWriterUpdateInput): Promise<ProductDTO>;
  archiveProduct(id: string): Promise<ProductDTO>;
  findProductByIdForAdmin(id: string): Promise<ProductDTO | null>;
}

/**
 * Servicio de imágenes del producto (Tarea 06 §6.4). Lo ve el servicio
 * del CRUD, no las actions: solo la capa 3 puede anunciar al sistema de
 * archivos (§2.3 del documento de la Tarea 16).
 */
export interface ProductImageService {
  uploadProductImage(input: {
    readonly file: File;
    readonly slug: string;
  }): Promise<{ readonly imageUrl: string; readonly imagePublicId: string }>;
  replaceProductImage(input: {
    readonly file: File;
    readonly slug: string;
    readonly previousPublicId: string | null;
  }): Promise<{ readonly imageUrl: string; readonly imagePublicId: string }>;
}

/**
 * Consumo del CRUD admin. Única puerta: la combinación del repositorio
 * con el servicio de imagen.
 */
export interface ProductAdminPorts {
  readonly productRepository: ProductAdminWriter;
  readonly imageService: ProductImageService;
}

/**
 * Escritura de categorías desde el panel (Tarea 17 §6.3).
 *
 * `CategoryAdminReader` (Tarea 08) y `CategoryAdminLister` (Tarea 14)
 * no se tocan: este puerto cubre solo las tres escrituras, y por ISP
 * `category.service` sigue sin poder borrar nada aunque el tipo exista
 * en el mismo archivo.
 */
export interface CategoryAdminWriter {
  createCategory(input: {
    readonly name: string;
    readonly slug: string;
    readonly description: string | null;
    readonly position: number;
    readonly isVisible: boolean;
  }): Promise<CategoryDTO>;
  updateCategory(
    id: string,
    input: {
      readonly name?: string | undefined;
      readonly slug?: string | undefined;
      readonly description?: string | null;
      readonly position?: number | undefined;
      readonly isVisible?: boolean | undefined;
    },
  ): Promise<CategoryDTO>;
  deleteCategory(id: string): Promise<void>;
}

/** Solo lectura. Lo usa el catálogo público. */
export interface SettingsReader {
  findBusinessSettings(): Promise<BusinessSettingsDTO>;
}

/** Lectura y escritura. Lo usa el panel de ajustes (Tarea 17). */
export interface SettingsWriter extends SettingsReader {
  saveBusinessSettings(input: SaveBusinessSettingsInput): Promise<BusinessSettingsDTO>;
}

/**
 * Se REDECLARA acá en lugar de importarse del repositorio: un
 * `import type` desde un módulo con `server-only` funciona, pero ata la
 * capa 3 a la capa 4 y las reglas de importación lo terminan bloqueando.
 * La forma es idéntica a la del repositorio por un `satisfies` efectivo
 * del typecheck en los call sites.
 */
export interface SaveBusinessSettingsInput {
  readonly name: string;
  readonly whatsappPhone: string;
  readonly address: string | null;
  readonly instagramUrl: string | null;
  readonly openingHours: OpeningHours;
  readonly closingMessage: string | null;
  readonly legalNotice: string | null;
}

/** ⛔ Sólo lo lee el sitemap. `catalog.service` no lo ve. */
export interface ProductSitemapReader {
  findPublishedProductsForSitemap(): Promise<
    readonly import("@/lib/domain").SitemapProductRecord[]
  >;
}
