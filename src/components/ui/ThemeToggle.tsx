"use client";

import { useState, useSyncExternalStore } from "react";

import { ThemeSwitch, type Theme } from "@/components/arc/theme-switch/theme-switch";

/**
 * Alternador de tema claro/oscuro.
 *
 * La fuente de verdad en runtime es `document.documentElement.dataset.theme`
 * (la escribe el theme script del layout ANTES del paint para evitar el
 * flash). Se lee con useSyncExternalStore: el snapshot del servidor es
 * siempre "light" (el atributo no existe en el HTML inicial) y el del
 * cliente se resuelve tras hidratar, sin setState en efectos ni mismatch.
 * El override local refleja el cambio en el mismo clic del usuario.
 */
const getSnapshot = (): Theme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const getServerSnapshot = (): Theme => "light";
// El atributo solo lo muta este componente: no hay otro actor que notificar.
const subscribe = () => () => {};

export function ThemeToggle() {
  const persisted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [override, setOverride] = useState<Theme | null>(null);
  const theme = override ?? persisted;

  const handleThemeChange = (next: Theme) => {
    setOverride(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Sin storage disponible (modo privado): el tema igualmente cambia
      // en esta sesión; solo no se recuerda.
    }
  };

  return (
    <ThemeSwitch
      theme={theme}
      onThemeChange={handleThemeChange}
      label="Cambiar entre tema claro y oscuro"
      iconOnly
    />
  );
}
