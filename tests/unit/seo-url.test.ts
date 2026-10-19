import { describe, expect, it } from "vitest";

import { absoluteUrl } from "@/lib/domain/seo";

const SITE = "https://modo-miga.com.ar";

describe("absoluteUrl", () => {
  it("quita la barra final del host y devuelve ruta absoluta", () => {
    expect(absoluteUrl("/", "https://modo-miga.com.ar/")).toBe("https://modo-miga.com.ar/");
    expect(absoluteUrl("/", "https://modo-miga.com.ar")).toBe("https://modo-miga.com.ar/");
  });

  it("acepta una ruta sin barra inicial", () => {
    expect(absoluteUrl("menu", SITE)).toBe("https://modo-miga.com.ar/menu");
  });

  it("no duplica la barra cuando la ruta ya la tiene", () => {
    expect(absoluteUrl("/menu", SITE)).toBe("https://modo-miga.com.ar/menu");
  });

  it("no toca una URL ya absoluta (Cloudinary)", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/f.png";
    expect(absoluteUrl(url, SITE)).toBe(url);
  });
});
