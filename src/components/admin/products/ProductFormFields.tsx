"use client";

/**
 * Campos del formulario de producto, sin estado ni acciones. Separado
 * del formulario final por dos motivos concretos:
 *
 * · El `key` de `ProductForm` es lo que reinicia los valores cuando se
 *   navega de un producto a otro con el mismo componente montado; si
 *   los campos compartieran el estado del formulario, el remount no se
 *   vería (ver §6.6 del doc).
 *
 * · Los tests de la parte visual del formulario montan SOLO estos
 *   campos con `defaultValue`, sin tener que montar el formulario
 *   completo ni interceptar la action.
 */
import { Input } from "@/components/ui";
import { Select } from "@/components/ui";
import { Textarea } from "@/components/ui";
import type { CategoryDTO, ProductDTO } from "@/lib/domain";

export type ProductFormMode = "alta" | "edicion";

/**
 * Campos de error por control, en forma que los primitivos `<input>`
 * pueden leer. La primera que se escribe es la única que queda: tiene
 * más sentido leer y corregir de a uno.
 */
export type ProductFormFieldsErrors = Partial<
  Record<
    "nombre" | "slug" | "descripcion" | "precio" | "categoryId" | "imagen" | "general",
    string | undefined
  >
>;

interface ProductFormFieldsProps {
  readonly modo: ProductFormMode;
  readonly categorias: readonly CategoryDTO[];
  readonly producto?: ProductDTO | undefined;
  readonly errores: ProductFormFieldsErrors;
}

export function ProductFormFields({ modo, categorias, producto, errores }: ProductFormFieldsProps) {
  const slugDeshabilitado = modo === "edicion" && producto?.status !== "DRAFT";

  return (
    <>
      {errores.general && (
        <p
          role="alert"
          className="rounded-control border-clay/35 bg-clay/10 text-clay-deep px-3 py-2 text-sm"
        >
          {errores.general}
        </p>
      )}

      <Input
        name="nombre"
        label="Nombre"
        defaultValue={producto?.name ?? ""}
        required
        error={errores.nombre}
        hint="Aparece en el menú y en la URL. Lo mejor es escribirlo primero y revisar la vista previa."
        maxLength={120}
      />

      <Input
        name="slug"
        label="Slug (URL del producto)"
        defaultValue={producto?.slug ?? ""}
        error={errores.slug}
        disabled={slugDeshabilitado}
        hint={
          slugDeshabilitado
            ? "Solo se puede cambiar mientras está en borrador."
            : "Se genera a partir del nombre. En borrador se puede corregir."
        }
      />

      <Textarea
        name="descripcion"
        label="Descripción"
        defaultValue={producto?.description ?? ""}
        rows={4}
        maxLength={600}
        error={errores.descripcion}
        hint="Opcional. Salta la línea corta del producto en la lista del menú."
      />

      <Input
        name="precio"
        label="Precio (en pesos)"
        defaultValue={producto ? String(producto.price) : ""}
        inputMode="decimal"
        required
        error={errores.precio}
        hint="Se aceptan coma o punto decimal (1450,50 o 1450.50)."
      />

      <Select
        name="categoryId"
        label="Categoría"
        defaultValue={producto?.categoryId ?? ""}
        required
        {...(errores.categoryId !== undefined ? { error: errores.categoryId } : {})}
        options={categorias.map((categoria) => ({
          value: categoria.id,
          label: categoria.name,
        }))}
        placeholder="Elegí una categoría"
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isFeatured"
          defaultChecked={producto?.isFeatured ?? false}
          className="size-4"
        />
        <span>Mostrar como destacado en la portada</span>
      </label>

      {/* La edición de `status` (publicar / despublicar) es el punto del
          formulario. Un `Select` con las dos opciones válidas, nunca
          `ARCHIVED`: archivar es otro gesto (ver §6.1). */}
      <Select
        name="status"
        label={modo === "alta" ? "Visibilidad inicial" : "Estado editorial"}
        defaultValue={modo === "edicion" ? (producto?.status ?? "DRAFT") : "DRAFT"}
        options={[
          { value: "DRAFT", label: "Borrador (no visible en el menú)" },
          { value: "PUBLISHED", label: "Publicado (visible en /menu)" },
        ]}
      />
    </>
  );
}
