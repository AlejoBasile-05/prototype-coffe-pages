/**
 * Constantes públicas del sitio.
 *
 * Sin estado, sin I/O y sin lógica: las importan el layout raíz, el
 * layout del grupo público y `generateMetadata`. El fallback a
 * `localhost` evita que el build de CI reviente por una variable
 * ausente; en producción `NEXT_PUBLIC_SITE_URL` está siempre cargada.
 */
import { PROTOTYPE_CONFIG } from "./prototype";

export const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000";

export const SITE_NAME = PROTOTYPE_CONFIG.brand.name;

export const SITE_DESCRIPTION = PROTOTYPE_CONFIG.brand.description;

// Re-exportar helpers del prototipo
export { PROTOTYPE_CONFIG, formatCurrency, t } from "./prototype";