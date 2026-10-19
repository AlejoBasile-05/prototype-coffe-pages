import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OpeningHoursTable } from "./OpeningHours";

describe("OpeningHoursTable", () => {
  const hours = {
    monday: null,
    tuesday: { opens: "08:30", closes: "20:30" },
    sunday: { opens: "09:00", closes: "13:00" },
  };

  it("lee las claves canónicas en inglés y etiqueta en español", () => {
    render(<OpeningHoursTable hours={hours} />);

    // Regresión del bug: la tabla antes buscaba hours["martes"] y el dato
    // vive en hours["tuesday"], así que TODO decía "Cerrado".
    const martes = screen.getByRole("rowheader", { name: "Martes" });
    expect(martes.closest("tr")).toHaveTextContent("08:30 a 20:30 hs");

    const domingo = screen.getByRole("rowheader", { name: "Domingo" });
    expect(domingo.closest("tr")).toHaveTextContent("09:00 a 13:00 hs");

    const lunes = screen.getByRole("rowheader", { name: "Lunes" });
    expect(lunes.closest("tr")).toHaveTextContent("Cerrado");
  });

  it("distingue cerrado (clave con null) de sin informar (clave ausente)", () => {
    render(<OpeningHoursTable hours={{ monday: null }} />);

    // Regresión: ausente se mostraba como "Cerrado", y el dominio dice
    // explícitamente que presentar "sin informar" como cerrado es mentir.
    expect(screen.getByRole("rowheader", { name: "Lunes" }).closest("tr")).toHaveTextContent(
      "Cerrado",
    );
    expect(screen.getByRole("rowheader", { name: "Martes" }).closest("tr")).toHaveTextContent(
      "—",
    );
  });

  it("el orden de los días es el del dominio, no el del JSONB", () => {
    render(<OpeningHoursTable hours={hours} />);

    const encabezados = screen
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent);
    expect(encabezados[0]).toBe("Lunes");
    expect(encabezados[6]).toBe("Domingo");
  });
});
