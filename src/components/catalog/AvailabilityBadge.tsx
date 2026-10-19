/**
 * Estado de disponibilidad (Server Component).
 *
 * Solo dos estados: el stock parcial no es un estado de la interfaz,
 * porque la capa de servicio ya lo decidió. El texto es obligatorio:
 * "agotado" no se comunica solo con color.
 */
import { t } from "@/config/prototype";

import { Badge } from "@/components/ui";

interface AvailabilityBadgeProps {
  available: boolean;
}

export function AvailabilityBadge({ available }: AvailabilityBadgeProps) {
  if (!available) {
    return <Badge tone="danger">{t("unavailable")}</Badge>;
  }

  return <Badge tone="success">{t("available")}</Badge>;
}
