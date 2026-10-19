/**
 * Secciones del panel de administración (Tarea 14).
 *
 * ⛔ Módulo de datos, no de presentación: no importa React, no lleva
 *    `"use client"` y por eso lo pueden leer tanto el Server Component
 *    como el `AdminNav`. Cuando se agreguen secciones (Tarea 17), este es
 *    el único lugar que hay que tocar.
 */
import { t } from "@/config/prototype";

export interface AdminNavSection {
  readonly href: string;
  readonly label: string;
  /**
   * ⛔ `false` = la ruta todavía no existe.
   *
   * El enlace aparece deshabilitado con la explicación, en vez de
   * desaparecer. Un panel con un ítem visible que dice "Próximamente" le
   * dice al encargado qué va a poder hacer ahí; un ítem que no está le
   * deja preguntándose si lo está buscando mal.
   */
  readonly isAvailable: boolean;
}

export const ADMIN_NAV_SECTIONS: readonly AdminNavSection[] = [
  { href: "/admin", label: t("catalog"), isAvailable: true },
  { href: "/admin/comandas", label: t("orders"), isAvailable: true },
  { href: "/admin/productos", label: t("products"), isAvailable: true },
  { href: "/admin/categorias", label: t("categories"), isAvailable: true },
  { href: "/admin/ajustes", label: t("settings"), isAvailable: true },
] as const;
