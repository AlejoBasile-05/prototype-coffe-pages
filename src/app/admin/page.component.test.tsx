import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import type { BusinessSettingsDTO, ProductRow, ProductStatusDTO } from "@/lib/domain";
import { getOrdersForBoard, getProductsForAdmin, getSettingsForAdmin } from "@/server/services";

import AdminDashboard from "./page";

vi.mock("@/server/services", () => ({
  getProductsForAdmin: vi.fn(),
  getSettingsForAdmin: vi.fn(),
  getOrdersForBoard: vi.fn(),
}));

const mockProducts = vi.mocked(getProductsForAdmin);
const mockSettings = vi.mocked(getSettingsForAdmin);
const mockOrders = vi.mocked(getOrdersForBoard);

const SETTINGS: BusinessSettingsDTO = {
  name: "Mi Negocio",
  whatsappPhone: "5492615551234",
  address: "Belgrano 1234, San Luis",
  instagramUrl: null,
  openingHours: {},
  closingMessage: null,
  legalNotice: null,
};

const fila = (overrides: Partial<ProductRow> = {}): ProductRow => ({
  id: "prd_1",
  name: "Jamón y Queso",
  slug: "jamon-y-queso",
  imageUrl: "https://res.cloudinary.com/demo/image/upload/jq.jpg",
  price: 1450,
  status: "PUBLISHED" as ProductStatusDTO,
  isAvailable: true,
  isFeatured: false,
  sortOrder: 0,
  categoryId: "cat_clasicos",
  categoryName: "Clásicos",
  ...overrides,
});

/**
 * La página es un Server Component async: `render` necesita el JSX ya
 * resuelto, así que se espera la promesa antes de renderizar. Lo que se
 * prueba es el árbol que devuelve, con los servicios sustituidos.
 */
const renderPagina = async () => render(await AdminDashboard());

beforeEach(() => {
  mockSettings.mockResolvedValue(SETTINGS);
  mockProducts.mockResolvedValue([]);
  mockOrders.mockResolvedValue([]);
});

describe("admin/page.tsx", () => {
  it("debe mostrar el nombre del local, la dirección y los cuatro contadores", async () => {
    mockProducts.mockResolvedValue([
      fila({ id: "a", status: "PUBLISHED", isAvailable: true }),
      fila({ id: "b", status: "PUBLISHED", isAvailable: false }),
      fila({ id: "c", status: "DRAFT", isAvailable: false }),
    ]);
    await renderPagina();

    expect(screen.getByRole("heading", { level: 1, name: "Panel de administración" })).toBeInTheDocument();
    expect(screen.getByText(/Mi Negocio/)).toBeInTheDocument();
    expect(screen.getByText("Belgrano 1234, San Luis")).toBeInTheDocument();

    // Los contadores salen del listado del panel, no del catálogo público
    // cacheado: el panel también tiene que ver borradores y agotados.
    expect(screen.getByText("Productos").nextElementSibling).toHaveTextContent("3");
    expect(screen.getByText("Publicados").nextElementSibling).toHaveTextContent("2");
    expect(screen.getByText("Borradores").nextElementSibling).toHaveTextContent("1");
  });

  it("debe contar como agotados solo los publicados sin stock", async () => {
    // Un archivado agotado no aparece en el menú, así que no ensucia el
    // contador que el encargado usa para decidir qué reponer.
    mockProducts.mockResolvedValue([
      fila({ id: "a", status: "PUBLISHED", isAvailable: false }),
      fila({ id: "b", status: "ARCHIVED", isAvailable: false }),
    ]);
    await renderPagina();

    expect(screen.getByText("Agotados").nextElementSibling).toHaveTextContent("1");
  });

  it("debe avisar que los ajustes están sin cargar en vez de mostrar un hueco", async () => {
    mockSettings.mockResolvedValue({ ...SETTINGS, address: null, instagramUrl: null });
    await renderPagina();

    expect(screen.getAllByText("Sin cargar")).toHaveLength(2);
  });

  it("debe pedir productos con un EmptyState sin enlace a una ruta que no existe", async () => {
    mockProducts.mockResolvedValue([]);
    await renderPagina();

    expect(screen.getByText("Todavía no hay productos")).toBeInTheDocument();

    // El alta es la Tarea 16: un botón a un 404 se lee como error del sistema.
    // Los atajos existentes: el tablero de comandas (Tarea 23) y productos.
    const enlaces = screen.getAllByRole("link");
    expect(enlaces).toHaveLength(2);
    expect(enlaces[0]).toHaveAttribute("href", "/admin/comandas");
    expect(enlaces[1]).toHaveAttribute("href", "/admin/productos");
  });

  it("debe llevar a la tabla cuando ya hay productos", async () => {
    mockProducts.mockResolvedValue([fila()]);
    await renderPagina();

    const atajo = screen.getByRole("link", { name: /Ver productos/ });
    expect(atajo).toHaveAttribute("href", "/admin/productos");

    expect(screen.queryByText("Todavía no hay productos")).toBeNull();
  });

  it("no debe mostrar el detalle de 'en el menú' cuando no hay publicados", async () => {
    mockProducts.mockResolvedValue([fila({ status: "DRAFT", isAvailable: false })]);
    await renderPagina();

    const tarjetaAgotados = screen.getByText("Agotados").closest("div") as HTMLElement;
    expect(within(tarjetaAgotados).queryByText(/en el menú/)).toBeNull();
  });

  it("degrada ante un fallo de comandas: el home sobrevive sin el badge de pendientes", async () => {
    // La lectura del tablero rompe; el home no puede morir por un adorno.
    // El console.error es la evidencia del fallo en el log del servidor:
    // se espía para que el setup de tests no lo trate como inesperado.
    const espiaError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockOrders.mockRejectedValue(new Error("relation orders does not exist"));
    await renderPagina();

    expect(espiaError).toHaveBeenCalledWith(
      "[admin] no se pudieron leer las comandas del home",
      expect.any(Error),
    );

    expect(screen.getByRole("heading", { level: 1, name: "Panel de administración" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver el tablero de comandas/ })).toBeInTheDocument();
    expect(screen.queryByText(/pendientes/)).toBeNull();
  });

  it("muestra el badge con el conteo de comandas pendientes cuando las hay", async () => {
    mockOrders.mockResolvedValue([
      {
        id: "ord_1",
        orderNumber: 1,
        status: "PENDING",
        customerName: "Ana",
        customerPhone: "5492615551234",
        fulfillment: "PICKUP",
        address: null,
        notes: null,
        total: 100,
        items: [],
        createdAt: new Date().toISOString(),
      },
    ]);
    await renderPagina();

    expect(screen.getByText("1 pendientes")).toBeInTheDocument();
  });
});
