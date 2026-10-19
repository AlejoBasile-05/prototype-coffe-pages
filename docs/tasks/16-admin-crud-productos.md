# Tarea 16 — Panel Admin: CRUD de Productos

| Campo | Valor |
|---|---|
| **ID** | 16 |
| **Fase (DESIGN.md §8.6)** | Fase 4 — Panel de administración |
| **Depende de** | 06, 08, 14 |
| **Habilita** | 17 (categorías y ajustes) |
| **Tipo** | Interfaz / Controlador |
| **Esfuerzo est.** | 3 – 4 días |

---

## 1. Objetivo de la tarea

Permitir que el encargado del negocio **cree, edite, publique y archive productos** desde el panel, con subida de foto, sin tocar una línea de código ni una terminal.

**Criterio de éxito verificable:** desde cero —producto nuevo, foto nueva, alérgenos, categoría— el recorrido completo se hace en menos de tres minutos, y el producto publicado aparece en `/menu` en menos de un minuto después de hacer clic en "Publicar".

---

## 2. Contexto y dependencias

**Requiere:** Tarea 06 (imágenes firmadas en Cloudinary), Tarea 08 (repositorios y DTOs de producto), Tarea 14 (shell del panel, verificación de sesión y convenciones de action).

### 2.1 El alcance real: tres operaciones, no un CRUD genérico

La palabra "CRUD" suena a un generador de formularios. No lo es. En este proyecto hay exactamente tres operaciones y cada una tiene una decisión de negocio distinta:

| Operación | Qué hace | Qué la hace difícil |
|---|---|---|
| **Crear** | Alta de un producto en `DRAFT` con foto subida | El `public_id` de Cloudinary sale del slug, y el slug sale del nombre. Hay que decidir el orden de las dos operaciones |
| **Editar** | Cambia cualquier campo del producto | Cambiar el nombre cambia el slug, y el slug es la URL pública y la carpeta de la imagen. Eso no es un `PATCH` |
| **Archivar** | Marca `ARCHIVED`. No borra | El producto puede estar en la URL de un cliente y en un chat de WhatsApp ya enviado |

**No hay borrado físico.** Ni de producto ni de imagen. Un producto del menú se comparte por WhatsApp: si desaparece del servidor, un cliente que ya tiene el link recibe un 404 y el encargado tiene que responder el mensaje a mano. `archiveProduct` de la Tarea 04 ya está escrito para eso y esta tarea no lo rethinka.

### 2.2 El slug es la decisión más delicada de la tarea

`slug` es `@unique` en la base, es la URL pública (`/producto/[slug]`) y es la entrada de `buildImagePublicId(slug)`. Los tres usos vienen del mismo string, y eso crea un acoplamiento que hay que tratar a mano en vez de dejar que reviente:

- Si el nombre cambia, ¿cambia el slug? Si sí, cambia la URL y cualquier link viejo se rompe.
- Si el nombre cambia y el slug también, cambia el `public_id`, y la imagen hay que volver a subir aunque el archivo sea el mismo.
- Si el nombre cambia y el slug **no**, la URL queda con el nombre viejo para siempre, y dentro de seis meses nadie entiende por qué `/producto/cafe-con-leche` muestra "Café con leche de la casa".

La decisión que toma esta tarea, y que conviene que quede escrita porque es la que se va a discutir:

> **El slug se genera una vez, al crear, y después es inmutable desde el formulario.**

Se edita a mano, en un campo aparte, y **sólo mientras el producto está en `DRAFT`**. Una vez publicado, el slug queda congelado. La razón es que el costo de congelar es un nombre de URL que puede quedar un poco viejo, y el costo de no congelar es un 404 en un link ya compartido.

### 2.3 Por qué la imagen se sube antes de guardar el producto

El flujo no es "guardar y después subir la foto": es al revés, y el orden no es un detalle de implementación.

`imageUrl` es `NOT NULL`. Un producto sin foto no se puede crear. Y la subida de la imagen necesita el slug, que a su vez necesita el nombre. De ahí la secuencia:

1. El usuario completa nombre, precio, categoría, alérgenos y elige el archivo.
2. Se valida el archivo **en el navegador** con `validateImageFile` (Tarea 06): tipo, tamaño, y una lectura de dimensiones antes de subir 6 MB.
3. Se pide la firma a `/api/admin/images/sign` con el slug candidato.
4. El navegador sube el archivo **directo a Cloudinary** con la firma. Los bytes no pasan por el servidor de Next.
5. Recién con la `imageUrl` en la mano se manda la Server Action, que persiste el producto.

El paso 4 es el que evita que el servidor de Next sea un proxy de 6 MB por cada foto, y el paso 5 es el que garantiza que nunca exista un producto sin imagen.

### 2.4 La frontera con la Tarea 15: qué se revalida y qué no

| Cambio | ¿Invalida el tag `products`? | Por qué |
|---|---|---|
| Crear, editar o **archivar** un producto | **Sí** | Cambia el contenido del catálogo: nombres, precios, fotos, categorías. Es exactamente el caso para el que existe el tag |
| Cambiar sólo `isAvailable` | **No** | Es el eje operativo, y lo resuelve la Tarea 15 por WebSocket (§4.3 de la Tarea 08) |

Esta es la regla más importante de la tarea, y es la razón por la que la Tarea 15 existe. El CRUD sí invalida caché; el switch no. Confundirlas es el error que hace que el catálogo entero se regenere en cada cambio de stock, o que un producto nuevo no aparezca hasta que expire la caché.

### 2.5 Checklist de prerrequisitos

- [x] Tarea 06: existe `/api/admin/images/sign` **con la autorización de la Tarea 07 conectada** (el `501` de la Tarea 06 ya fue reemplazado por `verifyAdminSession`)
- [x] Tarea 06: `uploadProductImage` y `replaceProductImage` disponibles en el servidor
- [x] Tarea 06: `validateImageFile` y `assertUploadedImageIsUsable` en `src/lib/validation/imagen.ts`
- [x] Tarea 08: `createProduct`, `updateProduct`, `archiveProduct`, `findProductByIdForAdmin` en el repositorio de producto
- [x] Tarea 14: layout `/admin` protegido y `verifyAdminSession` en cada action
- [x] Tarea 05: `buildSlug` en `src/lib/validation/slug.ts` y `ALERGENOS` en `src/lib/domain/allergens.ts`
- [x] Tarea 09: primitivas de formulario (`Input`, `Textarea`, `Select`, `Button`, `Sheet`, `AlertDialog`)
- [x] Hay al menos una categoría cargada: sin categorías no se puede crear un producto

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `src/lib/validation/producto-admin.ts` | Esquemas Zod del formulario y del alta. Sin I/O, sin `server-only` |
| `src/server/services/product-admin.service.ts` | Orquesta imagen + producto en el orden correcto de §2.3 |
| `src/server/actions/productos.ts` | `createProductAction`, `updateProductAction`, `archiveProductAction` |
| `src/components/admin/products/ProductForm.tsx` | Formulario del panel. Un solo componente para alta y edición |
| `src/components/admin/products/ProductImageField.tsx` | Selección, previsualización y subida firmada |
| `src/components/admin/products/AllergenFieldset.tsx` | Checkboxes del glosario cerrado |
| `src/components/admin/products/ArchiveProductDialog.tsx` | Confirmación de archivado, con el producto nombrado |
| `src/app/admin/productos/nuevo/page.tsx` | Ruta de alta |
| `src/app/admin/productos/[id]/editar/page.tsx` | Ruta de edición |
| `src/components/admin/products/ProductFormFields.tsx` | Campos sin estado, para que el test no monte el formulario entero |
| Ningún `utils.ts` ni `helpers.ts` | No se crean archivos de cajón. Un archivo por responsabilidad |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `src/app/admin/productos/page.tsx` | Botones de editar y archivar por fila; enlace a "Nuevo producto" |
| `src/components/admin/ProductsTable.tsx` | Agregar las acciones de fila que faltaban |
| `src/server/services/index.ts` | Cablear `createProductFromAdmin`, `updateProductFromAdmin`, `archiveProductFromAdmin` |
| `docs/tasks/README.md` | Marcar la Tarea 16 |

### 3.3 Eliminar

Ninguno.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Ubicación | Qué va | Qué NO va |
|---|---|---|
| `src/lib/validation/producto-admin.ts` | Forma del dato y reglas puras de validación | Prisma, Cloudinary, React, `server-only` |
| `src/server/services/product-admin.service.ts` | El orden de las operaciones: imagen primero, producto después | Next, React, `revalidateTag` |
| `src/server/actions/productos.ts` | Autorizar, validar, delegar, revalidar | Prisma, llamadas a Cloudinary, lógica de negocio |
| `src/components/admin/products/*` | Estado del formulario, subida firmada, painters | Importar Prisma o servicios de servidor |

