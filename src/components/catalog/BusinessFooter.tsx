/**
 * Pie público (Server Component): dirección, enlace al sitio del autor,
 * horarios y aviso legal. Se renderiza en el servidor: el año del copyright
 * no puede quedar desactualizado porque no se sirve de un HTML congelado por día.
 */
import { PROTOTYPE_CONFIG, t } from "@/config/prototype";
import type { BusinessSettingsDTO } from "@/lib/domain";

import { OpeningHoursTable } from "./OpeningHours";

interface BusinessFooterProps {
  settings: BusinessSettingsDTO;
}

/** Texto fijo de marca: el footer no muestra el nombre configurado en la base. */
const BRAND_LABEL = "Tu Negocio";

/** Enlace fijo al sitio personal del autor. */
const AUTHOR_URL = "https://alejobasile.dev/";
const AUTHOR_LABEL = "alejobasile.dev";

export function BusinessFooter({ settings }: BusinessFooterProps) {
  return (
    <footer className="bg-cream border-line border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-ink font-display text-lg">{BRAND_LABEL}</p>

          {settings.address !== null && (
            <address className="text-ink-muted text-sm not-italic">{settings.address}</address>
          )}

          <a
            href={AUTHOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-crust-deep text-sm hover:underline"
          >
            {AUTHOR_LABEL}
          </a>

          {settings.legalNotice !== null && (
            <p className="text-ink-muted text-xs">{settings.legalNotice}</p>
          )}
        </div>

        <div>
          <h2 className="text-ink text-sm font-semibold tracking-wide uppercase">
            {t("categories")}
          </h2>
          <div className="mt-2">
            <OpeningHoursTable hours={settings.openingHours} />
          </div>
        </div>
      </div>

      <div className="border-line border-t">
        <div className="text-ink-muted mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs">
          <p>
            © {new Date().getFullYear()} {BRAND_LABEL}
          </p>
          <p>Precios en {PROTOTYPE_CONFIG.currency.code}.</p>
        </div>
      </div>
    </footer>
  );
}
