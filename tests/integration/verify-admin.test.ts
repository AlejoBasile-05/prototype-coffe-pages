import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { UnauthorizedError } from "@/lib/domain";
import { requireAdminSession, verifyAdminSession } from "@/server/auth/verify-admin";
import { createStaffMember } from "@/server/repositories/staff.repository";
import { prisma } from "@/server/infra/prisma";
import { disconnectDatabase, resetDatabase } from "../setup";

/**
 * Bloque B de la Tarea 20: la frontera de autorización, probada contra la
 * base REAL.
 *
 * ⛔ El ÚNICO módulo que se dobla es `@/server/infra/supabase/server`, que es
 *    la frontera externa de verdad: la identidad viaja por HTTP a Supabase
 *    Auth y en un test no hay a quién preguntarle. A partir de ahí NO se dobla
 *    nada: `verifyAdminSession` es la función real y `findStaffById` es
 *    Prisma real contra la base real.
 *
 * ⛔ Por eso no se dobla `@/server/auth/verify-admin`: el test probaría el
 *    test. La segunda capa —"estar en `staff_members`"— se lee de la base, y
 *    por eso borrar la fila hace caer la sesión en el test de abajo.
 */
/**
 * La forma es la de `supabase.auth.getUser()`: `{ data, error }`, con
 * `data.user` adentro. Un doble que devuelva el usuario en la raíz revienta por
 * una razón que no es la que el test está probando.
 */
type RespuestaGetUser =
  | {
      readonly data: { readonly user: { readonly id: string; readonly email: string } | null };
      readonly error: null;
    }
  | { readonly data: null; readonly error: { readonly message: string } };

const getUser = vi.fn<() => Promise<RespuestaGetUser>>();

vi.mock("@/server/infra/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser: () => getUser() } }),
}));

const ANA = "11111111-1111-4111-8111-111111111111";
const BRUNO = "22222222-2222-4222-8222-222222222222";

const sesionValida = (id: string, email: string) => {
  getUser.mockResolvedValue({ data: { user: { id, email } }, error: null });
};

const sinSesionEnSupabase = () => {
  getUser.mockResolvedValue({ data: null, error: { message: "invalid token" } });
};

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
  sinSesionEnSupabase();
});

afterAll(disconnectDatabase);

describe("verifyAdminSession contra la base real", () => {
  it("debe devolver null cuando Supabase no reconoce el token", async () => {
    // ⛔ Falla CERRADA: un 500 de la red de Supabase es un `error`, y un
    //    `error` es "no autorizado". Degradar a "autorizado" convertiría una
    //    caída de infraestructura en una brecha.
    sinSesionEnSupabase();

    expect(await verifyAdminSession()).toBeNull();
  });

  it("debe devolver null si el token es válido pero el usuario no está en staff_members", async () => {
    // ⛔ LA segunda capa: existir en Supabase no autoriza nada. Sin fila acá la
    //    respuesta es `null` aunque el token sea impecable.
    sesionValida(ANA, "ana@modomiga.com.ar");

    expect(await verifyAdminSession()).toBeNull();
  });

  it("debe devolver la sesión del OWNER que está en staff_members", async () => {
    await createStaffMember({
      id: ANA,
      email: "ana@modomiga.com.ar",
      name: "Ana",
      role: "OWNER",
    });
    sesionValida(ANA, "ana@modomiga.com.ar");

    expect(await verifyAdminSession()).toEqual({
      userId: ANA,
      email: "ana@modomiga.com.ar",
      role: "OWNER",
    });
  });

  it("debe devolver el rol desde la base, no el que dice Supabase", async () => {
    // ⛔ El rol se lee de `staff_members.role`. Si se leyera del token o
    //    del claim, darle de baja a alguien o bajarle el rol no surtiría
    //    efecto hasta que expirara su sesión.
    await createStaffMember({
      id: BRUNO,
      email: "bruno@modomiga.com.ar",
      name: "Bruno",
      role: "STAFF",
    });
    sesionValida(BRUNO, "bruno@modomiga.com.ar");

    expect(await verifyAdminSession()).toMatchObject({ role: "STAFF", userId: BRUNO });
  });

  it("debe perder la sesión en el momento en que se borra la fila", async () => {
    // ⛔ La prueba de que este test no se auto-confirma: un doble de repositorio
    //    devolvería la fila para siempre. Acá la sesión depende de una fila que
    //    se acaba de borrar.
    await createStaffMember({ id: ANA, email: "ana@modomiga.com.ar", name: "Ana", role: "OWNER" });
    sesionValida(ANA, "ana@modomiga.com.ar");
    expect(await verifyAdminSession()).not.toBeNull();

    await prisma.staffMember.delete({ where: { id: ANA } });

    expect(await verifyAdminSession()).toBeNull();
  });

  it("debe tener la misma lectura con RLS activa que sin ella", async () => {
    // ⛔ La Tarea 19 dejó RLS activa en `staff_members`. Con un rol NO
    //    privilegiado el `findUnique` de arriba devolvería null y TODOS los
    //    tests de autorización pasarían mintiendo; esto afirma que la fila se ve.
    await createStaffMember({ id: ANA, email: "ana@modomiga.com.ar", name: "Ana", role: "OWNER" });

    const fila = await prisma.$queryRaw<readonly { relrowsecurity: boolean }[]>`
      SELECT relrowsecurity FROM pg_class WHERE relname = 'staff_members'
    `;

    expect(fila[0]?.relrowsecurity).toBe(true);
    expect(await prisma.staffMember.findUnique({ where: { id: ANA } })).not.toBeNull();
  });
});

describe("requireAdminSession contra la base real", () => {
  it("debe lanzar UnauthorizedError si no hay sesión", async () => {
    sinSesionEnSupabase();

    await expect(requireAdminSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("debe devolver la sesión si la fila existe", async () => {
    await createStaffMember({ id: ANA, email: "ana@modomiga.com.ar", name: "Ana", role: "OWNER" });
    sesionValida(ANA, "ana@modomiga.com.ar");

    await expect(requireAdminSession()).resolves.toMatchObject({ userId: ANA, role: "OWNER" });
  });
});
