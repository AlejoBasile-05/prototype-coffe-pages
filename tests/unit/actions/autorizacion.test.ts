import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminSession } from "@/lib/domain";
import type { AjustesInput } from "@/server/schemas/ajustes.schema";

/**
 * ⛔ Dobles de CONTRATO, no de comportamiento. Ver Tarea 20 §5.2.
 *
 * `verifyAdminSession` devuelve exactamente tres cosas: `null`, una sesión
 * `OWNER` o una sesión `STAFF`. Si mañana devuelve un cuarto valor, este
 * archivo deja de compilar, y eso es lo correcto: la autorización cambió y
 * el test tiene que cambiar con ella.
 */
const verifyAdminSession = vi.fn<() => Promise<AdminSession | null>>();

const sesion = (role: AdminSession["role"]): AdminSession => ({
  userId: "u-ana",
  email: "ana@modomiga.com.ar",
  role,
});

vi.mock("@/server/auth/verify-admin", () => ({
  verifyAdminSession: () => verifyAdminSession(),
  requireAdminSession: async () => {
    const actual = await verifyAdminSession();
    if (actual === null) throw new Error("Sesión expirada");
    return actual;
  },
}));

/**
 * ⛔ `revalidatePath` y `revalidateTag` lanzan fuera de un contexto de
 *    request de Next. No es lógica de negocio: es una dependencia del
 *    framework que no se puede ejecutar en un test de Node.
 */
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

/**
 * ⛔ El doble de `@/server/infra/audit-log` existe por una razón concreta:
 *    la Tarea 19 prohibió que el log lleve el payload y el valor de los
 *    campos, pero si el log real corre contra un servicio simulado no hay
 *    fila que leer y el test pasa sin comprobar nada. Acá se afirma que la
 *    action llama al log DESPUÉS de que el servicio responda.
 */
const logAdminAction = vi.fn();
vi.mock("@/server/infra/audit-log", () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}));

const createProductFromAdmin = vi.fn();
const updateProductFromAdmin = vi.fn();
const archiveProductFromAdmin = vi.fn();
const setProductAvailability = vi.fn();
const createCategoryFromAdmin = vi.fn();
const updateCategoryFromAdmin = vi.fn();
const deleteCategoryFromAdmin = vi.fn();
const setCategoryVisibilityFromAdmin = vi.fn();
const updateSettingsFromAdmin = vi.fn();

/**
 * ⛔ Las actions importan de DOS rutas: el barril `@/server/services` y el
 *    módulo concreto. Por eso hay que doblar las dos, y no sólo el barril.
 *    Ver los imports de `categorias.ts:26` y `ajustes.ts:23`.
 *
 * ⛔ Y hay que doblar con `importOriginal`, NO con una lista cerrada de
 *    exports. Las actions también usan helpers puros del mismo módulo
 *    (`camposEditadosDeProducto`, `camposEditadosDeCategoria`,
 *    `camposEditadosDeAjustes`). Una factory que devuelve sólo los nombres
 *    de los servicios deja esos helpers en `undefined`, la action revienta
 *    al loguear, cae al `catch` y devuelve `UNKNOWN`: el test de la ruta
 *    exitosa falla por un motivo que no tiene nada que ver con la
 *    autorización, que es exactamente la clase de test que hace perder la
 *    confianza en la suite.
 */
vi.mock("@/server/services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/services")>()),
  createProductFromAdmin,
  updateProductFromAdmin,
  archiveProductFromAdmin,
  setProductAvailability,
  getCategoryAdminDependencies: () => ({ origen: "doble" }),
  getSettingsAdminDependencies: () => ({ origen: "doble" }),
}));

vi.mock("@/server/services/category-admin.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/services/category-admin.service")>()),
  createCategoryFromAdmin,
  updateCategoryFromAdmin,
  deleteCategoryFromAdmin,
  setCategoryVisibilityFromAdmin,
}));

vi.mock("@/server/services/settings-admin.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/services/settings-admin.service")>()),
  updateSettingsFromAdmin,
}));

/**
 * Payload válido y completo: el rechazo tiene que ser por sesión, no por
 * validación.
 *
 * ⚠️ Va SIN anotar a propósito, y es la forma CRUD que manda el formulario,
 * no `ProductoAltaInput`. `precioComoNumero` es un `string` con coma
 *decimal que se transforma a número al parsear (`z.infer` ya da `number`),
 * así que `ProductoAltaInput` es el tipo de la SALIDA del Zod, no lo que
 * llega a la action. Anotarlo acá obligaría a pasar `1450.5`, que el
 * formulario nunca manda, y el test de "precio negativo" dejaría de poder
 * escribir `"-450"`.
 */
