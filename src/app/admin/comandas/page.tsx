import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/PageHeader";
import { OrderKanbanBoard } from "@/components/admin/orders/OrderKanbanBoard";
import { t } from "@/config/prototype";
import { getOrdersForBoard } from "@/server/services";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: t("orders") };

/**
 * Tablero de cocina (Tarea 23).
 *
 * ⛔ `force-dynamic` y sin caché: es la pantalla viva del local. La
 *    actualización entre dispositivos la hace Realtime dentro del
 *    tablero; este fetch es el snapshot de arranque.
 */
const ComandasPage = async () => {
  const orders = await getOrdersForBoard();

  return (
    <>
      <PageHeader
        title={t("orders")}
        description="Los pedidos de la web entran en «Pendientes». Van avanzando a medida que se confirman en WhatsApp y se entregan."
      />

      {/*
        ⛔ El tablero se monta SIEMPRE, incluso vacío: la suscripción de
        Realtime nace con él, y si el EmptyState reemplazara al tablero,
        el primer pedido del día no aparecería sin recargar la página.
        Las columnas vacías ya muestran su propio estado.
      */}
      <OrderKanbanBoard initialOrders={orders} />
    </>
  );
};

export default ComandasPage;
