import Link from "next/link";

import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui";
import { t } from "@/config/prototype";
import { isSettingsConfigured } from "@/lib/validation/ajustes";
import { getOrdersForBoard, getProductsForAdmin, getSettingsForAdmin } from "@/server/services";
import type { BusinessSettingsDTO } from "@/lib/domain";

export const dynamic = "force-dynamic";

/** Lo que todavía no está cargado se muestra como tal, no como un 0. */
const SIN_CARGAR = "Sin cargar";

/**
 * ⛔ No se usa `getPublicCatalog()` para contar.
 *
 * El catálogo público viene de la caché ISR y ve solamente `PUBLISHED`. El
 * panel tiene que contar borradores y archivados también: un dueño que no
 * ve que tiene cuatro borradores no sabe que hay que publicarlos. Se lee
 * la lista del admin, que es la única fuente completa.
 */
const AdminDashboard = async () => {
  const [products, settings, orders] = await Promise.all([
    getProductsForAdmin(),
    getSettingsForAdmin(),
    // Degradación elegante (Tarea 23): el contador de pendientes es un
    // adorno del home, no su contenido. Si el subsistema de comandas
    // falla, el panel sigue mostrando productos y configuración; solo
    // pierde el badge. `/admin/comandas` SÍ falla visible, porque ahí
    // las comandas SON el contenido. El detalle va al log del servidor,
    // nunca a la pantalla (misma regla que `admin/error.tsx`).
    getOrdersForBoard().catch((error: unknown) => {
      console.error("[admin] no se pudieron leer las comandas del home", error);
      return [];
    }),
  ]);

  const pendientes = orders.filter((order) => order.status === "PENDING");

  const publicados = products.filter((product) => product.status === "PUBLISHED");
  const agotados = publicados.filter((product) => !product.isAvailable);
  const borradores = products.filter((product) => product.status === "DRAFT");

  return (
    <>
      <PageHeader
        title={t("adminPanel")}
        description={`${settings.name} · ${settings.address ?? "Sin dirección cargada"}`}
      />

      {products.length === 0 ? (
        // Sin acción: la ruta de alta es la Tarea 16. Un botón que lleva a
        // un 404 es peor que ningún botón.
        <EmptyState
          title="Todavía no hay productos"
          message="El catálogo está vacío. Cuando se carguen, van a aparecer acá con su estado de disponibilidad."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard etiqueta={t("products")} valor={products.length} />
          <StatCard etiqueta={t("published")} valor={publicados.length} />
          <StatCard
            etiqueta={t("outOfStock")}
            valor={agotados.length}
            {...(publicados.length > 0 ? { detalle: `${publicados.length} en el menú` } : {})}
          />
          <StatCard etiqueta={t("drafts")} valor={borradores.length} />
        </div>
      )}

      <section className="mt-8">
        <h2 className="font-display text-ink mb-3 text-lg">{t("shortcuts")}</h2>
        <Link
          href="/admin/comandas"
          className="border-line-strong text-ink hover:bg-paper rounded-control inline-flex border px-4 py-2 text-sm"
        >
          Ver el tablero de comandas
          {pendientes.length > 0 && (
            <span className="bg-crust/10 text-crust-deep ml-2 rounded-full px-2 py-0.5 text-xs tabular-nums">
              {pendientes.length} pendientes
            </span>
          )}
        </Link>
        <Link
          href="/admin/productos"
          className="border-line-strong text-ink hover:bg-paper rounded-control ml-2 inline-flex border px-4 py-2 text-sm"
        >
          Ver productos y cambiar disponibilidad
        </Link>
        {!isSettingsConfigured(settings) && (
          <Link
            href="/admin/ajustes"
            className="text-clay-deep ml-2 inline-flex text-sm hover:underline"
          >
            Completar los datos →
          </Link>
        )}
      </section>

      <ConfiguracionDelNegocio settings={settings} />
    </>
  );
};

const StatCard = ({
  etiqueta,
  valor,
  detalle,
}: {
  readonly etiqueta: string;
  readonly valor: number;
  readonly detalle?: string;
}) => (
  <div className="rounded-card border-line bg-paper p-5">
    <p className="text-ink-muted text-sm">{etiqueta}</p>
    <p className="font-display text-ink mt-1 text-3xl tabular-nums">{valor}</p>
    {detalle !== undefined && <p className="text-ink-muted mt-1 text-xs">{detalle}</p>}
  </div>
);

/**
 * Estado de configuración del negocio.
 *
 * ⛔ No decide nada: muestra lo que hay. Si la fila de `business_settings`
 *    no existe, el servicio devuelve los defaults y acá salen como
 *    "Sin cargar", que es la respuesta honesta (Tarea 08 §4.4).
 */
const ConfiguracionDelNegocio = ({ settings }: { readonly settings: BusinessSettingsDTO }) => (
  <section className="mt-8">
    <h2 className="font-display text-ink mb-3 text-lg">Configuración del negocio</h2>
    <dl className="rounded-card border-line bg-paper grid gap-4 border p-5 sm:grid-cols-2">
      <Dato etiqueta="Dirección" valor={settings.address ?? SIN_CARGAR} />
      <Dato etiqueta="Instagram" valor={settings.instagramUrl ?? SIN_CARGAR} />
    </dl>
  </section>
);

const Dato = ({ etiqueta, valor }: { readonly etiqueta: string; readonly valor: string }) => (
  <div>
    <dt className="text-ink-muted text-xs tracking-wide uppercase">{etiqueta}</dt>
    <dd className="text-ink mt-1 text-sm break-words">{valor}</dd>
  </div>
);

export default AdminDashboard;
