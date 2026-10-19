import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/PageHeader";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { getAllCategoriesForAdmin, getProductForAdminById } from "@/server/services";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  // ⛔ `params` es una Promise desde Next 15+. `await params` es el punto
  //    por el que se lee el identificador de la URL; sin él el campo
  //    `id` no existe como string y la validación falla antes.
  const { id } = await params;

  const [producto, categorias] = await Promise.all([
    getProductForAdminById(id),
    getAllCategoriesForAdmin(),
  ]);

  // Un producto archivado no se edita: la ruta no existe para él. La
  // decisión es del diálogo de archivado, no del formulario (§6.7).
  if (producto === null || producto.status === "ARCHIVED") {
    notFound();
  }

  return (
    <>
      <PageHeader title="Editar producto" />
      <ProductForm modo="edicion" categorias={categorias} producto={producto} />
    </>
  );
}
