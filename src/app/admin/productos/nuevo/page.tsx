import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, buttonClassName } from "@/components/ui";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { getAllCategoriesForAdmin } from "@/server/services";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NuevoProductoPage() {
  const categorias = await getAllCategoriesForAdmin();

  // Sin categorías no hay producto: el alta necesita `categoryId` y la
  // base bloquea con `onDelete: Restrict`. Se muestra el estado vacío
  // con el enlace para crear una (§6.7 y §9).
  if (categorias.length === 0) {
    return (
      <>
        <PageHeader title="Nuevo producto" />
        <EmptyState
          title="Primero creá una categoría"
          message="Para cargar el primer producto necesitás una categoría."
        />
        <div className="mt-3 text-center">
          <Link href="/admin/categorias" className={buttonClassName("secondary", "sm")}>
            Ir a categorías
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Nuevo producto" />
      <ProductForm modo="alta" categorias={categorias} />
    </>
  );
}
