import { describe, expect, it } from "vitest";

import { verificarTodas, verificarOrden } from "../../scripts/verificar-acciones.mjs";

/**
 * El orden de las actions (Tarea 19 §5.4).
 *
 * ⛔ El test comprueba el SCRIPT y el script comprueba las actions. El orden
 *    inverso —probar las functions una por una con mocks— no sirve: con un
 *    mock, `verifyAdminSession` devuelve lo que el mock quiera y el test
 *    pasa igual. Lo que se verifica acá es la propiedad estructural que un
 *    mock no puede falsear: que la llamada aparezca antes de la primera
 *    lectura del payload en el código real del repositorio.
 */
describe("verificarOrden", () => {
  it("acepta una action que verifica la sesión antes de parsear", () => {
    const resultado = verificarOrden(
      "createProductAction",
      `export async function createProductAction(datos: unknown) {
  const admin = await verifyAdminSession();
  if (admin === null) return SIN_PERMANEZCO;
  const parsed = ProductoAltaSchema.safeParse(datos);
}`,
      "datos",
    );

    expect(resultado.ok).toBe(true);
    expect(resultado.motivo).toBeNull();
  });

  it("RECHAZA una action que parsea antes de verificar la sesión", () => {
    const resultado = verificarOrden(
      "createProductAction",
      `export async function createProductAction(datos: unknown) {
  const parsed = ProductoAltaSchema.safeParse(datos);
  const admin = await verifyAdminSession();
}`,
      "datos",
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("antes de verificar la sesión");
  });

  it("RECHAZA una action que valida el rol pero no autentica", () => {
    // ⛔ `isOwner` es un permiso, no una autenticación: sin
    //    `verifyAdminSession` no se sabe QUIÉN pregunta. Aceptar este caso
    //    como válido sería el agujero entero.
    const resultado = verificarOrden(
      "updateBusinessSettingsAction",
      `export async function updateBusinessSettingsAction(rawInput: unknown) {
  if (isOwner(await getSession())) return SIN_PERMISO;
  const parsed = AjustesSchema.safeParse(rawInput);
}`,
      "rawInput",
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("verifyAdminSession");
  });

  it("detecta el acceso al payload aunque la action no use Zod", () => {
    // `archiveProductAction` valida con `typeof` y `.trim()`. Una lista de
    // señales que sólo mire `.parse(` la declararía "sin payload" y la
    // daría por buena sin haber mirado nada.
    const resultado = verificarOrden(
      "archiveProductAction",
      `export async function archiveProductAction(id: unknown) {
  const admin = await verifyAdminSession();
  if (admin === null) return SIN_PERMANEZCO;
  if (typeof id !== "string" || id.trim().length === 0) return INVALIDO;
}`,
      "id",
    );

    expect(resultado.ok).toBe(true);
  });

  it("marca como NO verificable una action donde no encuentra el payload", () => {
    // Ante la duda, falla. Un falso negativo cuesta revisar un archivo; un
    // falso positivo cuesta una action sin control de acceso. La action
    // recibe sesión y no toca ningún input, así que el script no tiene con
    // qué comparar posiciones y no puede afirmar nada.
    const resultado = verificarOrden(
      "accionSinPayload",
      `export async function accionSinPayload() {
  const admin = await verifyAdminSession();
  if (admin === null) return SIN_PERMANEZCO;
}`,
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("no se pudo ubicar");
  });

  it("no acepta una action que no verifica la sesión en absoluto", () => {
    const resultado = verificarOrden(
      "createProductAction",
      `export async function createProductAction(datos: unknown) {
  const parsed = ProductoAltaSchema.safeParse(datos);
}`,
      "datos",
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("verifyAdminSession");
  });
});

describe("las actions reales del repositorio", () => {
  const resultados = verificarTodas();

  it("son diez: las nueve del panel más la transición de comandas (Tarea 23)", () => {
    // ⛔ El número vive AQUÍ y no en el script. Cuando la Tarea 21 agregue su
    //    propia action, este test falla y obliga a decidir si entra en la
    //    verificación; un número metido en el script se ajustaría en
    //    silencio y dejaría de verificar lo que dice verificar.
    //    La Tarea 23 sumó `transitionOrderStatusAction` y dejó FUERA a
    //    `registerOrderAction` a propósito: es la única action pública del
    //    sistema (el checkout no tiene sesión) y sus defensas son otras.
    expect(resultados).toHaveLength(10);
  });

  it("todas verifican la sesión antes de tocar el payload", () => {
    const falladas = resultados.filter((resultado) => !resultado.ok);

    expect(falladas).toEqual([]);
  });

  it("el toggle de disponibilidad está entre ellas", () => {
    // El gesto más repetido del panel: si queda fuera de la lista, el
    // lugar donde más falta hace un registro es el que no lo tiene.
    expect(resultados.map((resultado) => resultado.nombre)).toContain(
      "toggleProductAvailabilityAction",
    );
  });

  it("la transición de comandas está entre ellas", () => {
    expect(resultados.map((resultado) => resultado.nombre)).toContain(
      "transitionOrderStatusAction",
    );
  });
});