/**
 * Tabla de categorías del panel.
 *
 * ⛔ Server Component: solo pinta las filas que el servicio ya
 *    proyectó. Toda la interactividad (el switch de visibilidad y los
 *    diálogos de editar y borrar) vive en `CategoryRowActions`, que es
 *    Client Component.
 *
 * La grilla del índice del menú necesita un enlace con el slug ancla
 * (`/menu#postres`), así que el slug se muestra ya como URL. Un `slug`
 * con caracteres de control produciría una sección sin ancla válida, y
 * no se ve de afuera; el `Badge` inferior también lo dice (§5.10).
 */
import { Badge } from "@/components/ui";
import type { CategoryRow } from "@/lib/domain";

import { CategoryRowActions } from "./CategoryRowActions";

interface CategoryTableProps {
  readonly filas: readonly CategoryRow[];
}

export function CategoryTable({ filas }: CategoryTableProps) {
  if (filas.length === 0) {
    return null;
  }

  return (
    <div className="rounded-card border-line bg-paper overflow-x-auto border">
      <table className="w-full min-w-3xl border-collapse text-left text-sm">
        <caption className="sr-only">
          Categorías del menú, con su visibilidad y conteo de productos.
        </caption>
        <thead>
          <tr className="border-line text-ink-muted border-b text-xs tracking-wide uppercase">
            <th scope="col" className="px-4 py-3">
              Categoría
            </th>
            <th scope="col" className="px-4 py-3">
              Visible
            </th>
            <th scope="col" className="px-4 py-3">
              Productos
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.id} className="border-line border-b last:border-0">
              <th scope="row" className="px-4 py-3 font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{fila.nombre}</span>
                  <span className="text-ink-muted text-xs">
                    /menu/{fila.slug} · {fila.productCount}{" "}
                    {fila.productCount === 1 ? "producto" : "productos"}
                  </span>
                </div>
              </th>

              <td className="px-4 py-3">
                {!fila.isVisible && <Badge tone="danger">Oculta</Badge>}
              </td>

              <td className="px-4 py-3">
                <span className="font-display text-ink tabular-nums">{fila.productCount}</span>
              </td>

              <td className="px-4 py-3">
                <CategoryRowActions fila={fila} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