const productoValido = {
  nombre: "Classic Jamón y Queso",
  descripcion: "Vientre de leche con jamón cocido y queso gouda.",
  precio: "1450,50",
  categoryId: "11111111-1111-4111-8111-111111111111",
  allergens: ["gluten", "lactosa"],
  isFeatured: false,
  imagen: {
    imageUrl: "https://res.cloudinary.com/modo-miga/image/upload/x.jpg",
    imagePublicId: "modo-miga/products/classic-jamon-y-queso",
  },
};

/**
 * Payload válido y completo, con las claves exactas de `AjustesSchema`.
 * La idea es la misma: si el payload no parseara, el test probaría Zod y no
 * la autorización.
 *
 * ⚠️ `horarios` NO es un `Partial`, por dos razones que el ejemplo del
 *    documento de la tarea no tiene en cuenta desde la Tarea 17:
 *    1. `HorarioInputSchema` (`src/lib/validation/ajustes.ts:153`) exige las
 *       TRES claves, con `estado` explícito y `abre`/`cierra` SIEMPRE string
 *       — la ausencia en el formulario es `""`, no `null`.
 *    2. `z.record(z.enum(WEEKDAY_KEYS), ...)` en Zod 4 es exhaustivo: un día
 *       ausente es un error, no un `undefined`. El formulario manda los
 *       SIETE siempre.
 */
const sinInformar = { estado: "sin_informar", abre: "", cierra: "" } as const;

const ajustesValidos: AjustesInput = {
  nombre: "Mi Negocio",
  telefonoWhatsapp: "5492615551234",
  direccion: "San Rafael, Mendoza",
  instagram: "https://instagram.com/modo.miga",
  mensajeCierre: null,
  avisoLegal: null,
  horarios: {
    monday: { estado: "informado", abre: "09:00", cierra: "21:00" },
    tuesday: sinInformar,
    wednesday: sinInformar,
    thursday: sinInformar,
    friday: sinInformar,
    saturday: sinInformar,
    sunday: sinInformar,
  },
};

const CATEGORIA_ID = "22222222-2222-4222-8222-222222222222";

/**
 * ⛔ Lo que devuelve cada servicio NO es decorativo: la action lee
 *    propiedades del resultado antes de loguear (`resultado.id`,
 *    `creada.slug`, `camposEditadosDeAjustes(guardados, ...)`). Un doble
 *    que devuelve `undefined` hace que la action caiga al `catch` y
 *    devuelva `UNKNOWN`: el test pasa por el motivo equivocado.
 */
const PRODUCTO_CREADO = {
  id: "prod_1",
  slug: "classic-jamon-y-queso",
  name: "Classic Jamón y Queso",
  description: "Vientre de leche con jamón cocido y queso gouda.",
  price: 1450.5,
  categoryId: "11111111-1111-4111-8111-111111111111",
  allergens: ["gluten", "lactosa"],
  isFeatured: false,
  isAvailable: true,
  imageUrl: "https://res.cloudinary.com/modo-miga/image/upload/x.jpg",
  imagePublicId: "modo-miga/products/classic-jamon-y-queso",
};

/**
 * ⛔ `OpeningHours` habla inglés (`opens`/`closes`) porque es lo que se
 *    guarda en la columna `jsonb`; el formulario habla español
 *    (`abre`/`cierra`). Un doble con las claves del formulario pasa el
 *    type-check de los pagos igual y revienta en `toDayRow`.
 */
const AJUSTES_GUARDADOS = {
  name: "Mi Negocio",
  whatsappPhone: "5492615551234",
  address: "San Rafael, Mendoza",
  instagramUrl: "https://instagram.com/modo.miga",
  openingHours: {
    monday: { opens: "09:00", closes: "21:00" },
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
    saturday: null,
    sunday: null,
  },
  closingMessage: null,
  legalNotice: null,
};

const CATEGORIA_CREADA = {
  id: CATEGORIA_ID,
  nombre: "Bebidas frías",
  slug: "bebidas-frias",
  descripcion: "Limonada y jugos",
  isVisible: true,
  productCount: 0,
  isSlugEditable: true,
};

/**
 * ⛔ Payload que no parsea en ningún esquema.
 *
 * Todas las actions declaran `rawInput: unknown`, así que el doble del
 * servicio es el único que puede detectar que una action miró el input
 * antes de autorizar. Por eso `vi.spyOn` no alcanza y hace falta el doble
 * de `@/server/services`.
 */
const PAYLOAD_INVALIDO = { hackeado: true };

