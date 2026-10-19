import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = join(process.cwd(), "src/app");

const buscarOgImages = (directorio: string): readonly string[] =>
  readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    return statSync(ruta).isDirectory()
      ? buscarOgImages(ruta)
      : ruta.endsWith("opengraph-image.tsx") || ruta.endsWith("opengraph-image.ts")
        ? [ruta]
        : [];
  });

describe("estructura de imágenes de Open Graph", () => {
  it("hay exactamente una, a nivel del layout público", () => {
    const encontradas = buscarOgImages(raiz);

    // ⛔ El motivo de §2.6 del doc en forma ejecutable. Un `opengraph-image`
    //    por producto se cuela sin que nadie lo note en la revisión.
    expect(encontradas).toHaveLength(1);
    expect(encontradas[0]).toContain(join("(public)", "opengraph-image.tsx"));
  });
});
