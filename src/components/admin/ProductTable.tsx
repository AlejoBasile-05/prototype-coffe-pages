import Image from "next/image";

import { ProductRowActions } from "./products/ProductRowActions";
import { AvailabilitySwitch } from "./AvailabilitySwitch";
import { Badge } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { t } from "@/config/prototype";
import { formatARS } from "@/lib/format/currency";
import type { ProductRow, ProductStatusDTO } from "@/lib/domain";

const STATUS_LABEL: Record<ProductStatusDTO, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
};

const STATUS_TONE: Record<ProductStatusDTO, BadgeTone> = {
  // `warning` en lugar de `danger`: un borrador no es un error, es una
  // fila a medio hacer. `danger` reservado a lo que está roto.
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "danger",
};

const HEAD_CELL = "px-4 py-3";

/**
 * Tabla de productos del panel.
 *
 * ⛔ Server Component. Solo pinta filas que el servicio ya armó, incluido
 *    el nombre de la categoría: la vista no arma objetos ni junta datos.
 *    Toda la interactividad está en `AvailabilitySwitch` (toggle de stock)
 *    y el `<Link>` de edición (navegación pura), que son los únicos Client
 *    Components de la tabla.
 *
 * ⚠️ La columna de `status` es un solo `Badge` con color, no un control
 *    editable: cambiar el estado editorial es la Tarea 16 y va con
 *    `ConfirmDialog` cuando es archivado. Un select sin confirmación es
 *    la forma más corta de despublicar medio menú con un clic mal apoyado.
 *    Y el switch **no** escribe `status`: son ejes independientes (§4.4).
 */
export function ProductTable({ products }: { readonly products: readonly ProductRow[] }) {
  return (
    <div className="rounded-card border-line bg-paper overflow-x-auto border">
      <table className="w-full min-w-3xl border-collapse text-left text-sm">
        <caption className="sr-only">
          {t("products")}, con su categoría, precio, estado editorial y disponibilidad.
        </caption>
        <thead>
          <tr className="border-line text-ink-muted border-b text-xs tracking-wide uppercase">
            <th scope="col" className={HEAD_CELL}>
              {t("product")}
            </th>
            <th scope="col" className={HEAD_CELL}>
              {t("category")}
            </th>
            <th scope="col" className={`${HEAD_CELL} text-right`}>
              Precio
            </th>
            <th scope="col" className={HEAD_CELL}>
              Estado
            </th>
            <th scope="col" className={HEAD_CELL}>
              Disponible
            </th>
            <th scope="col" className={HEAD_CELL}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-line border-b last:border-0">
              <th scope="row" className={`${HEAD_CELL} font-normal`}>
                <div className="flex items-center gap-3">
                  {/* `alt=""` a propósito: la celda de al lado ya dice el
                      nombre del producto en texto, y repetirlo hace que un
                      lector de pantalla lo anuncie dos veces por fila. */}
                  <Image
                    src={product.imageUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="rounded-control size-12 shrink-0 object-cover"
                  />
                  <span className="min-w-0">
                    <span className="text-ink block truncate font-medium">{product.name}</span>
                    <span className="text-ink-muted block text-xs">/{product.slug}</span>
                  </span>
                </div>
              </th>

              <td className={`${HEAD_CELL} text-ink-muted`}>{product.categoryName}</td>

              <td className={`${HEAD_CELL} text-right`}>
                <span className="font-display text-ink tabular-nums">
                  {formatARS(product.price)}
                </span>
              </td>

              <td className={HEAD_CELL}>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge tone={STATUS_TONE[product.status]}>{STATUS_LABEL[product.status]}</Badge>
                  {product.isFeatured && <Badge tone="warning">Destacado</Badge>}
                </div>
              </td>

              <td className={HEAD_CELL}>
                <AvailabilitySwitch
                  productId={product.id}
                  productName={product.name}
                  isAvailable={product.isAvailable}
                />
              </td>

              <td className={HEAD_CELL}>
                <ProductRowActions
                  productId={product.id}
                  productName={product.name}
                  status={product.status}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
