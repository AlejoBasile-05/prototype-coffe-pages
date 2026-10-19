/**
 * Máquina de estados de la comanda (Tarea 23).
 *
 * Es la ÚNICA fuente de verdad de las transiciones: la Server Action la
 * consulta antes de escribir y la UI para saber qué botones mostrar.
 * Estos tests fijan las reglas del dominio para que ninguna refactor
 * silenciosa permita "des-entregar" un pedido.
 */
import { describe, expect, it } from "vitest";

import {
  BOARD_STATUSES,
  canTransitionOrder,
  formatOrderNumber,
  nextStatusesFor,
} from "@/lib/domain";

describe("máquina de estados de comandas", () => {
  it("PENDING avanza a PREPARING o se cancela", () => {
    expect(nextStatusesFor("PENDING")).toEqual(["PREPARING", "CANCELLED"]);
  });

  it("PREPARING avanza a READY o se cancela", () => {
    expect(nextStatusesFor("PREPARING")).toEqual(["READY", "CANCELLED"]);
  });

  it("READY y CANCELLED son terminales", () => {
    expect(nextStatusesFor("READY")).toEqual([]);
    expect(nextStatusesFor("CANCELLED")).toEqual([]);
  });

  it("no permite saltos hacia atrás ni diagonal", () => {
    expect(canTransitionOrder("READY", "PENDING")).toBe(false);
    expect(canTransitionOrder("READY", "PREPARING")).toBe(false);
    expect(canTransitionOrder("PENDING", "READY")).toBe(false);
    expect(canTransitionOrder("CANCELLED", "PENDING")).toBe(false);
    expect(canTransitionOrder("PREPARING", "PREPARING")).toBe(false);
  });

  it("permite las transiciones del flujo", () => {
    expect(canTransitionOrder("PENDING", "PREPARING")).toBe(true);
    expect(canTransitionOrder("PREPARING", "READY")).toBe(true);
    expect(canTransitionOrder("PENDING", "CANCELLED")).toBe(true);
    expect(canTransitionOrder("PREPARING", "CANCELLED")).toBe(true);
  });

  it("el tablero muestra las tres columnas activas y no CANCELLED", () => {
    expect(BOARD_STATUSES).toEqual(["PENDING", "PREPARING", "READY"]);
  });
});

describe("formatOrderNumber", () => {
  it("rellena a cuatro dígitos", () => {
    expect(formatOrderNumber(45)).toBe("#0045");
    expect(formatOrderNumber(1)).toBe("#0001");
  });

  it("no corta números largos", () => {
    expect(formatOrderNumber(12345)).toBe("#12345");
  });
});