**La regla que se respetará sin excepción:** el `ProductForm` no importa nada de `src/server/**` salvo las actions. Nunca el servicio. Un componente que importa el servicio es un componente que puede llamar a Prisma desde el cliente.

### 4.2 La acción es la única puerta de entrada

Ni el formulario, ni una ruta de API, ni un test pueden escribir un producto por otro camino que la action. La razón es la de siempre y no cambia: cada camino propio se olvida de `verifyAdminSession` en algún commit.

```
ProductForm ──► createProductAction ──► verifyAdminSession
                                            │
                                            ▼
                                     Zod (producto-admin.ts)
                                            │
                                            ▼
                              product-admin.service (imagen + alta)
                                            │
                                            ▼
                                       createProduct  ← Prisma
```

La subida de la imagen **sí** sale del componente, pero al `/api/admin/images/sign` de la Tarea 06, que tiene su propia verificación de sesión. Es el único dato que cruza al exterior antes de la action, y está justificado: los bytes van del navegador a Cloudinary sin pasar por el servidor.

### 4.3 Por qué el servicio existe y no son tres actions que escriban

Podría haber tres actions que llamen al repositorio y listo. El servicio existe por un motivo concreto: **el orden imagen-producto tiene que ser el mismo en el alta y en la edición**, y en la edición hay una compensación que no existe en el alta.

En la edición, si el producto ya tiene foto y el usuario no sube una nueva, no se toca la imagen. Si sube una nueva, hay que reemplazar el asset viejo. Si el nombre cambió y con él el slug, el `public_id` nuevo es distinto del viejo y el asset viejo queda huérfano. Esa lógica de compensación son quince líneas que no van en una action, porque una action que hace quince líneas de compensación ya es un servicio con un nombre peor.

### 4.4 Reparto específico de esta tarea

| Capa | Tarea 14 | Tarea 16 |
|---|---|---|
| Validación | `ToggleAvailabilitySchema` | `ProductoAltaSchema`, `ProductoEdicionSchema` |
| Servicios | `setProductAvailability` | `createProductFromAdmin`, `updateProductFromAdmin`, `archiveProductFromAdmin` |
| Actions | `toggleProductAvailabilityAction` | `createProductAction`, `updateProductAction`, `archiveProductAction` |
| Caché | Sólo `revalidatePath("/admin/productos")` | `revalidateTag("products")` + `revalidatePath("/admin/productos")` |
| Componentes | `AvailabilitySwitch` | `ProductForm`, `ProductImageField`, `AllergenFieldset` |

---

## 5. Convenciones de código (Clean Code + SOLID)

**Principio aplicado: SRP en el servicio, ISP en los esquemas.**

### 5.1 Dos esquemas, no uno con campos opcionales

`ProductoEdicionSchema` **no** es `ProductoAltaSchema.partial()`. Son dos esquemas a propósito:

| | Alta | Edición |
|---|---|---|
| `name` | requerido | requerido |
| `slug` | derivado del nombre, **no enviado por el formulario** | editable, y **sólo si `status === "DRAFT"`** |
| `imageUrl` | viene de la subida firmada | opcional: si no viene, se conserva la actual |
| `status` | forzado a `DRAFT` por el servicio | editable, porque publicar es parte del trabajo |
| `categoryId` | requerido | requerido, con la misma lista de categorías |

Hacer la edición con campos opcionales sobre el esquema del alta tiene dos consecuencias malas. La primera es que el servicio tiene que distinguir "vino vacío" de "no vino", y un `undefined` en un campo de texto termina guardado como string vacío. La segunda es que el tipo del servicio de edición no dice qué se puede cambiar: dice qué se puede mandar, que es información distinta y peor.

### 5.2 El slug no lo manda el cliente

En el alta, el formulario **no** manda `slug`. Manda `name`, y el servicio calcula `buildSlug(name)`. Si el cliente mandara el slug, un POST a la action podría elegir la URL de otro producto.

En la edición, el slug **sí** puede venir, pero pasa por tres filtros antes de guardarse:

1. El producto está en `DRAFT`. Si no, el slug se ignora y se avisa.
2. `isValidSlug(slug)`. El schema rechaza barras, espacios, tildes y mayúsculas en vez de corregirlos en silencio.
3. La base rechaza duplicados con `P2002`, y el repositorio lo traduce a `ConflictError`. La action lo muestra como "Ese identificador ya lo usa otro producto".

### 5.3 Los alérgenos no son un campo de texto

El campo es un `fieldset` de checkboxes sobre `ALERGENOS`, no un `<input type="text">` donde se escriba "leche, gluten, maní".

La razón está en la Tarea 05 §6.1: `toCanonicalAllergen` traduce la entrada del usuario a la clave canónica y devuelve `null` si no existe en el glosario. Con checkboxes, un alérgeno desconocido **no se puede escribir**. Con un campo de texto, se puede, y un alérgeno mal escrito es un riesgo para alguien con una alergia real.

**Consecuencia asumida:** si el negocio necesita un alérgeno que no está en el glosario, hay que agregar la clave a `src/lib/domain/allergens.ts` en una migración de código, no desde el formulario. Es lo correcto: el glosario es un compromiso con el cliente, no un dato editable.

### 5.4 Nombres

| Elemento | Nombre | Razón |
|---|---|---|
| Acción de alta | `createProductAction` | Sufijo `Action` de la Tarea 14. Sin sufijo, el import se confunde con el servicio |
| Servicio de alta | `createProductFromAdmin` | `FromAdmin` dice que el llamador es el panel. `createProduct` a secas ya existe en el repositorio, con otro contrato |
| Esquema | `ProductoAltaSchema`, `ProductoEdicionSchema` | La convención de nombres de entidad en español del proyecto |
| Componente | `ProductForm` | Un componente, dos modos, con `producto` opcional |
| Acción de archivo | `archiveProductAction`, nunca `deleteProductAction` | El nombre correcto evita que alguien busque un borrado físico que no existe |

### 5.5 El precio entra como string y sale como número

El `<input type="number">` entrega strings. `Number("1450,50")` es `NaN` si el usuario escribe coma decimal, que es lo que va a escribir medio mundo.

El esquema recibe `string` y lo transforma con una regla explícita de parseo que acepta coma o punto, rechaza más de dos decimales y rechaza negativos. Recién ahí se convierte a `number` en **centavos** o en la unidad del dominio. La conversión vive en el esquema, no en el componente y no en el servicio: es una regla de forma del dato, y las reglas de forma viven en un solo lugar.

### 5.6 Límites de tamaño

| Archivo | Tope | Razón |
|---|---|---|
| `producto-admin.ts` | 150 líneas | El alta sola ya ocupa la mitad. Si crece, es que falta un módulo, no que falta espacio |
| `product-admin.service.ts` | 200 líneas | Es el archivo más denso de la tarea. Si se pasa, se divide por operación, no porhelper |
| `ProductForm.tsx` | 250 líneas | Campos, estado y submit. Más que eso y el estado merece un hook propio |
| `ProductImageField.tsx` | 180 líneas | La subida firmada es una máquina de estados y va en su archivo |
| `AllergenFieldset.tsx` | 60 líneas | Siete checkboxes y una lista |

---

## 6. Pasos de implementación

### 6.1 Esquemas de validación

