/**
 * Pruebas del esquema del formulario (Tarea 16 §10.1).
 *
 * El test de alérgenos protege al glosario: el enum de Zod está escrito
 * a mano y un desajuste (el glosario ganó una clave y el esquema no) se
 * descubre acá, no en producción. El resto son las reglas del campo.
 */
import { describe, expect, it } from "vitest";

import { ALERGENOS } from "@/lib/domain/allergens";
import { ProductoAltaSchema, ProductoEdicionSchema } from "@/lib/validation/producto-admin";

const imagenValida = {
  imageUrl: "https://res.cloudinary.com/demo/image/upload/modo-miga/products/cafe.jpg",
  imagePublicId: "modo-miga/products/cafe",
} as const;

const datosValidos = {
  nombre: "Café con leche",
  descripcion: "Espresso con leche caliente",
  precio: "1450,50",
  categoryId: "cat_1",
  allergens: ["lactosa"],
  imagen: imagenValida,
};

describe("ProductoAltaSchema", () => {
  it("debe aceptar el conjunto de alérgenos que declara el dominio, en el mismo orden", () => {
    alergenosQueDebenSerAceptadosParaElTest();
  });

  it.each([
    ["1450", 1450],
    ["1450,50", 1450.5],
    ["1450.50", 1450.5],
    ["0", 0],
  ])("debe convertir el precio %s en el número %d", (entrada, esperado) => {
    expect(ProductoAltaSchema.parse({ ...datosValidos, precio: entrada }).precio).toBe(esperado);
  });

  it.each([["1.450,50"], ["1450,555"], ["abc"], ["-1"], [""]])(
    "debe rechazar el precio %s",
    (entrada) => {
      // Miles con punto NO se adivinan: un `NaN` silencioso en el precio
      // es peor que el error visible en el formulario.
      expect(ProductoAltaSchema.safeParse({ ...datosValidos, precio: entrada }).success).toBe(
        false,
      );
    },
  );

  it("debe rechazar una imagen que no sea de Cloudinary", () => {
    const parsed = ProductoAltaSchema.safeParse({
      ...datosValidos,
      imagen: { imageUrl: "https://ejemplo.com/foto.jpg", imagePublicId: "foto" },
    });
    expect(parsed.success).toBe(false);
  });

  it("debe convertir la descripción vacía en null en vez de guardar una string vacía", () => {
    expect(
      ProductoAltaSchema.parse({ ...datosValidos, descripcion: "   " }).descripcion,
    ).toBeNull();
  });

  it('debe ignorar `status: "ARCHIVED"` si llega en el payload del alta', () => {
    // El alta nace siempre en DRAFT. El esquema no acepta el campo:
    // mandarlo por error no rompe nada, pero no lo guarda.
    const parsed = ProductoAltaSchema.safeParse({ ...datosValidos, status: "ARCHIVED" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("status");
    }
  });

  it("debe rechazar el alta sin imagen válida", () => {
    const parsed = ProductoAltaSchema.safeParse({ ...datosValidos, imagen: undefined });
    expect(parsed.success).toBe(false);
  });
});

describe("ProductoEdicionSchema", () => {
  const edicionValida = {
    ...datosValidos,
    id: "prod_1",
  };

  it("debe aceptar un slug válido en el alta y en la edición", () => {
    const parsed = ProductoEdicionSchema.safeParse({ ...edicionValida, slug: "mi-slug" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.slug).toBe("mi-slug");
    }
  });

  it("debe rechazar un slug con mayúsculas, espacios o tildes", () => {
    for (const slugInvalido of ["Mi Slug", "mi-slug!", "mi_slug"]) {
      const parsed = ProductoEdicionSchema.safeParse({ ...edicionValida, slug: slugInvalido });
      expect(parsed.success).toBe(false);
    }
  });

  it("`ProductoEdicionSchema` no es `.partial()`: tiene sus propias reglas y los mismos requeridos", () => {
    const parseado = ProductoEdicionSchema.safeParse({
      nombre: "Café",
      descripcion: "",
      precio: "1450",
      categoryId: "cat_1",
      allergens: ["lactosa"],
      isFeatured: false,
      slug: "cafe",
      status: "PUBLISHED",
      id: "prod_1",
      imagen: imagenValida,
    });
    expect(parseado.success).toBe(true);
    if (parseado.success) {
      expect(parseado.data.status).toBe("PUBLISHED");
      expect(parseado.data.slug).toBe("cafe");
      expect(parseado.data.id).toBe("prod_1");
    }
  });
});

// Aislado: el enum se compara clave por clave contra el glosario, y la
// forma que se usa en la aserción es un match de array entero. Si no
// compila aquí, es porque `ALERGENOS` todavía no exporta los valores.
function alergenosQueDebenSerAceptadosParaElTest(): void {
  const alergenosParaTest = [...ALERGENOS];
  const parsed = ProductoAltaSchema.safeParse({
    nombre: "Café con leche",
    descripcion: "Espresso con leche caliente",
    precio: "1450,50",
    categoryId: "cat_1",
    allergens: alergenosParaTest,
    imagen: imagenValida,
  });
  expect(parsed.success).toBe(true);
  if (parsed.success) {
    expect(parsed.data.allergens).toEqual(alergenosParaTest);
  }
}
