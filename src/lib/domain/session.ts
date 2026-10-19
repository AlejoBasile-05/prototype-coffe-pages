/**
 * Sesión del administrador (capa 0 · dominio).
 *
 * ⛔ `AdminRole` es una union type propia, NO el enum `StaffRole` de
 *    Prisma. Importar el enum acá arrastraría el cliente de Prisma al
 *    bundle del navegador (Tarea 04 §4.3).
 */
export type AdminRole = "OWNER" | "STAFF";

export interface AdminSession {
  /** UUID de `auth.users`, que es también la PK de `staff_members`. */
  readonly userId: string;
  readonly email: string;
  readonly role: AdminRole;
}

/** Traduce el enum de Prisma al tipo de dominio (una traducción, en el borde). */
export const toAdminRole = (role: "OWNER" | "STAFF"): AdminRole => role;

/**
 * Los ajustes del negocio son territorio del dueño.
 *
 * Vive en capa 0 y no en la action porque la decisión la tienen que
 * poder leer y testear los dos lados: la action la aplica, el test la
 * verifica (Tarea 17 §2.2).
 */
export const isOwner = (session: AdminSession): boolean => session.role === "OWNER";