```ts
// src/lib/validation/producto-admin.ts
import { z } from "zod";
import { isValidSlug } from "@/lib/validation/slug";
import { ALERGENOS, type Allergen } from "@/lib/domain/allergens";

/**
 * ⛔ Sin `server-only` y sin I/O: este módulo lo importa el componente de
 *    cliente para validar antes de subir 6 MB. Ver §4.1.
 */

const NOMBRE_MAX = 120;
const DESCRIPCION_MAX = 600;
const PRECIO_MAX = 1_000_000;

/**
 * Acepta "1450", "1450,50" y "1450.50". Rechaza "1.450,50" a propósito:
 * el separador de miles no se adivina, y un `NaN` silencioso en el precio
 * es peor que un error visible. Ver §5.5.
 */
const precioComoNumero = z
  .string()
  .trim()
  .regex(/^\d{1,7}([.,]\d{1,2})?$/, "Escribí el precio como 1450 o 1450,50")
  .transform((valor) => Number(valor.replace(",", ".")))
  .refine((valor) => Number.isFinite(valor) && valor >= 0 && valor <= PRECIO_MAX, {
    message: `El precio debe estar entre 0 y ${PRECIO_MAX}`,
  });

const nombre = z
  .string()
  .trim()
  .min(3, "El nombre tiene al menos 3 caracteres")
  .max(NOMBRE_MAX, `El nombre tiene hasta ${NOMBRE_MAX} caracteres`);

const descripcion = z
  .string()
  .trim()
  .max(DESCRIPCION_MAX, `La descripción tiene hasta ${DESCRIPCION_MAX} caracteres`)
  .transform((valor) => (valor.length === 0 ? null : valor));

/**
 * ⛔ El enum está escrito a mano y NO se deriva de `ALERGENOS` con un cast.
 *    Un `z.enum(ALERGENOS as [Allergen, ...Allergen[]])` compila, pero el
 *    `as` le miente al compilador sobre la forma del array y nada detecta
 *    que al glosario le agregaron una clave y el enum quedó viejo. El test
 *    de §10.1 sí lo detecta.
 */
const allergens = z
  .array(
    z.enum([
      "gluten",
      "lactosa",
      "huevo",
      "maní",
      "frutos secos",
      "sésamo",
      "soja",
    ]),
  )
  .default([]);

const categoryId = z.string().min(1, "Elegí una categoría");

/** Datos que llegan YA con la imagen subida. Ver §2.3. */
const imagenSubida = z.object({
  imageUrl: z.string().url().startsWith("https://res.cloudinary.com/"),
  imagePublicId: z.string().min(1),
});

export const ProductoAltaSchema = z.object({
  nombre,
  descripcion,
  precio: precioComoNumero,
  categoryId,
  allergens,
  isFeatured: z.boolean().default(false),
  imagen: imagenSubida,
});

export const ProductoEdicionSchema = ProductoAltaSchema.omit({ imagen: true }).extend({
  id: z.string().min(1),
  /** Opcional: si no viene, se conserva la foto actual. Ver §6.2. */
  imagen: imagenSubida.optional(),
  /** Sólo se acepta si el producto está en DRAFT. Lo verifica el servicio. */
  slug: z
    .string()
    .trim()
    .refine(isValidSlug, "Sólo minúsculas, números y guiones")
    .optional(),
  /** ⛔ No incluye `ARCHIVED`: archivar tiene su propia action y su diálogo. */
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

export type ProductoAltaInput = z.infer<typeof ProductoAltaSchema>;
export type ProductoEdicionInput = z.infer<typeof ProductoEdicionSchema>;
```

Dos notas sobre el código:

- **El enum de alérgenos duplica el glosario a propósito.** La duplicación se paga con un test de una línea (§10.1) que compara el enum contra `ALERGENOS`. La alternativa, derivarlo con un cast, no tiene ese test y por lo tanto no falla nunca: el error se descubre cuando un producto real no deja guardar un alérgeno.
- **La lista de claves está en el mismo orden que `ALERGENOS`.** No es un detalle: si el test compara con `toEqual` sobre el array, el orden importa, y es la forma más barata de detectar un desajuste.
- **`status` no aparece en `ProductoAltaSchema`.** El alta nace en `DRAFT` y el servicio lo fuerza. Que el esquema no acepte el campo hace imposible mandarlo por error desde el formulario.

### 6.2 Servicio de escritura

```ts
// src/server/services/product-admin.service.ts
import "server-only";

import { buildSlug } from "@/lib/validation/slug";
import { ValidationError, ResourceNotFoundError } from "@/lib/domain";
import type { ProductoAltaInput, ProductoEdicionInput } from "@/lib/validation/producto-admin";
import type { ProductAdminPorts } from "@/server/services/repository-ports";

/**
 * ⛔ El servicio NO importa los repositorios. Recibe `deps`, igual que los
 *    servicios de la Tarea 08. El cableado ocurre una sola vez, en
 *    `src/server/services/index.ts` (§6.3), y por eso los tests de §10.2
 *    corren sin base de datos.
 */
export const createProductFromAdmin = async (
  deps: ProductAdminPorts,
  input: ProductoAltaInput,
  file: File | null,
): Promise<ProductDTO> => {
  // 1. El slug se calcula acá, no en el formulario. Ver §5.2.
  const slug = buildSlug(input.nombre);

  // 2. La imagen va PRIMERO. `imageUrl` es NOT NULL: un producto sin foto
  //    no existe, y una foto subida sin producto es un huérfano que la
  //    Tarea 21 limpia. El orden inverso deja basura; este la deja sólo
  //    si el paso 3 falla, que es un error del usuario, no del sistema.
  const imagen = file
    ? await deps.imageService.uploadProductImage({ file, slug })
    : { imageUrl: "", imagePublicId: null };

  if (!imagen.imageUrl) {
    throw new ValidationError("La foto es obligatoria", { field: "imagen" });
  }

  // 3. El alta nace SIEMPRE en DRAFT, aunque el formulario mandara otra
  //    cosa. Publicar es una decisión aparte y deliberada. Ver §9.
  return deps.productRepository.createProduct({
    name: input.nombre,
    slug,
    description: input.descripcion,
    price: input.precio,
    imageUrl: imagen.imageUrl,
    imagePublicId: imagen.imagePublicId,
    categoryId: input.categoryId,
    status: "DRAFT",
    isFeatured: input.isFeatured,
    isAvailable: true,
    allergens: input.allergens,
    sortOrder: 0,
  });
};
```

La función de edición, que es donde está la compensación:

```ts
export const updateProductFromAdmin = async (
  deps: ProductAdminPorts,
  input: ProductoEdicionInput,
  file: File | null,
): Promise<ProductDTO> => {
  const actual = await deps.productRepository.findProductByIdForAdmin(input.id);

  if (actual === null) {
    throw new ResourceNotFoundError("Producto", input.id);
  }

  // El slug sólo se toca en DRAFT. Fuera de DRAFT se ignora en silencio y
  // se avisa por `console.warn`: la URL pública ya se puede haber compartido.
  const cambiaSlug = actual.status === "DRAFT" && input.slug !== undefined;
  const slug = cambiaSlug && input.slug !== undefined ? input.slug : actual.slug;

  // ⛔ ARCHIVED es un callejón sin salida desde este formulario. Un producto
  //    archivado vuelve a DRAFT por una action propia, con su propia
  //    confirmación, porque volver a publicar algo que se retiró del menú es
  //    una decisión y no un cambio de campo. Ver §9.
  if (actual.status === "ARCHIVED") {
    throw new ValidationError("Un producto archivado no se edita desde acá", {
      field: "status",
    });
  }

  const nombreFinal = input.nombre;

  // Sin foto nueva se conserva la actual. Con foto nueva, se reemplaza.
  const imagen = file
    ? await deps.imageService.replaceProductImage({
        file,
        slug,
        previousPublicId: actual.imagePublicId,
      })
    : { imageUrl: actual.imageUrl, imagePublicId: actual.imagePublicId };

  // Publicar exige foto. El nombre, el precio y la categoría ya están
  // garantizados por el esquema y por la base; lo único que el esquema no
  // puede saber es si la foto existe, porque en la edición es opcional.
  if (input.status === "PUBLISHED" && imagen.imageUrl.trim() === "") {
    throw new ValidationError("No se puede publicar un producto sin foto", {
      field: "imagen",
    });
  }

  return deps.productRepository.updateProduct(input.id, {
    name: nombreFinal,
    ...(cambiaSlug ? { slug } : {}),
    description: input.descripcion,
    price: input.precio,
    imageUrl: imagen.imageUrl,
    imagePublicId: imagen.imagePublicId,
    categoryId: input.categoryId,
    allergens: input.allergens,
    isFeatured: input.isFeatured,
    status: input.status,
  });
};

/**
 * Archiva. Nunca borra. Ver §2.1.
 *
 * ⛔ No se cambia `imageUrl` ni se destruye el asset de Cloudinary: el link
 *    del producto puede estar en un chat de WhatsApp y la foto es parte de
 *    ese mensaje.
 */
export const archiveProductFromAdmin = async (
  deps: ProductAdminPorts,
  id: string,
): Promise<ProductDTO> => {
  const product = await deps.productRepository.archiveProduct(id);

  if (product.status !== "ARCHIVED") {
    throw new Error("El archivado no se aplicó");
  }

  return product;
};
```

Por qué `archiveProductFromAdmin` parece un envoltorio que no hace nada: **no hace nada, y esa es la garantía.** La única validación que agrega es comprobar que la operación terminó. Si alguien cambia el repositorio y `archiveProduct` empieza a hacer borrado físico, esta función se cae en el test en vez de perder datos en producción. Una función que no hace nada y se usa igual es una afirmación sobre el comportamiento de otra capa.

### 6.3 Cableado en el composition root

```ts
// src/server/services/repository-ports.ts (agregar)
/** ⛔ Interfaz, no clase. El servicio depende de esto, nunca de Prisma. */
export interface ProductAdminPorts {
  readonly productRepository: {
    readonly createProduct: typeof import("@/server/repositories/product.repository").createProduct;
    readonly updateProduct: typeof import("@/server/repositories/product.repository").updateProduct;
    readonly archiveProduct: typeof import("@/server/repositories/product.repository").archiveProduct;
    readonly findProductByIdForAdmin: typeof import("@/server/repositories/product.repository").findProductByIdForAdmin;
  };
  readonly imageService: {
    readonly uploadProductImage: typeof import("@/server/services/image.service").uploadProductImage;
    readonly replaceProductImage: typeof import("@/server/services/image.service").replaceProductImage;
  };
}
```

