"use client";

/**
 * Dialog de alta y edición de categoría (Tarea 17 §6.10).
 *
 * El slug del alta **se muestra pero no se manda**: la vista previa sale
 * de `buildSlug(nombre)` en el navegador y el servicio lo vuelve a
 * calcular en el servidor. Mandar el slug y que el servidor confíe en
 * él sería una puerta abierta (§5.2).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, useToast } from "@/components/ui";
import { buildSlug } from "@/lib/validation/slug";
import type { CategoryRow } from "@/lib/domain";
import { createCategoryAction, updateCategoryAction } from "@/server/actions/categorias";

interface CategoriaFormularioProps {
  readonly fila: CategoryRow | null;
  readonly onClose: () => void;
}

export function CategoryFormDialog({ fila, onClose }: CategoriaFormularioProps) {
  const router = useRouter();
  const { show } = useToast();
  const [nombre, setNombre] = useState(fila?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(fila?.descripcion ?? "");
  const [isVisible, setIsVisible] = useState(fila?.isVisible ?? true);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [pendiente, startTransition] = useTransition();

  const esNuevo = fila === null;
  const slugEditable = esNuevo || fila.isSlugEditable;
  // La vista previa se calcula SIEMPRE: en el alta sale del nombre en
  // tiempo real, y en la edición muestra el slug que tiene la fila aunque
  // el editor todavía no haya tocado el campo (animación de apertura).
  // La vista previa del alta sale del nombre en el navegador y nunca se
  // persiste como entrada del formulario. El servidor lo recalcula.
  const [slugEditado, setSlugEditado] = useState(fila?.slug ?? "");
  const slugPreview = esNuevo ? buildSlug(nombre) : slugEditado;

  const handleSubmit = (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setErrorGeneral(null);
    setErrores({});

    startTransition(async () => {
      const payload = esNuevo
        ? { nombre, descripcion }
        : {
            id: fila.id,
            nombre,
            descripcion,
            isVisible,
            // Si el slug no es editable no viene en el payload: el
            // esquema lo marca como opcional y el servicio lo ignora
            // igual. Ver §2.4 y §5.2.
            ...(slugEditable ? { slug: slugPreview } : {}),
          };

      const result = esNuevo
        ? await createCategoryAction(payload)
        : await updateCategoryAction(payload);

      if (result.ok) {
        show(esNuevo ? `"${nombre}" creada.` : "Los cambios quedaron guardados.", "success");
        onClose();
        router.refresh();
        return;
      }

      setErrorGeneral(result.error);
      if (result.fieldErrors) {
        setErrores(
          Object.fromEntries(
            Object.entries(result.fieldErrors).map(([clave, mensajes]) => [
              clave,
              mensajes[0] ?? result.error ?? "",
            ]),
          ),
        );
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-panel border-line-strong bg-paper shadow-lifted fixed inset-4 z-50 m-auto flex max-w-lg flex-col gap-4 border p-6"
    >
      <h2 className="font-display text-ink text-xl">
        {esNuevo ? "Nueva categoría" : `Editar ${fila?.nombre ?? ""}`}
      </h2>

      {errorGeneral && (
        <p
          role="alert"
          className="rounded-control border-clay/35 bg-clay/10 text-clay-deep px-3 py-2 text-sm"
        >
          {errorGeneral}
        </p>
      )}

      <div>
        <label htmlFor="categoria-nombre" className="text-ink text-sm font-medium">
          Nombre
        </label>
        <input
          id="categoria-nombre"
          name="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="border-line-strong bg-paper rounded-control mt-1 w-full border px-3 py-2 text-sm"
        />
        {errores.nombre && <p className="text-clay mt-1 text-xs">{errores.nombre}</p>}
      </div>

      <div>
        <label htmlFor="categoria-descripcion" className="text-ink text-sm font-medium">
          Descripción (opcional)
        </label>
        <input
          id="categoria-descripcion"
          name="descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="border-line-strong bg-paper rounded-control mt-1 w-full border px-3 py-2 text-sm"
        />
        {errores.descripcion && <p className="text-clay mt-1 text-xs">{errores.descripcion}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-ink text-sm font-medium">Visibilidad en el menú</span>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isVisible}
            onChange={(e) => setIsVisible(e.target.checked)}
            className="size-4"
          />
          Que aparezca
        </label>
      </div>

      <div>
        <label
          htmlFor="categoria-slug"
          className={`text-sm font-medium ${slugEditable ? "text-ink" : "text-ink-muted"}`}
        >
          Identificador de la URL
        </label>
        <input
          id="categoria-slug"
          name="slug"
          value={slugPreview}
          disabled={!slugEditable}
          onChange={(e) => setSlugEditado(e.target.value)}
          className="border-line-strong bg-cream rounded-control mt-1 w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        />
        {slugEditable && errores.slug && <p className="text-clay mt-1 text-xs">{errores.slug}</p>}
        <p className="text-ink-muted mt-1 text-xs">
          {slugEditable
            ? "Es la parte de la URL del menú que la comparte: `/menu#postres`."
            : "Solo se puede cambiar mientras la categoría no tenga productos."}
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={pendiente}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : esNuevo ? "Crear categoría" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
