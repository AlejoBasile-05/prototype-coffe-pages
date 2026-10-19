import { BusinessSettingsForm } from "@/components/admin/settings/BusinessSettingsForm";
import { PageHeader } from "@/components/admin/PageHeader";
import { PROTOTYPE_CONFIG, t } from "@/config/prototype";
import { isOwner } from "@/lib/domain";
import { verifyAdminSession } from "@/server/auth/verify-admin";
import { getSettingsForAdmin } from "@/server/services";
import { getSettingsFormForAdmin } from "@/server/services/settings-admin.service";

export const metadata = { title: t("settings") };

export default async function AjustesPage() {
  // ⛔ La sesión se verifica en la página y no solo en el layout: el
  //    layout es UX, y si se refactoriza un día, la protección no puede
  //    depender de él para un payload que es el correo del negocio (§2.2).
  const [session, settings] = await Promise.all([verifyAdminSession(), getSettingsForAdmin()]);

  const puedeEditar = session !== null && isOwner(session);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("settings")}
        description={PROTOTYPE_CONFIG.messages.settingsDescription}
      />
      {!puedeEditar && (
        <p
          role="status"
          className="rounded-card border-clay/35 bg-clay/10 text-clay-deep px-3 py-2 text-sm"
        >
          {PROTOTYPE_CONFIG.messages.ownerOnly}
        </p>
      )}
      <BusinessSettingsForm modelo={getSettingsFormForAdmin(settings)} puedeEditar={puedeEditar} />
    </div>
  );
}
