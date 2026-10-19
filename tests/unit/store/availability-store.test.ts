import { beforeEach, describe, expect, it } from "vitest";

import { useAvailabilityStore } from "@/store/availability-store";

describe("useAvailabilityStore", () => {
  beforeEach(() => {
    useAvailabilityStore.getState().clearAvailability();
  });

  it("debe guardar la disponibilidad recibida por evento", () => {
    useAvailabilityStore.getState().applyAvailability("prod_1", false);

    expect(useAvailabilityStore.getState().byProductId).toEqual({ prod_1: false });
  });

  it("no debe cambiar la identidad del estado si el valor es el mismo", () => {
    useAvailabilityStore.getState().applyAvailability("prod_1", false);

    const antes = useAvailabilityStore.getState();
    useAvailabilityStore.getState().applyAvailability("prod_1", false);
    const despues = useAvailabilityStore.getState();

    // Identidad, no igualdad: es lo que evita el re-render. Con `toEqual`
    // pasaría también con un objeto nuevo y no detectaría el bug (§5.2).
    expect(despues).toBe(antes);
  });

  it("debe reemplazar el valor cuando la disponibilidad cambia de verdad", () => {
    useAvailabilityStore.getState().applyAvailability("prod_1", false);
    useAvailabilityStore.getState().applyAvailability("prod_1", true);

    expect(useAvailabilityStore.getState().byProductId["prod_1"]).toBe(true);
  });

  it("debe conservar los ids que no son el que cambió", () => {
    const store = useAvailabilityStore.getState();
    store.applyAvailability("prod_1", false);
    store.applyAvailability("prod_2", true);
    store.applyAvailability("prod_1", true);

    expect(useAvailabilityStore.getState().byProductId).toEqual({
      prod_1: true,
      prod_2: true,
    });
  });

  it("debe volver al estado vacío con clearAvailability", () => {
    useAvailabilityStore.getState().applyAvailability("prod_1", false);

    useAvailabilityStore.getState().clearAvailability();

    // El store nunca es `null`: la lectura en el selector usa `?? inicial`,
    // que funciona con un `Record` vacío.
    expect(useAvailabilityStore.getState().byProductId).toEqual({});
  });
});
