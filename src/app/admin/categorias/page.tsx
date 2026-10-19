import { CategoryTable } from "@/components/admin/categories/CategoryTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { t } from "@/config/prototype";
import { getCategoriesForAdmin } from "@/server/services/category-admin.service";
import { getCategoryAdminDependencies } from "@/server/services";

export const metadata = { title: t("categories") };

export default async function CategoriasPage() {
  const filas = await getCategoriesForAdmin(getCategoryAdminDependencies());

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("categories")}
        description="Las secciones en las que se agrupan los productos del menú. Las visibilidad tiene su propio botón en cada fila."
      />
      <CategoryTable filas={filas} />
    </div>
  );
}