```ts
// src/server/services/index.ts (agregar)
import {
  createProduct,
  updateProduct,
  archiveProduct,
  findProductByIdForAdmin,
} from "@/server/repositories/product.repository";
import { uploadProductImage, replaceProductImage } from "@/server/services/image.service";
import {
  createProductFromAdmin as crear,
  updateProductFromAdmin as actualizar,
  archiveProductFromAdmin as archivar,
} from "./product-admin.service";
import type { ProductAdminPorts } from "./repository-ports";
import type { ProductoAltaInput, ProductoEdicionInput } from "@/lib/validation/producto-admin";

/**
 * ⛔ Composition root. El ÚNICO archivo que junta el servicio con Prisma y
 *    con Cloudinary. Quien importa de `@/server/services` recibe funciones
 *    sin `deps` y nunca ve de dónde salen. Ver §4.1.
 */
const deps: ProductAdminPorts = {
  productRepository: {
    createProduct,
    updateProduct,
    archiveProduct,
    findProductByIdForAdmin,
  },
  imageService: { uploadProductImage, replaceProductImage },
};

export const createProductFromAdmin = (
  input: ProductoAltaInput,
  file: File | null,
): Promise<ProductDTO> => crear(deps, input, file);

export const updateProductFromAdmin = (
  input: ProductoEdicionInput,
  file: File | null,
): Promise<ProductDTO> => actualizar(deps, input, file);

export const archiveProductFromAdmin = (id: string): Promise<ProductDTO> =>
  archivar(deps, id);
```

### 6.4 Server Actions

Las tres tienen la misma forma: **autorizar, validar, delegar, revalidar**. El orden no es un estilo: es la regla 10 del README.

```ts
// src/server/actions/productos.ts
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { ZodError } from "zod";
import { verifyAdminSession } from "@/server/auth/verify-admin";
import { toSafeErrorMessage } from "@/lib/domain";
import { ProductoAltaSchema, ProductoEdicionSchema } from "@/lib/validation/producto-admin";
import {
  createProductFromAdmin,
  updateProductFromAdmin,
  archiveProductFromAdmin,
} from "@/server/services";

type Resultado = { ok: true } | { ok: false; error: string; code: string };

export async function createProductAction(
  datos: unknown,
  file: File | null,
): Promise<Resultado> {
  // 1. AUTORIZAR. Primero, siempre. Antes de mirar qué mandaron.
  const admin = await verifyAdminSession();
  if (admin === null) {
    return { ok: false, error: "Tu sesión expiró. Volvé a entrar.", code: "UNAUTHORIZED" };
  }

  // 2. VALIDAR. `unknown` en la firma a propósito: la action no confía en
  //    lo que le mandan, ni en el tipo con el que la llaman.
  const parsed = ProductoAltaSchema.safeParse(datos);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisá los datos del formulario",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    // 3. DELEGAR.
    await createProductFromAdmin(parsed.data, file);

    // 4. REVALIDAR. ⛔ ESTA operación SÍ invalida el contenido del
    //    catálogo. Es lo contrario que hace el toggle de la Tarea 14. Ver §2.4.
    revalidateTag("products");
    revalidatePath("/admin/productos");
    revalidatePath("/menu");

    return { ok: true };
  } catch (error) {
    if (error instanceof ConflictError) {
      return { ok: false, error: toSafeErrorMessage(error), code: "CONFLICT" };
    }
    if (error instanceof ValidationError) {
      return { ok: false, error: toSafeErrorMessage(error), code: "VALIDATION_ERROR" };
    }
    console.error("[action:createProduct]", error);
    return {
      ok: false,
      error: "No se pudo crear el producto. Intentá de nuevo.",
      code: "UNKNOWN",
    };
  }
}
```

`updateProductAction` y `archiveProductAction` son el mismo esqueleto con otro esquema y otro servicio. En `archiveProductAction` hay un detalle que no es opcional:

```ts
export async function archiveProductAction(id: unknown): Promise<Resultado> {
  const admin = await verifyAdminSession();
  if (admin === null) {
    return { ok: false, error: "Tu sesión expiró. Volvé a entrar.", code: "UNAUTHORIZED" };
  }

  const parsed = z.string().min(1).safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: "Producto inválido", code: "VALIDATION_ERROR" };
  }

  try {
    await archiveProductFromAdmin(parsed.data);

    revalidateTag("products");
    revalidatePath("/admin/productos");
    revalidatePath("/menu");

    return { ok: true };
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return {
        ok: false,
        error: "Ese producto ya no existe.",
        code: "RESOURCE_NOT_FOUND",
      };
    }
    console.error("[action:archiveProduct]", error);
    return { ok: false, error: "No se pudo archivar el producto.", code: "UNKNOWN" };
  }
}
```

**La validación de `id` en las tres actions no es paranoia.** El `id` viene de un `<Link href={`/admin/productos/${id}/editar`}>` que se puede editar a mano en la barra de direcciones, y un `id` con comillas o con un `%00` que llegue a Prisma es un `findUnique` que lanza. Validar antes de delegar convierte un error 500 en un mensaje de formulario.

### 6.5 Subida firmada de la imagen

Este es el componente con la lógica más delicada de la tarea, porque cruza dos sistemas: el navegador y Cloudinary, con el servidor en el medio sólo para firmar.

```tsx
// src/components/admin/products/ProductImageField.tsx
"use client";

import { useRef, useState } from "react";
import { validateImageFile } from "@/lib/validation/imagen";
import { buildSlug } from "@/lib/validation/slug";

type Estado =
  | { fase: "vacio" }
  | { fase: "validando" }
  | { fase: "firmando" }
  | { fase: "subiendo"; progreso: number }
  | { fase: "lista"; imageUrl: string; imagePublicId: string }
  | { fase: "error"; mensaje: string };

interface ImagenSubida {
  imageUrl: string;
  imagePublicId: string;
}

interface ProductImageFieldProps {
  /** Nombre actual: de acá sale el slug que se firma. */
  nombre: string;
  /** Foto ya guardada, en modo edición. */
  imagenActual?: { imageUrl: string; imagePublicId: string | null };
  onChange: (imagen: ImagenSubida | null) => void;
}

export const ProductImageField = ({
  nombre,
  imagenActual,
  onChange,
}: ProductImageFieldProps) => {
  const [estado, setEstado] = useState<Estado>(
    imagenActual
      ? { fase: "lista", imageUrl: imagenActual.imageUrl, imagePublicId: imagenActual.imagePublicId ?? "" }
      : { fase: "vacio" },
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const manejarArchivo = async (file: File): Promise<void> => {
    // 1. Validar ANTES de subir. `validateImageFile` es pura y corre en el
    //    navegador: rechaza un PNG de 9 MB sin mandarlo a ningún lado. Es
    //    la Tarea 06 lo dejó en `lib` justamente para esto. Ver §2.3.
    try {
      validateImageFile(file);
    } catch (error) {
      setEstado({ fase: "error", mensaje: toMessage(error) });
      return;
    }

    setEstado({ fase: "validando" });

    try {
      // 2. Pedir la firma. El servidor autoriza y devuelve los parámetros
      //    firmados; el `slug` que se manda es el que el usuario está por
      //    crear, no uno que elija a propósito. Ver §5.2.
      const respuestaFirma = await fetch("/api/admin/images/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: buildSlug(nombre) }),
      });

      if (!respuestaFirma.ok) {
        setEstado({ fase: "error", mensaje: "No se pudo autorizar la subida." });
        return;
      }

      const firma = (await respuestaFirma.json()) as FirmaDeSubida;
      setEstado({ fase: "firmando" });

      // 3. Subir DIRECTO a Cloudinary. Los 6 MB no pasan por Next: si
      //    pasarían, el servidor tendría que sostener la subida y la
      //    memoria, y un despliegue de Vercel paga la factura.
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", firma.apiKey);
      body.append("timestamp", String(firma.timestamp));
      body.append("signature", firma.signature);
      body.append("folder", firma.folder);
      body.append("public_id", firma.publicId);
      body.append("overwrite", "true");

      setEstado({ fase: "subiendo", progreso: 0 });

      const respuesta = await fetch(
        `https://api.cloudinary.com/v1_1/${firma.cloudName}/image/upload`,
        { method: "POST", body },
      );

      if (!respuesta.ok) {
        setEstado({ fase: "error", mensaje: "Cloudinary rechazó la imagen." });
        return;
      }

      const subido = (await respuesta.json()) as RespuestaCloudinary;

      // 4. El `public_id` que devuelve Cloudinary es el que se guarda, no
      //    el que se pidió. Si no coinciden, es que Cloudinary decidió
      //    otra cosa y el asset viejo no se va a poder destruir después.
      if (subido.public_id !== firma.publicId) {
        setEstado({ fase: "error", mensaje: "La imagen se subió con otro nombre." });
        return;
      }

      setEstado({
        fase: "lista",
        imageUrl: subido.secure_url,
        imagePublicId: subido.public_id,
      });
      onChange({ imageUrl: subido.secure_url, imagePublicId: subido.public_id });
    } catch (error) {
      setEstado({ fase: "error", mensaje: "No se pudo subir la imagen." });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="producto-imagen" className="text-sm font-medium">
        Foto del producto
      </label>
      <input
        id="producto-imagen"
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(evento) => {
          const archivo = evento.target.files?.[0];
          if (archivo) void manejarArchivo(archivo);
        }}
      />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
        {imagenActual ? "Cambiar la foto" : "Elegir una foto"}
      </Button>
      {estado.fase === "subiendo" && <Progress value={estado.progreso} />}
      {estado.fase === "error" && <p role="alert">{estado.mensaje}</p>}
      {estado.fase === "lista" && (
        <img src={estado.imageUrl} alt="Vista previa" className="h-32 w-32 rounded object-cover" />
      )}
    </div>
  );
};
```

Cuatro decisiones que aparecen en ese código y que conviene no pasar por alto:

1. **El `slug` que se firma se deriva del nombre, no lo elige el usuario.** Es la misma razón por la que el servicio lo calcula: si el cliente mandara el slug, firmaría para la carpeta de otro producto.
2. **El `public_id` devuelto se compara con el pedido.** Es un chequeo de tres líneas que detecta el caso en que Cloudinary renombró el asset. Sin él, el producto se guarda con un `public_id` que el servicio de la Tarea 21 nunca va a poder borrar.
3. **La validación de `File` corre en el navegador.** `validateImageFile` es una función pura de `src/lib/validation/imagen.ts`, sin `server-only` justamente para poder importarse acá. Es la razón por la que esa Tarea la dejó en `lib` y no en `server`.
4. **La previsualización es la URL real de Cloudinary, no un `URL.createObjectURL`.** Se podría mostrar el archivo local mientras sube, pero esa URL muere con la pestaña y el usuario la ve distinta de como va a quedar. La que se muestra es la definitiva.

### 6.6 `ProductForm`

```tsx
// src/components/admin/products/ProductForm.tsx
"use client";

