import { describe, expect, it } from "vitest";

import { describirEstado, getOpenState } from "@/lib/domain/horarios";
import type { OpeningHours } from "@/lib/domain";

/**
 * Horario de referencia (el de la demo): Mar–Jue 08:30–20:30,
 * Vie–Sáb hasta 22:30, Dom 09:00–13:00, Lunes cerrado.
 */
const HOURS: OpeningHours = {
  monday: null,
  tuesday: { opens: "08:30", closes: "20:30" },
  wednesday: { opens: "08:30", closes: "20:30" },
  thursday: { opens: "08:30", closes: "20:30" },
  friday: { opens: "08:30", closes: "22:30" },
  saturday: { opens: "08:30", closes: "22:30" },
  sunday: { opens: "09:00", closes: "13:00" },
};

/** Instante fijo en UTC: 12:00Z del lunes 2026-10-05 = 09:00 en Mendoza. */
const lunesManana = new Date("2026-10-05T12:00:00Z");
/** Martes 2026-10-06 15:00Z = 12:00 en Mendoza. */
const martesMediodia = new Date("2026-10-06T15:00:00Z");
/** Martes 2026-10-06 11:00Z = 08:00 en Mendoza (antes de abrir). */
const martesAntesDeAbrir = new Date("2026-10-06T11:00:00Z");
/** Martes 2026-10-07 00:00Z = 21:00 en Mendoza (después de cerrar). */
const martesDespuesDeCerrar = new Date("2026-10-07T00:00:00Z");
/** Sábado 2026-10-10 03:00Z = viernes 00:00 en Mendoza (abierto, viernes cierra 22:30 → a las 00:00 ya cerró; el día local es viernes). */
const viernesMedianoche = new Date("2026-10-10T03:00:00Z");
/** Domingo 2026-10-11 16:00Z = 13:00 en Mendoza (cierra 13:00: borde cerrado). */
const domingoBordeCierre = new Date("2026-10-11T16:00:00Z");
/** Domingo 2026-10-11 13:00Z = 10:00 en Mendoza. */
const domingoManana = new Date("2026-10-11T13:00:00Z");

describe("getOpenState", () => {
  it("lunes: cerrado todo el día con motivo dia_completo y próxima apertura mañana", () => {
    const estado = getOpenState(HOURS, lunesManana);
    expect(estado).toEqual({
      estado: "cerrado",
      motivo: "dia_completo",
      proximaApertura: { diaLabel: "Mañana", hora: "08:30" },
    });
  });

  it("martes al mediodía: abierto, informa la hora de cierre", () => {
    expect(getOpenState(HOURS, martesMediodia)).toEqual({
      estado: "abierto",
      cierra: "20:30",
    });
  });

  it("martes antes de abrir: fuera_de_horario con apertura hoy", () => {
    expect(getOpenState(HOURS, martesAntesDeAbrir)).toEqual({
      estado: "cerrado",
      motivo: "fuera_de_horario",
      proximaApertura: { diaLabel: "Hoy", hora: "08:30" },
    });
  });

  it("martes después de cerrar: próxima apertura mañana (miércoles)", () => {
    expect(getOpenState(HOURS, martesDespuesDeCerrar)).toEqual({
      estado: "cerrado",
      motivo: "fuera_de_horario",
      proximaApertura: { diaLabel: "Mañana", hora: "08:30" },
    });
  });

  it("viernes 00:00 (sábado 03:00Z): abierto o cerrado según Mendoza, no UTC", () => {
    // El viernes cierra 22:30, así que a la 00:00 ya está cerrado; la
    // próxima apertura es el sábado a las 08:30. Si se usara la fecha UTC
    // (sábado) el estado saldría "abierto": este test lo detecta.
    expect(getOpenState(HOURS, viernesMedianoche)).toEqual({
      estado: "cerrado",
      motivo: "fuera_de_horario",
      proximaApertura: { diaLabel: "Hoy", hora: "08:30" },
    });
  });

  it("domingo 10:00: abierto (domingo corto hasta las 13:00)", () => {
    expect(getOpenState(HOURS, domingoManana)).toEqual({
      estado: "abierto",
      cierra: "13:00",
    });
  });

  it("domingo 13:00 en punto: ya cerrado (borde exclusivo)", () => {
    const estado = getOpenState(HOURS, domingoBordeCierre);
    expect(estado?.estado).toBe("cerrado");
    // El siguiente día con apertura después del domingo 13:00 es el martes
    // (el lunes está cerrado): salta el lunes sin presentarlo como opción.
    expect(estado?.estado === "cerrado" && estado.proximaApertura).toEqual({
      diaLabel: "Martes",
      hora: "08:30",
    });
  });

  it("soporta cierre de madrugada (22:00–02:00)", () => {
    const horarioNocturno: OpeningHours = {
      friday: { opens: "22:00", closes: "02:00" },
    };
    // Sábado 2026-10-10 04:00Z = sábado 01:00 en Mendoza: todavía abierto
    // por la franja del VIERNES que cierra de madrugada.
    expect(getOpenState(horarioNocturno, new Date("2026-10-10T04:00:00Z"))).toEqual({
      estado: "abierto",
      cierra: "02:00",
    });
    // Sábado 03:00 en Mendoza: ya cerrado; próxima apertura el viernes.
    const cerrado = getOpenState(horarioNocturno, new Date("2026-10-10T06:00:00Z"));
    expect(cerrado?.estado).toBe("cerrado");
    expect(cerrado?.estado === "cerrado" && cerrado.proximaApertura).toEqual({
      diaLabel: "Viernes",
      hora: "22:00",
    });
  });

  it("sin ningún horario cargado: `null` (sin informar) — no es 'cerrado' y no bloquea", () => {
    // El dominio no puede afirmar que el local está cerrado si nadie cargó
    // los horarios: la UI no muestra banner y el checkout no bloquea.
    expect(getOpenState({}, martesMediodia)).toBeNull();
  });
});

describe("describirEstado", () => {
  it("formatea cada estado para UI", () => {
    expect(describirEstado(getOpenState(HOURS, martesMediodia))).toBe("Abierto hasta las 20:30");
    expect(describirEstado(getOpenState(HOURS, lunesManana))).toBe("Abre mañana a las 08:30");
    expect(describirEstado(getOpenState(HOURS, martesAntesDeAbrir))).toBe("Abre hoy a las 08:30");
    expect(getOpenState({ monday: null }, lunesManana)).toEqual({
      estado: "cerrado",
      motivo: "dia_completo",
      proximaApertura: null,
    });
    expect(describirEstado(getOpenState({}, martesMediodia))).toBe("Horario no disponible");
    expect(describirEstado(null)).toBe("Horario no disponible");
  });
});
