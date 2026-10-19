import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CategoryNav } from "./CategoryNav";

const CATEGORIES = [
  { slug: "clasicos", name: "Clásicos" },
  { slug: "bebidas", name: "Bebidas" },
];

describe("CategoryNav", () => {
  it("renderiza un enlace por sección dentro del landmark", () => {
    render(<CategoryNav categories={CATEGORIES} />);

    const nav = screen.getByRole("navigation", { name: "Categorías" });
    expect(nav).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Clásicos" })).toHaveAttribute("href", "#clasicos");
  });

  it("marca la primera categoría como activa antes de observar", () => {
    render(<CategoryNav categories={CATEGORIES} />);

    expect(screen.getByRole("link", { name: "Clásicos" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Bebidas" })).not.toHaveAttribute("aria-current");
  });
});