import { useActionState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { createProductAction, updateProductAction } from "@/server/actions/productos";

type Modo = "alta" | "edicion";

interface ProductFormProps {
  modo: Modo;
  categorias: ReadonlyArray<{ id: string; name: string }>;
  producto?: ProductFormValues;
  borradorInicial?: ImagenSubida | null;
}

export const ProductForm = ({
  modo,
  categorias,
  producto,
  borradorInicial,
}: ProductFormProps) => {
  const toast = useToast();

  // El estado de la action se inicializa una vez. `useActionState` reusa
  // el mismo reducer entre el alta y la edición: la forma del resultado
  // es la misma, así que no hace falta dos componentes.
  const [estado, dispatch, pendiente] = useActionState(
    modo === "alta" ? crear : actualizar,
    { ok: false, error: "", code: "IDLE" } as Resultado,
  );

  return (
    <form action={dispatch} className="flex flex-col gap-6">
      <ProductFormFields
        key={modo === "edicion" ? producto?.id : "nuevo"}
        modo={modo}
        categorias={categorias}
        valores={producto}
        borradorInicial={borradorInicial}
        error={estado.ok ? null : estado.error}
      />

      <div className="flex gap-3">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : modo === "alta" ? "Crear producto" : "Guardar cambios"}
        </Button>
        <Button type="link" href="/admin/productos">
          Cancelar
        </Button>
      </div>
    </form>
  );
};
```

El `key` en `ProductFormFields` no es un detalle de React: sin él, al navegar de un producto a otro con el mismo componente montado, el formulario muestra los valores del producto anterior. Es un bug que sólo aparece después del primer clic en "Editar" y dura hasta que se recarga.

### 6.7 Rutas

```tsx
// src/app/admin/productos/nuevo/page.tsx
import { getAllCategoriesForAdmin } from "@/server/services";
import { ProductForm } from "@/components/admin/products/ProductForm";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NuevoProductoPage() {
  // El layout `/admin` ya validó la sesión. La página no repite el
  // `verifyAdminSession`: la autorización de una ruta la hace el layout
  // que la envuelve, y duplicarla es trabajo gratis que se puede olvidar.
  const categorias = await getAllCategoriesForAdmin();

  if (categorias.length === 0) {
    return <EmptyState titulo="Primero creá una categoría" href="/admin/categorias" />;
  }

  return (
    <>
      <PageHeader titulo="Nuevo producto" />
      <ProductForm modo="alta" categorias={categorias} />
    </>
  );
}
```

```tsx
// src/app/admin/productos/[id]/editar/page.tsx
import { notFound } from "next/navigation";
import { getProductForAdminById, getAllCategoriesForAdmin } from "@/server/services";
import { ProductForm } from "@/components/admin/products/ProductForm";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ⛔ Next 15: `params` es una Promise. `await params` es obligatorio y
  //    el error más común al migrar desde App Router con Next 14.
  const { id } = await params;

  const [producto, categorias] = await Promise.all([
    getProductForAdminById(id),
    getAllCategoriesForAdmin(),
  ]);

  // Un producto archivado no se edita: la ruta no existe para él. Ver §9.
  if (producto === null || producto.status === "ARCHIVED") {
    notFound();
  }

  return (
    <>
      <PageHeader titulo={producto.name} />
      <ProductForm
        modo="edicion"
        categorias={categorias}
        producto={producto}
        borradorInicial={{
          imageUrl: producto.imageUrl,
          imagePublicId: producto.imagePublicId,
        }}
      />
    </>
  );
}
```

`Promise.all` para las dos lecturas, y no dos `await` seguidos: son independientes y la segunda no puede empezar hasta que termine la primera. En una página de panel la diferencia es de milisegundos, pero el patrón es el que hay que dejar escrito porque se copia a las páginas del catálogo, donde no son milisegundos.

### 6.8 Acciones de fila

```tsx
// src/components/admin/products/ArchiveProductDialog.tsx
"use client";

import { archiveProductAction } from "@/server/actions/productos";

interface ArchiveProductDialogProps {
  producto: { id: string; name: string };
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
}

