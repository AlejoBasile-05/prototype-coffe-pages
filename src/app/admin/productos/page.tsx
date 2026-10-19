import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/PageHeader";
import { ProductTable } from "@/components/admin/ProductTable";
import { EmptyState, buttonClassName } from "@/components/ui";
import { t } from "@/config/prototype";
import { getProductsForAdmin } from "@/server/services";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: t("products") };

const ProductosPage = async () => {
  const products = await getProductsForAdmin();

  return (
    <>
      <PageHeader
        title={t("products")}
        description="El interruptor de la última columna es la disponibilidad: no saca el producto del menú, lo marca como agotado."
        actions={
          <Link href="/admin/productos/nuevo" className={buttonClassName("primary", "md")}>
            Nuevo producto
          </Link>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          title="No hay productos cargados"
          message="Cargá el primer producto del menú para empezar a controlar la disponibilidad."
        />
      ) : (
        <ProductTable products={products} />
      )}
    </>
  );
};

export default ProductosPage;