const TODOS_LOS_SERVICIOS = [
  createProductFromAdmin,
  updateProductFromAdmin,
  archiveProductFromAdmin,
  setProductAvailability,
  createCategoryFromAdmin,
  updateCategoryFromAdmin,
  deleteCategoryFromAdmin,
  setCategoryVisibilityFromAdmin,
  updateSettingsFromAdmin,
];

/** Carga las nueve actions de una vez, para que la cuenta sea auditable. */
const importActions = async () => {
  const productos = await import("@/server/actions/productos");
  const disponibilidad = await import("@/server/actions/product-availability.actions");
  const categorias = await import("@/server/actions/categorias");
  const ajustes = await import("@/server/actions/ajustes");

  return {
    createProductAction: productos.createProductAction,
    updateProductAction: productos.updateProductAction,
    archiveProductAction: productos.archiveProductAction,
    toggleProductAvailabilityAction: disponibilidad.toggleProductAvailabilityAction,
    createCategoryAction: categorias.createCategoryAction,
    updateCategoryAction: categorias.updateCategoryAction,
    setCategoryVisibilityAction: categorias.setCategoryVisibilityAction,
    deleteCategoryAction: categorias.deleteCategoryAction,
    updateBusinessSettingsAction: ajustes.updateBusinessSettingsAction,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  verifyAdminSession.mockResolvedValue(null);
  for (const servicio of TODOS_LOS_SERVICIOS) {
    servicio.mockResolvedValue(undefined);
  }
});

describe("las nueve Server Actions rechazan sin sesión", () => {
  it("deben rechazar las nueve y no delegar en ningún servicio", async () => {
    const acciones = await importActions();

    // ⛔ Nueve, ni una más ni una menos: 3 de productos, 1 de
    //    disponibilidad, 4 de categorías y 1 de ajustes. Es la misma cuenta
    //    que hace `verify:actions`, y las dos tienen que dar nueve.
    const resultados = await Promise.all([
      acciones.createProductAction(PAYLOAD_INVALIDO, null),
      acciones.updateProductAction(PAYLOAD_INVALIDO, null),
      acciones.archiveProductAction(PAYLOAD_INVALIDO),
      acciones.toggleProductAvailabilityAction(PAYLOAD_INVALIDO),
      acciones.createCategoryAction(PAYLOAD_INVALIDO),
      acciones.updateCategoryAction(PAYLOAD_INVALIDO),
      acciones.setCategoryVisibilityAction(PAYLOAD_INVALIDO),
      acciones.deleteCategoryAction(PAYLOAD_INVALIDO),
      acciones.updateBusinessSettingsAction(PAYLOAD_INVALIDO),
    ]);

    for (const resultado of resultados) {
      expect(resultado.ok).toBe(false);
    }

    // ⛔ La mitad del valor del test. Si una action autoriza después de
    //    parsear, o si el servicio se llama antes del chequeo, esto falla.
    for (const servicio of TODOS_LOS_SERVICIOS) {
      expect(servicio).not.toHaveBeenCalled();
    }
  });

  it("no deben emitir un solo evento de auditoría sin sesión", async () => {
    // Un `logAdminAction` en la rama de rechazo documentaría un cambio que
    // no ocurrió: el panel mostrando "Ana cambió X" cuando nadie cambió
    // nada es un log que no sirve para investigar nada.
    const acciones = await importActions();

    await acciones.createProductAction(PAYLOAD_INVALIDO, null);
    await acciones.toggleProductAvailabilityAction(PAYLOAD_INVALIDO);
    await acciones.updateBusinessSettingsAction(PAYLOAD_INVALIDO);

    expect(logAdminAction).not.toHaveBeenCalled();
  });

  it("deben devolver el mensaje de cada familia, no uno genérico", async () => {
    const acciones = await importActions();

    // ⛔ Los tres textos NO son iguales: productos, disponibilidad y
    //    ajustes escribieron cada uno el suyo (Tarea 20 §7.2). El test
    //    afirma los tres por separado a propósito: unificar el mensaje es
    //    una decisión de producto, y unificarlo acá haría fallar el test
    //    justo cuando alguien la arregle.
    expect(await acciones.createProductAction(PAYLOAD_INVALIDO, null)).toEqual({
      ok: false,
      error: "Tu sesión expiró. Volvé a entrar.",
      code: "UNAUTHORIZED",
    });
    expect(await acciones.toggleProductAvailabilityAction(PAYLOAD_INVALIDO)).toEqual({
      ok: false,
      error: "Tu sesión expiró. Volvé a iniciar sesión para seguir.",
      code: "UNAUTHORIZED",
    });
    expect(await acciones.updateBusinessSettingsAction(PAYLOAD_INVALIDO)).toEqual({
      ok: false,
      error: "Sesión expirada. Volvé a iniciar sesión.",
    });
  });
});

