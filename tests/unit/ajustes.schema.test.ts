import { describe, expect, it } from "vitest";

import { WEEKDAY_KEYS } from "@/lib/domain";
import { AjustesSchema } from "@/server/schemas/ajustes.schema";

type HorarioCrudo = { estado: string; abre: string; cierra: string };

const diaSinInformar = (): Record<string, HorarioCrudo> =>
  Object.fromEntries(
    WEEKDAY_KEYS.map((key) => [key, { estado: "sin_informar", abre: "", cierra: "" }]),
  ) as Record<string, HorarioCrudo>;

const validos = {
  nombre: "Mi Negocio",
  telefonoWhatsapp: "+54 9 261 555-1234",
  direccion: "Belgrano 123, San Rafael",
  instagram: "instagram.com/modo.miga",
  mensajeCierre: "Abrimos de martes a sábados.",
  avisoLegal: "",
  horarios: diaSinInformar(),
};

describe("AjustesSchema", () => {
  it("debe convertir los textos vacíos en null", () => {
    const parsed = AjustesSchema.parse({ ...validos, direccion: "   ", avisoLegal: "" });

    // "" y null son cosas distintas en el schema: guardar "" deja un
    // hueco de dos espacios en el pie de página.
    expect(parsed.direccion).toBeNull();
    expect(parsed.avisoLegal).toBeNull();
  });

  it("debe rechazar un horario informado con formato de 12 horas", () => {
    const parsed = AjustesSchema.safeParse({
      ...validos,
      horarios: { ...diaSinInformar(), monday: { estado: "informado", abre: "9am", cierra: "21:00" } },
    });

    expect(parsed.success).toBe(false);
  });

  it("no mira las horas de un día marcado como cerrado", () => {
    const parsed = AjustesSchema.safeParse({
      ...validos,
      horarios: { ...diaSinInformar(), sunday: { estado: "cerrado", abre: "9am", cierra: "" } },
    });

    // Cerrado con basura es cerrado: el servicio descarta las horas
    // igual, y el usuario no recibe un error por algo que no se guarda.
    expect(parsed.success).toBe(true);
  });

  it("debe exigir los siete días", () => {
    const horarios = diaSinInformar();
    delete horarios.tuesday;

    expect(AjustesSchema.safeParse({ ...validos, horarios }).success).toBe(false);
  });

  it("debe aceptar los estados del enum del dominio y ningún otro", () => {
    const horarios = diaSinInformar();
    horarios.monday = { estado: "abierto", abre: "09:00", cierra: "21:00" };

    // El enum de Zod está escrito a mano. Este test es el que avisa si
    // `toOpeningHours` y el `select` de la UI se separaron (§5.7).
    expect(AjustesSchema.safeParse({ ...validos, horarios }).success).toBe(false);
  });
});
