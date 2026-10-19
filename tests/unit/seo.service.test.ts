import { describe, expect, it, vi } from "vitest";

import { readSitemapEntries } from "@/server/services/seo.service";

const ajustes = new Date("2026-03-01T10:00:00Z");

const crearDependencias = (productos: readonly { slug: string; updatedAt: Date }[]) => ({
  productRepository: {
    findPublishedProductsForSitemap: vi.fn().mockResolvedValue(productos),
  },
  getContentUpdatedAt: vi.fn().mockResolvedValue(ajustes),
});

describe("readSitemapEntries", () => {
  it("debe devolver la home y el menú aunque no haya productos", async () => {
    const entradas = await readSitemapEntries(crearDependencias([]));

    expect(entradas.map((entrada) => entrada.path)).toEqual(["/", "/menu"]);
  });

  it("arma la ruta de cada producto con su fecha de la fila", async () => {
    const entrada = await readSitemapEntries(
      crearDependencias([
        { slug: "jamon-y-queso-clasico", updatedAt: new Date("2026-04-02T12:00:00Z") },
      ]),
    );

    expect(entrada.at(-1)?.path).toBe("/producto/jamon-y-queso-clasico");
    // ⛔ `updatedAt` de la fila, no la fecha de hoy: es la única forma de
    //    que Google no repa deza la generación del sitemap.
    expect(entrada.at(-1)?.lastModified).toEqual(new Date("2026-04-02T12:00:00Z"));
  });

  it("propaga el error del repositorio en vez de devolver un sitemap vacío", async () => {
    const dependencias = crearDependencias([]);
    dependencias.productRepository.findPublishedProductsForSitemap = vi
      .fn()
      .mockRejectedValue(new Error("db caída"));

    await expect(readSitemapEntries(dependencias)).rejects.toThrow("db caída");
  });
});
