import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { useAvailabilityRealtime } from "./use-availability-realtime";
import { useAvailabilityStore } from "@/store/availability-store";

/** Captura el callback de postgres_changes para poder dispararlo a mano. */
type Callback = (payload: { new: Record<string, unknown> }) => void;

const crearCanalDoble = () => {
  let callback: Callback | null = null;
  let errorCallback: ((error: unknown) => void) | null = null;

  const channel = {
    // `.on` admite dos firmas: cambios (`"postgres_changes", filtro, fn`)
    // y error de canal (`"error", fn`). Se capturan las dos aparte para
    // que el registro de errores no pise el callback de eventos.
    on: vi.fn((tipo: string, ...rest: unknown[]) => {
      const fn = rest.at(-1);
      if (tipo === "postgres_changes") callback = fn as Callback;
      if (tipo === "error") errorCallback = fn as (error: unknown) => void;
      return channel;
    }),
    subscribe: vi.fn(() => channel),
  };

  return {
    channel,
    removeChannel: vi.fn(),
    emitir: (nuevo: Record<string, unknown>) => callback?.({ new: nuevo }),
    emitirError: (error: unknown) => errorCallback?.(error),
  };
};

const supabaseDoble = crearCanalDoble();

// El cliente de navegador es infraestructura: se dobla, no se testea.
// El doble solo implementa la forma que el hook usa (`channel`, `on`,
// `subscribe`, `removeChannel`).
vi.mock("@/server/infra/supabase/client", () => ({
  supabaseBrowser: () => ({
    channel: () => supabaseDoble.channel,
    removeChannel: supabaseDoble.removeChannel,
  }),
}));

// El hook degradá a "sin suscripción" si las variables públicas faltan o
// son inválidas (demo local sin Supabase). En el test SIEMPRE hay
// configuración válida: lo que se verifica acá es el canal, no el guard.
// (vi.stubEnv se propaga hasta que vitest lo des-stubbeea automáticamente
// al final del archivo si `unstubEnvs` está activo; si no, el guard lee
// `process.env` y las variables quedan solo en este proceso de worker.)
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proyecto-de-test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-de-test");

const Probe = (): null => {
  useAvailabilityRealtime();
  return null;
};

describe("useAvailabilityRealtime", () => {
  beforeEach(() => {
    useAvailabilityStore.getState().clearAvailability();
    supabaseDoble.removeChannel.mockClear();  });

  it("debe escribir en el store lo que llega por el canal", () => {
    render(<Probe />);
    supabaseDoble.emitir({ id: "prod_1", isAvailable: false });

    expect(useAvailabilityStore.getState().byProductId["prod_1"]).toBe(false);
  });

  it("debe descartar un payload sin `id` en vez de usar `undefined` de clave", () => {
    render(<Probe />);
    supabaseDoble.emitir({ isAvailable: false });

    // El guard del hook (§6.3/§7) es lo que evita que un payload mal
    // formado deje una clave `undefined` en el store.
    expect(useAvailabilityStore.getState().byProductId).toEqual({});
  });

  it("debe descartar un payload con `isAvailable` sin tipo booleano", () => {
    render(<Probe />);
    supabaseDoble.emitir({ id: "prod_1", isAvailable: "no" });

    expect(useAvailabilityStore.getState().byProductId).toEqual({});
  });

  it("debe cerrar el canal al desmontar", () => {
    const { unmount } = render(<Probe />);
    unmount();

    // Sin este cleanup, cada remount de StrictMode deja una suscripción
    // viva para siempre. Ver §5.4.
    expect(supabaseDoble.removeChannel).toHaveBeenCalled();
  });

  it("no debe abrir una segunda suscripción si el componente se renderiza de nuevo", () => {
    const { rerender } = render(<Probe />);
    supabaseDoble.channel.subscribe.mockClear();

    rerender(<Probe />);

    // La dependencia del efecto es una función estable del store: el
    // efecto NO se vuelve a correr por un re-render del padre.
    expect(supabaseDoble.channel.subscribe).not.toHaveBeenCalled();
  });

  it("debe avisar por consola si el canal se rompe, sin tocar la UI", () => {
    // La pérdida del canal no es un error del usuario: el snapshot del
    // HTML sigue siendo válido. El aviso va por `console.warn` con el
    // mensaje del error, nunca el objeto completo (§5.5, §8.5).
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Probe />);

    supabaseDoble.emitirError(new Error("connection lost"));

    expect(warn).toHaveBeenCalledWith(
      "[realtime] error en el canal catalog-availability: connection lost",
    );
    warn.mockRestore();
  });
});

describe("useAvailabilityRealtime — degradación sin Supabase", () => {
  it("sin configuración válida no abre canal y avisa una sola vez", () => {
    // Caso demo local: `.env.local` con placeholders ("PENDIENTE" no es
    // una URL https). No hay suscripción y la UI sigue con el snapshot.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "PENDIENTE");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "PENDIENTE");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    supabaseDoble.channel.subscribe.mockClear();

    render(<Probe />);

    expect(supabaseDoble.channel.subscribe).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    info.mockRestore();

    // Restaura la config válida para el resto de los tests del archivo.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proyecto-de-test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-de-test");
  });
});
