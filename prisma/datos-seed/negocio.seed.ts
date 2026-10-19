/**
 * Datos semilla del negocio y del administrador (prototipo genérico).
 *
 * Los valores de contacto son placeholders NO asignados: el `whatsappPhone`
 * termina en ceros y el email usa el dominio reservado `.invalid`
 * (RFC 2606: no resuelve en DNS), de modo que ningún pedido ni correo de
 * recuperación llega a un destino real. Al adaptar el prototipo a un
 * negocio real se reemplaza este bloque entero por los datos verdaderos.
 */

import { PROTOTYPE_CONFIG } from "@/config/prototype";
import type { OpeningHours } from "../../src/lib/domain/settings";

export const NEGOCIO_SEED = {
  name: PROTOTYPE_CONFIG.brand.name,
  /** Placeholder E.164 sin `+`. Cambiar por el número real del negocio. */
  whatsappPhone: "5490000000000",
  address: "Calle de ejemplo 123, Tu Ciudad",
  instagramUrl: "https://instagram.com/tu-negocio",
  /**
   * Horario genérico de ejemplo. Un día cerrado se representa con `null`,
   * no con un objeto vacío. Domingo cerrado es un supuesto de diseño: si el
   * local abre domingos, este es el primer valor que cambia.
   */
  openingHours: {
    monday: { opens: "09:00", closes: "18:00" },
    tuesday: { opens: "09:00", closes: "18:00" },
    wednesday: { opens: "09:00", closes: "18:00" },
    thursday: { opens: "09:00", closes: "18:00" },
    friday: { opens: "09:00", closes: "18:00" },
    saturday: { opens: "10:00", closes: "14:00" },
    sunday: null,
  },
  /** Mensaje que se muestra fuera de horario. */
  closingMessage: PROTOTYPE_CONFIG.messages.closed,
  legalNotice: `${PROTOTYPE_CONFIG.brand.name} · Precios de ejemplo. Pedidos sujetos a disponibilidad de stock.`,
} as const;

/**
 * Horarios de la DEMO local (npm run demo:datos).
 *
 * Ejemplo genérico: semana con cierre semanal el lunes, fin de semana
 * extendido y domingo corto, coherente con `MENSAJE_CIERRE_DEMO`.
 *
 * Vive separado de NEGOCIO_SEED a propósito: el seed de demo aplica un
 * MERGE parcial de `business_settings` (solo `openingHours`, para no
 * pisar el WhatsApp real), mientras el seed oficial sobrescribe la fila
 * entera. Si cambian los horarios reales, ambos bloques se reemplazan.
 */
export const HORARIOS_DEMO = {
  monday: null, // Lunes cerrado
  tuesday: { opens: "08:30", closes: "20:30" },
  wednesday: { opens: "08:30", closes: "20:30" },
  thursday: { opens: "08:30", closes: "20:30" },
  friday: { opens: "08:30", closes: "22:30" },
  saturday: { opens: "08:30", closes: "22:30" },
  sunday: { opens: "09:00", closes: "13:00" },
} as const satisfies OpeningHours;

/** Mensaje asociado a los horarios de demo (lunes cerrado). */
export const MENSAJE_CIERRE_DEMO = "Cerramos los lunes.";

/**
 * Email del administrador inicial (un solo administrador).
 *
 * ⛔ Es obligatorio y se lee del entorno: si el seed cayera a un email
 *    default de fábrica, en producción nadie podría entrar al panel y la
 *    única salida sería editar Supabase a mano. Un placeholder válido es
 *    `dueno@tu-negocio.invalid` (dominio reservado por RFC 2606, no llega
 *    a ningún destino real).
 *
 * La contraseña es opcional (el login por defecto es enlace mágico):
 * si `SEED_ADMIN_PASSWORD` está vacía, el usuario se crea confirmado y
 * sin contraseña, y entra por magic link.
 */
export const leerAdminDelEntorno = (): {
  readonly email: string;
  readonly password: string | null;
} => {
  const email = process.env["SEED_ADMIN_EMAIL"]?.trim();
  if (email === undefined || email === "") {
    throw new Error(
      "Falta SEED_ADMIN_EMAIL. Agregalo a .env.local con el email del encargado " +
        "mientras no haya uno real (placeholder: dueno@tu-negocio.invalid).",
    );
  }

  const password = process.env["SEED_ADMIN_PASSWORD"]?.trim() ?? "";
  return { email, password: password === "" ? null : password };
};
