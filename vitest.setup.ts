import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  // Sin esto, los portales del Sheet y del Toast quedan en el document
  // del test siguiente y getByRole encuentra elementos de dos pruebas.
  cleanup();
  vi.clearAllMocks();
});

// jsdom no implementa matchMedia. La regla global de
// prefers-reduced-motion no lo necesita, pero los componentes que
// consultan la preferencia sí.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// jsdom no implementa scrollTo, y el scroll lock de useDialog lo llama.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

// Los avisos de `act` se dejan pasar: son ruido conocido de los tests
// con promesas pendientes. Convertirlos en fallo haría que se silenciara
// el archivo entero en lugar de arreglar el test.
const isActWarning = (args: unknown[]): boolean =>
  typeof args[0] === "string" && args[0].includes("not wrapped in act");

/**
 * Cualquier otro `console.error` es un fallo.
 *
 * React avisa por consola cuando un `setState` ocurre fuera de `act`,
 * que en producción aparece como un toast que no se actualiza o una
 * hidratación que no acaba. El aviso avisa acá y no al usuario final.
 *
 * El spy se define una sola vez a nivel de módulo y nunca se restaura:
 * `vi.clearAllMocks()` de cada test limpia el historial sin borrar la
 * implementación, así que la protección sobrevive de test a test.
 */
vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
  if (isActWarning(args)) return;
  throw new Error(`console.error inesperado: ${args.map(String).join(" ")}`);
});
