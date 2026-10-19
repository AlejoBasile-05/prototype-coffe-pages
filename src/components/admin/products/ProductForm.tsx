"use client";

/**
 * Formulario de producto del panel (Tarea 16 §6.6).
 *
 * Un solo componente para alta y edición: la forma del resultado es la
 * misma, y tener dos componentes era la forma más corta de que a uno
 * le falten la mitad de las validaciones del otro.
 *
 * ⛔ Este componente NO importa nada de `src/server/**` salvo las
 *    actions. Los tipos y el esquema viven en `src/lib/validation`,
 *    justamente para validar antes de subir la imagen (§2.3 y §5.1).
 */
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";
import type { CategoryDTO, ProductDTO } from "@/lib/domain";
import { ProductoAltaSchema, ProductoEdicionSchema } from "@/lib/validation/producto-admin";
import { createProductAction, updateProductAction } from "@/server/actions/productos";

import { AllergenFieldset } from "./AllergenFieldset";
import { ProductFormFields, type ProductFormMode } from "./ProductFormFields";
import { ProductImageField } from "./ProductImageField";

export type ArchiveButtonSlot = {
  /** El diálogo "Archivar" es un componente aparte, montado por la celda. */
  producto: { id: string; name: string };
};

interface ProductFormProps {
  readonly modo: ProductFormMode;
  readonly categorias: readonly CategoryDTO[];
  readonly producto?: ProductDTO | undefined;
}

type ActionState =
  | { ok: true }
  | {
      ok: false;
      error: string;
      code: string;
      fieldErrors?: Record<string, string>;
    };

/** El primer mensaje de cada campo, para colgarlo del control correcto. */
const mapErrores = (
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string> => {
  const errores: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "general");
    if (!(key in errores)) errores[key] = issue.message;
  }
  return errores;
};

async function accionesDelServidor(
  modo: ProductFormMode,
  id: string | undefined,
  _estadoAnterior: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    nombre: String(formData.get("nombre") ?? ""),
    descripcion: String(formData.get("descripcion") ?? ""),
    precio: String(formData.get("precio") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    allergens: formData.getAll("allergens").map(String),
    isFeatured: formData.get("isFeatured") === "on",
  };

  // El archivo no viaja en la Server Action: la imagen se subió directo a
  // Cloudinary en el componente `ProductImageField`, y lo que llega acá
  // es el resultado serializado (la ruta "/api/admin/images/sign" ya le
  // dio la firma).
  const imagenCruda = formData.get("imagenSubida");
  const imagen =
    typeof imagenCruda === "string" && imagenCruda.length > 0
      ? (JSON.parse(imagenCruda) as { imageUrl: string; imagePublicId: string })
      : undefined;

  if (modo === "alta") {
    const parsed = ProductoAltaSchema.safeParse({ ...raw, imagen });
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Revisá el formulario",
        code: "VALIDATION_ERROR",
        fieldErrors: mapErrores(parsed.error.issues),
      };
    }
    return (await createProductAction(parsed.data, null)) as ActionState;
  }

  const parsed = ProductoEdicionSchema.safeParse({
    ...raw,
    id: id ?? "",
    imagen,
    slug: formData.get("slug") ? String(formData.get("slug")) : undefined,
    status: formData.get("status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisá el formulario",
      code: "VALIDATION_ERROR",
      fieldErrors: mapErrores(parsed.error.issues),
    };
  }
  return (await updateProductAction(parsed.data, null)) as ActionState;
}

export const ProductForm = ({ modo, categorias, producto }: ProductFormProps) => {
  const router = useRouter();
  const [estado, dispatch, pendiente] = useActionState(
    (anterior: ActionState, formData: FormData) =>
      accionesDelServidor(modo, producto?.id, anterior, formData),
    { ok: false, error: "", code: "IDLE" } as ActionState,
  );

  // La imagen subida en el componente de foto se serializa como campo
  // oculto del formulario: sin ese paso, si la Action fallaba después
  // de la subida, la URL quedaba perdida entre el estado local y el
  // servidor.
  const [imagen, setImagen] = useState<string>(() =>
    producto?.imagePublicId
      ? JSON.stringify({
          imageUrl: producto.imageUrl,
          imagePublicId: producto.imagePublicId,
        })
      : "",
  );

  // Cuando la action confirma el alta o la edición, el panel vuelve a la
  // lista. La aclaración vive en el toast del hook padre del listado.
  if (estado.ok) {
    router.push("/admin/productos");
    router.refresh();
  }

  return (
    <form action={dispatch} className="flex flex-col gap-6">
      {/* El `key` no es un detalle de React: sin él, al navegar de un
          producto a otro con el mismo componente montado, el formulario
          muestra los valores del producto anterior. */}
      <ProductFormFields
        key={modo === "edicion" ? producto?.id : "nuevo"}
        modo={modo}
        categorias={categorias}
        {...(producto !== undefined && { producto })}
        errores={estado.ok ? {} : (estado.fieldErrors ?? {})}
      />

      <input type="hidden" name="imagenSubida" value={imagen} />

      <ProductImageField
        nombre={producto?.name ?? ""}
        {...(producto?.imagePublicId !== null && producto?.imagePublicId !== undefined
          ? { imagenActual: { imageUrl: producto.imageUrl, imagePublicId: producto.imagePublicId } }
          : {})}
        onChange={(subida) => {
          setImagen(subida ? JSON.stringify(subida) : "");
        }}
      />

      <AllergenFieldset value={producto?.allergens ?? []} onChange={() => {}} />

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={pendiente} className="min-h-11">
          {pendiente ? "Guardando…" : modo === "alta" ? "Crear producto" : "Guardar cambios"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};
