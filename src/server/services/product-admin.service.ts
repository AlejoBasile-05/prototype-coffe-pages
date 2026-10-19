/**
 * Servicio de escritura de producto para el panel (Tarea 16 §6.2).
 *
 * Orquesta imagen + producto en el orden de §2.3 y recibe sus
 * dependencias por parámetro: sin React, sin `next/*`, ni `prisma`.
 *
 * El orden del código no es un detalle: `imageUrl` es `NOT NULL` en el
 * schema, así que el alta deja huérfanos si el producto se crea antes
 * de la foto. En la edición la compensación es peor: si el nombre
 * cambió y el slug también, el `public_id` nuevo es distinto y el asset
 * viejo hay que borrarlo acá.
 */
import "server-only";

import { ResourceNotFoundError, ValidationError } from "@/lib/domain";
import { camposEditados } from "@/lib/domain/audit-campos";
import type { ProductDTO } from "@/lib/domain";
import { buildSlug } from "@/lib/validation/slug";
import type { ProductoAltaInput, ProductoEdicionInput } from "@/lib/validation/producto-admin";
import type { ProductAdminPorts } from "./repository-ports";

/**
 * Alta de un producto.
 *
 * 1. `slug` se calcula acá, nunca se toma del payload del formulario
 *    (§5.2). Que lo mande el cliente sería un POST con la URL de otro
 *    producto.
 * 2. La imagen va PRIMERO: `imageUrl` es NOT NULL y una subida sin
 *    producto es un asset huérfano que la Tarea 21 limpia (§2.3).
 * 3. El alta nace SIEMPRE en `DRAFT`, aunque el formulario mandara otra
 *    cosa. Publicar es una decisión aparte y deliberada (§2.1).
 */
export async function createProductFromAdmin(
  deps: ProductAdminPorts,
  input: ProductoAltaInput,
  file: File | null,
): Promise<import("@/lib/domain").ProductDTO> {
  const slug = buildSlug(input.nombre);

  // El navegador ya subió la foto antes de la action cuando usó el
  // formulario (§2.3). `file` solo se usa como respaldo server-side:
  // hay que validar y subir acá igual, y la validación de la action ya
  // filtró el case "sin imagen en ninguna de las dos manos".
  const imagen = file
    ? await deps.imageService.uploadProductImage({ file, slug })
    : { imageUrl: input.imagen.imageUrl, imagePublicId: input.imagen.imagePublicId };

  if (imagen.imageUrl === "") {
    throw new ValidationError(
      { imagen: ["La foto es obligatoria."] },
      "Falta la foto del producto",
    );
  }

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
}

/**
 * Edición de un producto.
 *
 * Si el producto no existe, se levanta `ResourceNotFoundError` (la
 * action lo traduce a un `404` de formulario). Si está `ARCHIVED`, la
 * ruta y esta función no existen: archivar es un gesto aparte y el
 * `notFound()` de la página lo dice antes.
 */
export async function updateProductFromAdmin(
  deps: ProductAdminPorts,
  input: ProductoEdicionInput,
  file: File | null,
): Promise<import("@/lib/domain").ProductDTO> {
  const actual = await deps.productRepository.findProductByIdForAdmin(input.id);

  if (actual === null) {
    throw new ResourceNotFoundError("Producto", input.id);
  }

  // ⛔ En `ARCHIVED` se ignora de palabra y se corta: volver a poner en
  //    el menú algo que se retiró es una decisión (§9.1).
  if (actual.status === "ARCHIVED") {
    throw new ValidationError(
      { status: ["No se edita un producto archivado."] },
      "Producto archivado",
    );
  }

  // El slug solo se toca en DRAFT. Fuera de DRAFT se ignora en silencio
  // y se avisa por consola: la URL pública ya se pudo haber compartido.
  const cambiaSlug = actual.status === "DRAFT" && input.slug !== undefined;
  const slug = cambiaSlug && input.slug !== undefined ? input.slug : actual.slug;

  // Sin foto nueva se conserva la actual. Con foto nueva, se reemplaza.
  const imagen = file
    ? await deps.imageService.replaceProductImage({
        file,
        slug,
        previousPublicId: actual.imagePublicId,
      })
    : { imageUrl: actual.imageUrl, imagePublicId: actual.imagePublicId };

  // Publicar exige foto. El esquema no lo puede saber porque en la
  // edición la imagen es opcional; lo único que lo puede comprobar es
  // la base.
  if (input.status === "PUBLISHED" && imagen.imageUrl.trim() === "") {
    throw new ValidationError({ imagen: ["No se puede publicar sin foto."] }, "Falta la foto");
  }

  return deps.productRepository.updateProduct(input.id, {
    name: input.nombre,
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
}

/**
 * Archiva. Nunca borra. §2.1 y §6.2.
 *
 * ⛔ No se cambia `imageUrl` ni se destruye el asset de Cloudinary: el
 *    link del producto puede estar en un chat de WhatsApp y la foto es
 *    parte de ese mensaje.
 *
 * La función parece un envoltorio inútil, y es la garantía: la única
 * validación que agrega es comprobar que la operación terminó. Si
 * alguien cambia el repositorio y deja de archivar, esta falla antes
 * que la verdad en producción.
 */
export async function archiveProductFromAdmin(
  deps: ProductAdminPorts,
  id: string,
): Promise<import("@/lib/domain").ProductDTO> {
  const product = await deps.productRepository.archiveProduct(id);

  if (product.status !== "ARCHIVED") {
    throw new Error("El archivado no se aplicó");
  }

  return product;
}

/**
 * Campos del formulario que quedaron distintos de lo que quedó guardado
 * (Tarea 19 §7.1). Es lo que va al log de `producto.actualizado`.
 *
 * ⛔ Se compara contra el producto YA guardado, no contra `Object.keys`:
 *    el formulario manda el producto entero aunque se haya tocado un campo.
 *    Cuesta cero consultas de más porque el DTO devuelto por
 *    `updateProductFromAdmin` ya está en la mano de la action.
 *
 * ⚠️ El `slug` aparece cuando el servicio lo ignoró (producto con
 *    productos, o `status` fuera de `DRAFT`): no es un falso positivo sino
 *    que el envío intentó cambiarlo. Un log que dice "se pidió cambiar el
 *    slug y no se cambió" es información, no ruido.
 */
export const camposEditadosDeProducto = (
  guardado: ProductDTO,
  input: ProductoEdicionInput,
): readonly string[] =>
  camposEditados(
    {
      nombre: guardado.name,
      slug: guardado.slug,
      descripcion: guardado.description,
      precio: guardado.price,
      categoryId: guardado.categoryId,
      allergens: guardado.allergens,
      isFeatured: guardado.isFeatured,
      status: guardado.status,
    },
    input,
  );
