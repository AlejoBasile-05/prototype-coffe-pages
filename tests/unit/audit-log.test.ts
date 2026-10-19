import { afterEach, describe, expect, it, vi } from "vitest";

import { logAdminAction } from "@/server/infra/audit-log";
import type { AuditActor } from "@/server/infra/audit-log";

/**
 * El log de auditoría (Tarea 19 §7.1).
 *
 * ⛔ Lo que se testea NO es que se imprima algo: es lo que NO se imprime.
 *    Un log que filtra un precio, un teléfono o una `imageUrl` termina en
 *    un destino de terceros del que nadie borra nada, y el incidente se
 *    descubre cuando ya no hay forma de saber qué se filtró.
 */
const ACTOR: AuditActor = {
  actorId: "11111111-1111-1111-1111-111111111111",
  actorEmail: "dueno@modo.miga",
  actorRole: "OWNER",
};

afterEach(() => {
  vi.restoreAllMocks();
});

/** El primer argumento de `console.info`, que es el objeto del log. */
const leerLog = (espia: ReturnType<typeof vi.spyOn>): Record<string, unknown> => {
  const [, registro] = espia.mock.calls[0] ?? [];
  return registro as Record<string, unknown>;
};

describe("logAdminAction", () => {
  it("registra evento, actor y entidad", () => {
    const espia = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAdminAction("producto.creado", ACTOR, {
      entity: "producto",
      entityId: "p_1",
      nombre: "Jamón y queso",
    });

    expect(espia).toHaveBeenCalledTimes(1);
    const registro = leerLog(espia);
    expect(registro).toMatchObject({
      evento: "producto.creado",
      actorId: ACTOR.actorId,
      actorRole: "OWNER",
      entity: "producto",
      entityId: "p_1",
      nombre: "Jamón y queso",
    });
  });

  it("NO escribe el email del que operó", () => {
    const espia = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAdminAction("ajustes.actualizados", ACTOR, { entity: "ajustes" });

    // ⛔ El email es PII y además sirve para spear-phishing: con el email y
    //    la hora de una edición, el atacante sabe a quién preguntar por
    //    teléfono. Alcanza con el id de Supabase, que no es adivinable.
    expect(JSON.stringify(leerLog(espia))).not.toContain(ACTOR.actorEmail);
    expect(leerLog(espia)).not.toHaveProperty("actorEmail");
  });

  it("no filtra el payload: sólo los NOMBRES de los campos que cambiaron", () => {
    const espia = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAdminAction("producto.actualizado", ACTOR, {
      entity: "producto",
      entityId: "p_1",
      camposEditados: ["precio", "descripcion"],
    });

    expect(leerLog(espia)).toMatchObject({
      evento: "producto.actualizado",
      camposEditados: ["precio", "descripcion"],
    });
  });

  it("un edit sin cambios reales registra la lista vacía, no todos los campos", () => {
    const espia = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAdminAction("producto.actualizado", ACTOR, {
      entity: "producto",
      entityId: "p_1",
      camposEditados: [],
    });

    // Un guardado sin cambios es un hecho distinto de un guardado con
    // cambios: mezclar los dos vuelve inútil el log para responder
    // "¿cuánto se toco?" y "¿cuántas veces se guardó?".
    expect(leerLog(espia)).toMatchObject({ camposEditados: [] });
  });
});