describe("el filtro de rol", () => {
  it("debe impedir que un STAFF cambie los datos del negocio", async () => {
    verifyAdminSession.mockResolvedValue(sesion("STAFF"));
    const { updateBusinessSettingsAction } = await importActions();

    const resultado = await updateBusinessSettingsAction(ajustesValidos);

    expect(resultado).toEqual({
      ok: false,
      error: "Sólo el dueño del negocio puede cambiar los datos de contacto.",
    });
    expect(updateSettingsFromAdmin).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
  });

  it("debe dejar que un OWNER cambie los datos del negocio", async () => {
    verifyAdminSession.mockResolvedValue(sesion("OWNER"));
    updateSettingsFromAdmin.mockResolvedValue(AJUSTES_GUARDADOS);
    const { updateBusinessSettingsAction } = await importActions();

    const resultado = await updateBusinessSettingsAction(ajustesValidos);

    expect(resultado.ok).toBe(true);
    expect(updateSettingsFromAdmin).toHaveBeenCalledTimes(1);
  });

  it("debe permitir que un STAFF cree un producto, porque el panel es de los dos", async () => {
    verifyAdminSession.mockResolvedValue(sesion("STAFF"));
    createProductFromAdmin.mockResolvedValue(PRODUCTO_CREADO);
    const { createProductAction } = await importActions();

    const resultado = await createProductAction(productoValido, null);

    expect(resultado.ok).toBe(true);
    expect(createProductFromAdmin).toHaveBeenCalledTimes(1);
  });

  it("debe permitir que un STAFF toggle la disponibilidad, que es su tarea diaria", async () => {
    verifyAdminSession.mockResolvedValue(sesion("STAFF"));
    setProductAvailability.mockResolvedValue({ id: "prod_1", isAvailable: true });
    const { toggleProductAvailabilityAction } = await importActions();

    const resultado = await toggleProductAvailabilityAction({ id: "prod_1", isAvailable: true });

    expect(resultado.ok).toBe(true);
    expect(setProductAvailability).toHaveBeenCalledTimes(1);
  });

  it("debe rechazar un producto con precio negativo antes de delegar", async () => {
    verifyAdminSession.mockResolvedValue(sesion("OWNER"));
    const { createProductAction } = await importActions();

    const resultado = await createProductAction({ ...productoValido, precio: "-450" }, null);

    expect(resultado.ok).toBe(false);
    expect(createProductFromAdmin).not.toHaveBeenCalled();
  });

  it("debe auditar el cambio DESPUÉS de que el servicio responda", async () => {
    verifyAdminSession.mockResolvedValue(sesion("OWNER"));
    setProductAvailability.mockResolvedValue({ id: "prod_1", isAvailable: false });
    const { toggleProductAvailabilityAction } = await importActions();

    const orden: string[] = [];
    setProductAvailability.mockImplementation(async () => {
      orden.push("servicio");
      return { id: "prod_1", isAvailable: false };
    });
    logAdminAction.mockImplementation(() => {
      orden.push("log");
    });

    await toggleProductAvailabilityAction({ id: "prod_1", isAvailable: false });

    // Si el log se escribiera antes, un revalidate fallido dejaría un
    // registro de un cambio que la base nunca vio.
    expect(orden).toEqual(["servicio", "log"]);
  });
});

describe("las categorías también exigen sesión antes de tocar el payload", () => {
  it("no debe crear una categoría sin sesión aunque el payload sea válido", async () => {
    verifyAdminSession.mockResolvedValue(null);
    const { createCategoryAction } = await importActions();

    const resultado = await createCategoryAction({
      nombre: "Bebidas frías",
      descripcion: "Limonada y jugos",
    });

    expect(resultado).toEqual({
      ok: false,
      error: "Sesión expirada. Volvé a iniciar sesión.",
    });
    expect(createCategoryFromAdmin).not.toHaveBeenCalled();
  });

  it("debe delegar una categoría válida cuando hay sesión", async () => {
    verifyAdminSession.mockResolvedValue(sesion("OWNER"));
    createCategoryFromAdmin.mockResolvedValue(CATEGORIA_CREADA);
    const { createCategoryAction } = await importActions();

    const resultado = await createCategoryAction({
      nombre: "Bebidas frías",
      descripcion: "Limonada y jugos",
    });

    expect(resultado.ok).toBe(true);
    expect(createCategoryFromAdmin).toHaveBeenCalledTimes(1);
  });
});