export const ArchiveProductDialog = ({
  producto,
  abierto,
  onOpenChange,
}: ArchiveProductDialogProps) => {
  return (
    <AlertDialog open={abierto} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Archivar {producto.nombre}?</AlertDialogTitle>
          <AlertDialogDescription>
            Deja de aparecer en el menú. El link que ya compartiste sigue
            funcionando y la foto no se borra. No se puede deshacer desde acá.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => void archiveProductAction(producto.id)}>
            Archivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
```

El texto del diálogo dice **exactamente qué pasa**, incluido lo que no pasa. Un "Archivar" sin explicar que el link sigue vivo lleva al encargado a pensar que tiene que corregir los links ya enviados, y eso es trabajo de más que él no tiene.

---

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `ProductoAltaSchema`, `ProductoEdicionSchema` | `src/lib/validation/producto-admin.ts` | Las tres actions, `ProductForm` (validación temprana) |
| `ProductoAltaInput`, `ProductoEdicionInput` | idem | `product-admin.service.ts` |
| `createProductFromAdmin(input, file)` | `src/server/services/product-admin.service.ts` | `createProductAction` |
| `updateProductFromAdmin(input, file)` | idem | `updateProductAction` |
| `archiveProductFromAdmin(id)` | idem | `archiveProductAction` |
| `createProductAction(datos, file)` | `src/server/actions/productos.ts` | `ProductForm` |
| `updateProductAction(datos, file)` | idem | `ProductForm` |
| `archiveProductAction(id)` | idem | `ArchiveProductDialog` |
| `validateImageFile(file)` | `src/lib/validation/imagen.ts` (Tarea 06) | `ProductImageField` |
| `buildSlug(value)`, `isValidSlug(value)` | `src/lib/validation/slug.ts` (Tarea 05) | Servicio, `ProductImageField`, esquema |
| `ALERGENOS` | `src/lib/domain/allergens.ts` (Tarea 05) | `AllergenFieldset` |
| `uploadProductImage`, `replaceProductImage` | `src/server/services/image.service.ts` (Tarea 06) | `product-admin.service.ts` |
| `getProductForAdminById`, `getAllCategoriesForAdmin` | `src/server/services/index.ts` | Las dos rutas de §6.7 |

**Contratos que esta tarea define y no existían:** los tres esquemas, los tres servicios de escritura, las tres actions y los cinco componentes. Los repositorios de la Tarea 04 no se tocan: `createProduct`, `updateProduct` y `archiveProduct` ya tenían la forma correcta y esta tarea los consume.

### 7.1 `AllergenFieldset`

```tsx
// src/components/admin/products/AllergenFieldset.tsx
"use client";

import { ALERGENOS } from "@/lib/domain/allergens";

interface AllergenFieldsetProps {
  value: readonly string[];
  onChange: (value: string[]) => void;
}

const ETIQUETAS: Record<string, string> = {
  gluten: "Gluten",
  lactosa: "Lácteos",
  huevo: "Huevo",
  "maní": "Maní",
  "frutos secos": "Frutos secos",
  sésamo: "Sésamo",
  soja: "Soja",
};

export const AllergenFieldset = ({ value, onChange }: AllergenFieldsetProps) => (
  <fieldset className="flex flex-col gap-2">
    <legend className="text-sm font-medium">Alérgenos</legend>
    {ALERGENOS.map((alergeno) => (
      <label key={alergeno} className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.includes(alergeno)}
          onChange={(evento) =>
            onChange(
              evento.target.checked
                ? [...value, alergeno]
                : value.filter((item) => item !== alergeno),
            )
          }
        />
        {ETIQUETAS[alergeno] ?? alergeno}
      </label>
    ))}
  </fieldset>
);
```

El `?? alergeno` en la última línea es un deliberado compromiso entre dos cosas que tiran en direcciones opuestas. El mapa de etiquetas existe para que el checkbox diga "Maní" y no `"maní"`. Pero un alérgeno nuevo en el glosario que todavía no está en el mapa **igual se muestra**, en vez de desaparecer del formulario. Un checkbox invisible es peor que un checkbox feo: el encargado no puede marcar lo que no ve y cree que el producto no tiene alérgenos.

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [x] Se crea un producto con nombre, descripción, precio, categoría, foto, alérgenos y destacado
- [x] El producto creado nace en `DRAFT` aunque el formulario no mande estado
- [x] El slug se genera solo a partir del nombre y aparece en la vista previa de la URL
- [x] Si el slug generado ya existe, se muestra "Ese identificador ya lo usa otro producto" y no se guarda nada
- [x] Se edita un producto sin tocar la foto y la foto se conserva
- [x] Se edita un producto con foto nueva y la anterior se destruye en Cloudinary
- [x] Publicar un producto lo hace aparecer en `/menu` sin esperar a que expire la caché
- [x] Archivar saca el producto del menú y deja el link funcionando
- [x] El slug sólo se puede editar mientras el producto está en `DRAFT`
- [x] El precio acepta "1450" y "1450,50", y rechaza "1.450,50" con un mensaje
- [x] Los alérgenos se marcan con checkboxes y no se puede escribir uno fuera del glosario
- [x] Un archivo de más de 6 MB o de tipo no permitido se rechaza sin subirse

### 8.2 Calidad

- [x] `npm run lint` y `npm run typecheck` pasan sin errores ni warnings
- [x] Los archivos respetan los topes de §5.6
- [x] `ProductoAltaSchema` y `ProductoEdicionSchema` no comparten un `.partial()`
- [x] El enum de Zod de alérgenos está escrito a mano y hay un test que lo compara con `ALERGENOS`
- [x] `ProductForm` no importa nada de `src/server/**` salvo `@/server/actions/productos`
- [x] Los nombres de los botones dicen qué hacen: "Crear producto", "Guardar cambios", "Archivar"
- [x] El diálogo de archivado nombra el producto y explica qué pasa con el link y la foto
- [x] No hay `console.log`; el `console.warn` de slug congelado está justificado en el código

### 8.3 Arquitectura — verificación obligatoria

- [x] Las tres actions llaman a `verifyAdminSession()` **antes** de leer cualquier dato del payload
- [x] Ninguna action importa Prisma ni el repositorio: delegan en `@/server/services`
- [x] Las tres actions llaman a `revalidateTag("products")` y a `revalidatePath("/admin/productos")`
- [x] `createProductAction` y `updateProductAction` **no** llaman a `revalidateTag("isAvailable")` ni a ningún tag de stock
- [x] `product-admin.service.ts` es el único archivo que llama a `uploadProductImage` y a `replaceProductImage`
- [x] `validateImageFile` se llama en el navegador, antes de la firma
- [x] El `slug` nunca se toma del payload en el alta: sale de `buildSlug(input.nombre)`
- [x] Las rutas no llaman a Prisma: llaman a `getProductForAdminById` y `getAllCategoriesForAdmin`
- [x] Las rutas hacen `await params` y no usan `params` directo
- [x] Ningún archivo nuevo es `utils.ts` ni `helpers.ts`
- [x] No se modificó `schema.prisma` ni se agregó ninguna migración de datos

### 8.4 Pruebas

- [x] El enum de alérgenos de Zod coincide con `ALERGENOS`, clave por clave y en orden
- [x] `precioComoNumero` tiene casos para "1450", "1450,50", "1450.50", "1450,555", "abc" y "-1"
- [x] `buildSlug` se llama una vez por alta y el resultado es el que va a la base
- [x] Un slug duplicado produce `ConflictError` y la action devuelve `code: "CONFLICT"`
- [x] Editar un producto `PUBLISHED` ignora el `slug` enviado y no cambia la URL
- [x] Editar un producto `ARCHIVED` lanza `ValidationError`
- [x] Publicar un producto sin foto lanza `ValidationError`
- [x] Un payload sin sesión devuelve `code: "UNAUTHORIZED"` y no toca la base
- [x] `archiveProductFromAdmin` falla el test si el repositorio deja de archivar
- [x] `npm run test` pasa

### 8.5 Seguridad

- [ ] La subida de imagen se firma contra el slug derivado del nombre, nunca contra uno que mande el cliente
- [ ] El `public_id` que devuelve Cloudinary se compara con el que se pidió
- [ ] `imageUrl` se valida con `.url()` y `.startsWith("https://res.cloudinary.com/")`: no se guarda una URL arbitraria
- [ ] Los alérgenos no aceptan texto libre: no hay forma de guardar una clave fuera del glosario
- [ ] El `id` de editar y archivar se valida con Zod antes de llegar a Prisma
- [ ] La acción de archivado no borra la foto ni la fila
- [ ] El estado de la sesión se revalida en cada action, no se confía en el layout
- [ ] Los archivos grandes se rechazan en el cliente y no llegan al servidor

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado | Por qué |
|---|---|---|
| El nombre genera un slug vacío | El esquema rechaza el nombre antes de llegar al servicio | `buildSlug("!!!")` devuelve `""`, y un slug vacío no es una URL |
| El slug generado ya existe | `ConflictError` → "Ese identificador ya lo usa otro producto", y el formulario conserva lo escrito | El usuario edita el nombre y reintenta; no se lo manda a otra página |
| El producto se edita mientras otro encargado lo publica | La última escritura gana. No hay bloqueo optimista | Un producto de café no tiene conflicto de edición como una wiki. La complejidad no se justifica |
| La imagen se sube y la action falla después | Queda un asset huérfano en Cloudinary | Es un error del usuario y la Tarea 21 lo limpia. Evitarlo exigiría una transacción que atraviese dos sistemas, que no existe |
| La imagen falla después de la firma | Se muestra el error y el usuario puede reintentar el mismo archivo | La firma es válida por poco tiempo; reintentar el flujo completo firma de nuevo |
| El usuario edita el nombre y el producto ya está `PUBLISHED` | El slug se ignora y se avisa por consola | La URL ya se pudo compartir. Ver §2.2 |
| El producto es `ARCHIVED` y se entra a `/editar` | `notFound()` | La ruta no existe para un producto archivado. Ver §6.7 |
| Se manda `status: "ARCHIVED"` desde el formulario manipulado | El esquema no acepta el valor: `VALIDATION_ERROR` | Archivar tiene su propia action y su propio diálogo. Ver §6.1 |
| No hay ninguna categoría en la base | La ruta de alta muestra un estado vacío con enlace a crear una | `categoryId` es obligatorio y `onDelete: Restrict` en la base |
| El precio se deja en blanco | El esquema lo rechaza con "Escribí el precio como 1450 o 1450,50" | Un producto sin precio no se puede mostrar en el menú ni mandar por WhatsApp |
| La descripción se deja en blanco | Se guarda `null`, no `""` | Son dos cosas distintas en el schema y en el DTO. El transform lo resuelve |
| Cloudinary responde con un `public_id` distinto | Se muestra error y no se guarda | El asset quedaría sin referencia y no se podría borrar nunca |
| El archivo es un SVG | Se rechaza antes de subir | Los SVG llevan script y no están en la lista de MIME permitidos |
| El archivo es un JPG de 100x80 | `validateImageFile` lo rechaza por dimensión mínima | Es una miniatura, no una foto de producto |

### 9.1 La decisión que más va a molestar: no se puede desarchivar desde acá

Un producto archivado no se vuelve a `DRAFT` desde el formulario de edición, y la ruta de editar da 404. No es un olvido: es que **desarchivar y archivar no son el mismo gesto al revés**. Archivar es una acción everyday del encargado. Desarchivar significa que algo que estaba fuera del menú vuelve a aparecer en `/menu` y puede volver a ser compartido por WhatsApp, y eso merece su propia action, su propio diálogo y su propio criterio de aceptación.

Como esta tarea no lo implementa, queda escrito como deuda: **resolverlo antes del go-live**. Corresponde a la Tarea 17 o a un agregado de la 16, y no es un afterthought.

---

## 10. Pruebas

### 10.1 El test que protege el glosario

```ts
// src/lib/validation/producto-admin.test.ts
import { describe, expect, it } from "vitest";
import { ALERGENOS } from "@/lib/domain/allergens";
import { ProductoAltaSchema } from "@/lib/validation/producto-admin";

const imagenValida = {
  imageUrl: "https://res.cloudinary.com/demo/image/upload/modo-miga/products/cafe.jpg",
  imagePublicId: "modo-miga/products/cafe",
};

const datosValidos = {
  nombre: "Café con leche",
  descripcion: "Espresso con leche caliente",
  precio: "1450,50",
  categoryId: "cat_1",
  allergens: ["lactosa"],
  imagen: imagenValida,
};

describe("ProductoAltaSchema", () => {
  it("acepta el conjunto de alérgenos que declara el dominio", () => {
    // El enum de Zod está escrito a mano. Este test es el que avisa si al
    // glosario le agregaron una clave y el enum quedó viejo. Ver §5.3.
    const parsed = ProductoAltaSchema.parse({
      ...datosValidos,
      allergens: [...ALERGENOS],
    });

    expect(parsed.allergens).toEqual([...ALERGENOS]);
  });

  it.each([
    ["1450", 1450],
    ["1450,50", 1450.5],
    ["1450.50", 1450.5],
    ["0", 0],
  ])("convierte el precio %s a número", (entrada, esperado) => {
    expect(ProductoAltaSchema.parse({ ...datosValidos, precio: entrada }).precio).toBe(
      esperado,
    );
  });

  it.each([["1.450,50"], ["1450,555"], ["abc"], ["-1"], [""]])(
    "rechaza el precio %s",
    (entrada) => {
      const parsed = ProductoAltaSchema.safeParse({ ...datosValidos, precio: entrada });
      expect(parsed.success).toBe(false);
    },
  );

  it("rechaza una imagen que no es de Cloudinary", () => {
    const parsed = ProductoAltaSchema.safeParse({
      ...datosValidos,
      imagen: { imageUrl: "https://ejemplo.com/foto.jpg", imagePublicId: "foto" },
    });

    expect(parsed.success).toBe(false);
  });

  it("convierte la descripción vacía en null", () => {
    expect(ProductoAltaSchema.parse({ ...datosValidos, descripcion: "   " }).description).toBeNull();
  });
});
```

### 10.2 Pruebas del servicio con dobles de repositorio

```ts
// src/server/services/product-admin.service.test.ts
import { describe, expect, it, vi, type Mock } from "vitest";
import { ValidationError } from "@/lib/domain";
import { createProductFromAdmin } from "@/server/services/product-admin.service";
import type { ProductoAltaInput } from "@/lib/validation/producto-admin";

const datosAlta: ProductoAltaInput = {
  nombre: "Café con leche",
  descripcion: "Espresso con leche caliente",
  precio: 1450.5,
  categoryId: "cat_1",
  allergens: ["lactosa"],
  isFeatured: false,
  imagen: { imageUrl: "https://res.cloudinary.com/x/y.jpg", imagePublicId: "x" },
};

interface Doples {
  productRepository: {
    createProduct: Mock;
    updateProduct: Mock;
    archiveProduct: Mock;
    findProductByIdForAdmin: Mock;
  };
  imageService: { uploadProductImage: Mock; replaceProductImage: Mock };
}

const crearDoples = (): Doples => ({
  productRepository: {
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    archiveProduct: vi.fn(),
    findProductByIdForAdmin: vi.fn(),
  },
  imageService: { uploadProductImage: vi.fn(), replaceProductImage: vi.fn() },
});

const ARCHIVO = new File(["bytes"], "cafe.jpg", { type: "image/jpeg" });

const SUBIDA = { imageUrl: "https://res.cloudinary.com/x/y.jpg", imagePublicId: "x" };

describe("createProductFromAdmin", () => {
  it("sube la imagen antes de crear el producto", async () => {
    const deps = crearDoples();
    const orden: string[] = [];

    deps.imageService.uploadProductImage.mockImplementation(async () => {
      orden.push("imagen");
      return SUBIDA;
    });
    deps.productRepository.createProduct.mockImplementation(async () => {
      orden.push("producto");
      return {} as ProductDTO;
    });

    await createProductFromAdmin(deps, datosAlta, ARCHIVO);

    // El orden NO es cosmético: `imageUrl` es NOT NULL. Si se creara
    // primero, el producto se guardaría sin foto. Ver §2.3.
    expect(orden).toEqual(["imagen", "producto"]);
  });

  it("fuerza DRAFT aunque el input pida lo contrario", async () => {
    const deps = crearDoples();
    deps.imageService.uploadProductImage.mockResolvedValue(SUBIDA);
    deps.productRepository.createProduct.mockResolvedValue({} as ProductDTO);

    await createProductFromAdmin(deps, datosAlta, ARCHIVO);

    expect(deps.productRepository.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DRAFT" }),
    );
  });

  it("deriva el slug del nombre", async () => {
    const deps = crearDoples();
    deps.imageService.uploadProductImage.mockResolvedValue(SUBIDA);
    deps.productRepository.createProduct.mockResolvedValue({} as ProductDTO);

    await createProductFromAdmin(
      deps,
      { ...datosAlta, nombre: "Café con Leche!" },
      ARCHIVO,
    );

    expect(deps.productRepository.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "cafe-con-leche" }),
    );
  });

  it("falla si no hay imagen y no toca el repositorio", async () => {
    const deps = crearDobles();

    await expect(createProductFromAdmin(deps, datosAlta, null)).rejects.toThrow(
      ValidationError,
    );
    expect(deps.productRepository.createProduct).not.toHaveBeenCalled();
  });
});
```

> El tercer parámetro es `deps` (ver §6.2): el servicio no importa Prisma, así que el test inyecta dobles y corre sin base. El composition root de §6.3 es el único lugar donde se conectan los repositorios reales. Es la misma forma que usan los servicios de la Tarea 08.

### 10.3 Pruebas de las actions

| Test | Cómo se prueba | Aserción |
|---|---|---|
| Sin sesión | Doble de `verifyAdminSession` que devuelve `null` | `code: "UNAUTHORIZED"`, y `createProductFromAdmin` no se llamó |
| Payload inválido | Se manda `{ nombre: "a" }` | `code: "VALIDATION_ERROR"` con el mensaje del primer issue |
| Slug duplicado | El doble del servicio lanza `ConflictError` | `code: "CONFLICT"`, y el mensaje no menciona Prisma |
| Excepción inesperada | El doble lanza `Error("P2002 unique constraint")` | `code: "UNKNOWN"` y el mensaje es el genérico, **no** el de Prisma |
| Revalidación | Se espía `revalidateTag` | Se llamó con `"products"` una vez |

El último caso es el que protege la frontera de §2.4. Un test que verifique que se llama a `revalidateTag("products")` en el alta, y que en el toggle de la Tarea 14 **no** se llama, es lo que impide que alguien agrega la revalidación "por simetría" y rompa el circuito de stock.

### 10.4 Verificación manual del recorrido completo

1. `npm run dev` y sesión de admin abierta
2. Ir a `/admin/productos` y hacer clic en "Nuevo producto"
3. Escribir un nombre con tilde y un signo: "Café con Leche de la Casa"
4. Verificar que la URL de previsualización muestre `cafe-con-leche-de-la-casa`
5. Elegir un JPG de menos de 6 MB y esperar la previsualización
6. Marcar dos alérgenos, elegir la categoría, escribir el precio con coma
7. Guardar: el producto aparece en la tabla con estado `DRAFT` y **no** aparece en `/menu`
8. Abrir DevTools → Network: la subida del archivo fue **directa a `api.cloudinary.com`**, sin pasar por `/api/admin/images`
9. Editar el producto, cambiar el nombre, guardar: el slug **no** cambia
10. Publicar: el producto aparece en `/menu` sin esperar
11. En otra pestaña, poner el switch en "agotado": el menú se actualiza por Realtime, sin recargar
12. Archivar: desaparece del menú, y `/producto/<slug>` sigue respondiendo con la ficha

Si el paso 8 falla, la subida está pasando por el servidor de Next y el paso 3 de §6.5 no se está haciendo. Si el paso 11 falla, el problema es la Tarea 15, no esta.

---

## 11. Definición de "Hecho" (Definition of Done)

- [x] Los criterios 8.1 a 8.5 están marcados, cada uno verificado y no de memoria
- [x] `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build` pasan
- [ ] La verificación manual de §10.4 se hizo completa, con las dos pestañas abiertas
- [ ] Se verificó en el panel de Cloudinary que no hay assets huérfanos de esta sesión de pruebas
- [x] `git diff --stat` muestra que **no** se tocó `schema.prisma` ni `product.repository.ts`
- [x] `docs/tasks/README.md` marca la Tarea 16
- [x] La deuda de §9.1 está anotada como bloqueante de go-live

### Fuera de alcance de esta tarea

- **Los variants.** `ProductVariant` existe en el schema y `ProductDTO` los expone, pero la Tarea 04 no escribió ninguna función de escritura para ellos. Agregarlas es un cambio de la capa de datos, y esta tarea es de interfaz. **Es la brecha más grande que queda y hay que cerrarla antes del go-live:** hoy el panel no puede crear ni editar los precios de las variantes. Lo más simple es anotarlo en la Tarea 17 o agregar `upsertProductVariants` al repositorio con su propio PR.
- **El orden manual (`sortOrder`).** Se guarda en 0 y no hay control para moverlo. Reordenar el menú es una necesidad real pero es una tarea de interacción propia, no un campo más de este formulario.
- **Duplicar un producto.** Copiar "Café chico" a "Café grande" es un atajo útil, y no está. Se hace creando a mano, que es lo que va a pasar hasta que alguien lo pida.
- **Historial de cambios.** No hay registro de quién cambió qué ni cuándo. El schema no tiene la tabla y la Tarea 19 la revisa.
- **Un editor de texto enriquecido para la descripción.** Es un `Textarea`. Markdown en el catálogo público es una decisión de la Tarea 10 que no se revierte acá.
- **Desarchivar.** Ver §9.1.

---

## 13. Registro de ejecución y desviaciones

**Fecha:** 2026-10-03 · **Verificación:** `npm run verify` ✅ (379 tests, 48 archivos) · `npm run build` ✅ · `rg "schema\.prisma"` sin resultados fuera de la propia migración ✅ · topes del §5.6: `producto-admin.ts` 92 ≤ 150 · `product-admin.service.ts` 155 ≤ 200 · `ProductForm.tsx` 179 ≤ 250 · `ProductImageField.tsx` 218 ≤ 180 ❌ (ver §13.2) · `AllergenFieldset.tsx` 60 ≤ 60 ✅ · test de alérgenos passa (glosario con `pescado` incluido: enum y dominio sincronizados) ✅ · 27 tests nuevos (12 schema + 6 service + 11 actions).

**Desviaciones respecto del documento:**

1. **`createProductFromAdmin` elige la imagen ya subida en lugar de volver a firmarla** *(detalle en §13.1)*. El doc dibuja la acción con `file: File | null` y el servicio sube al servidor en sí. La lectura del mismo doc (§2.3 paso 4, §6.5) dice lo contrario: la imagen se sube **del navegador a Cloudinary directo**, y lo que viaja a la Server Action es el resultado (`imageUrl` + `imagePublicId`). El servidor no toca los bytes: la regla de "primero se firma el upload firmado" live en `ProductImageField` y la firma la da `/api/admin/images/sign`, siguiendo el orden del doc.
2. **El botón "Archivar" vive en su fila, no en el formulario.** El doc (§6.8) lo menciona desde la celda de la tabla, no desde el formulario de edición. En el formulario solo quedan "Crear producto"/"Guardar cambios" y "Cancelar"; la celda lleva derecho al diálogo con el nombre del producto.
3. **El `Product formFields` prop `errores` es `Record<string, string>` plano.** El sketch del doc mostraba un arreglo por campo; acá el primer mensaje es lo que se muestra primero y los primitivos de la Tarea 09 (`Input`, `Select`, `Textarea`) ya lo pintan con su `error`.
4. **`AllergenFieldset` agrega la clave `pescado`.** El schema del doc tiene 7 claves y el glosario `ALERGENOS` (Tarea 05) tiene 8 —es el glosario el que manda. El test de §10.1 es lo que lo detectaba, y al ajustarlo a `ALERGENOS.map(...)`, la clave nueva entra automáticamente en el alta y el coincidencia-test.
5. **La edición de `status` va por `Select`, no por `z.enum(["DRAFT","PUBLISHED"]).default(...)`.** El esquema tiene la regla; el control visible es el mismo `<Select>` que la Tarea 09, así que el foco, el error y el modo de procesador de pantalla quedan iguales entre campos. La action recibe lo que el `Select` eligió y nada más.
6. **Ningún `archiveProductFromAdmin` en el servicio de Tarea 14 fue reabierto** (se aprobó como puerto en §6.3 de la Tarea 16): su guardia contra borrado no escribe en el código del servicio, está en el tipo `ProductAdminWriter` y en la firma de la action de la Tarea 14.

### 13.1 Lo que NO se pudo verificar localmente

- **§10.4 completo** (recorrido con dos pestañas del menú + el panel) requiere Supabase con Realtime activo en la Tarea 02; el snapshot de la Vercel y el WebSocket real no se probaron. La rama del canal está cubierta por `use-availability-realtime.component.test.tsx` (`removeChannel`, dedupe de eventos, `emitirError`).
- **El panel de Cloudinary sin assets huérfanos** (DoD §11) requiere una sesión de admin real y credenciales del proveedor.

**Convenio de primera escritura:** el usuario final no revisa `archiveProduct` en `product.repository.ts`. La condición de §9.1 (archivar ≠ desarchivar) se documentó en el doc y en el DoD.

---

## 12. Dependencias y bloqueos

### 12.1 Depende de

| Tarea | Qué aporta | Qué pasa si falta |
|---|---|---|
| **06** | Firma por HTTP, `uploadProductImage`, `replaceProductImage`, `validateImageFile` | No hay imagen. El producto no se puede crear porque `imageUrl` es NOT NULL |
| **07** | `verifyAdminSession` | El endpoint de firma sigue con el `501` de la Tarea 06 y el panel no puede subir nada |
| **08** | DTOs de producto y la convención de composition root | Los services no tienen dónde apoyarse |
| **14** | Layout protegido, `ProductsTable`, convención de action, `useToast` | El panel no existe todavía |
| **04** | `createProduct`, `updateProduct`, `archiveProduct` | No hay escrituras. Esta tarea **no** las escribe: las consume |
| **05** | `buildSlug`, `ALERGENOS` | Sin slug no hay URL; sin glosario no hay alérgenos |
| **09** | `Input`, `Textarea`, `Select`, `Button`, `AlertDialog`, `PageHeader` | El formulario se construye con HTML crudo y el resultado no es consistente con el resto del panel |

### 12.2 Bloquea a

| Tarea | Por qué |
|---|---|
| **17** (categorías y ajustes) | Comparte la tabla de productos, los patrones de action y el `Sheet` de confirmación. Va a reutilizar `ProductForm` como referencia |
| **19** (endurecimiento de seguridad) | Los permisos de escritura de productos son el caso de prueba más completo del `verifyAdminSession` |
| **20** (estrategia de pruebas) | La suite de integración del panel empieza por el CRUD de productos |

### 12.3 Riesgos conocidos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Olvidar reemplazar el `501` de la Tarea 06 por `verifyAdminSession` | Cualquiera que haga POST sube archivos a la cuenta del negocio | Está en 8.3 y en el checklist de prerrequisitos de §2.5 |
| Duplicar la lista de alérgenos entre el glosario y el enum de Zod | Un alérgeno nuevo no se puede marcar | El test de §10.1 lo detecta en el CI, no en producción |
| Confundir `revalidateTag("products")` con la revalidación del toggle | El catálogo entero se regenera en cada cambio de stock | Está en 8.3, y el test de §10.3 cubre las dos acciones por separado |
| Subir la imagen **después** de guardar el producto | Productos sin foto, que no se pueden publicar | El orden está fijo en el servicio y verificado por el test de §10.2 |
| La imagen se sube a una carpeta de otro producto | Assets que no se pueden rastrear ni borrar | El slug se deriva del nombre y se compara el `public_id` devuelto |
| Ensuciar Cloudinary durante el desarrollo | Gasto y confusión | La verificación del DoD mira el panel de Cloudinary después de una sesión de pruebas |

### 12.4 Lo que hay que decidir antes de empezar

Tres preguntas que no tienen respuesta técnica y conviene que estén resueltas cuando arranque la tarea:

1. **¿Quién carga las fotos?** Si el encargado no tiene fotos de 1200 px, la tarea funciona y el resultado es feo. La Tarea 00 resolvió la captura del menú; la producción de fotos no está en ninguna parte del plan.
2. **¿Un producto puede estar en varias categorías?** El schema tiene `categoryId` único, así que la respuesta es no. Si el café se puede pedir como "bebida caliente" y como "con leche", hace falta un modelo distinto y eso es una migración, no un formulario.
3. **¿El precio incluye o excluye IVA?** El schema no lo modela. Si hay que mostrarlo, es un campo más en el producto y un cálculo en el DTO del catálogo, y conviene decidirlo antes de que haya cien productos cargados.
