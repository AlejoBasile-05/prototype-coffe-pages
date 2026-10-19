/**
 * Orquestador del seed.
 *
 * Este archivo NO lleva `import "server-only"`: corre bajo `tsx`, no bajo
 * Next. Los repositorios que importa sí lo llevan, y por eso el comando
 * del seed necesita `--conditions=react-server` (Tarea 05 §6.2).
 *
 * Estructura: cuatro pasos (configuración → categorías → productos →
 * administrador), cada uno aislado con su propio try/catch para que un
 * fallo en un paso no impida a los idempotentes siguientes intentarlo,
 * y un reporte final que decide el exit code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { toCanonicalAllergen, type Allergen } from "../../src/lib/domain/allergens";
import {
  createCategory,
  findAllCategoriesForAdmin,
} from "../../src/server/repositories/category.repository";
import {
  createProduct,
  findAllProductsForAdmin,
} from "../../src/server/repositories/product.repository";
import { saveBusinessSettings } from "../../src/server/repositories/settings.repository";
import {
  createStaffMember,
  findStaffByEmail,
} from "../../src/server/repositories/staff.repository";
import type { ProductStatus } from "@prisma/client";

import { CATEGORIAS_SEED } from "./categorias.seed";
import { NEGOCIO_SEED, leerAdminDelEntorno } from "./negocio.seed";
import { PRODUCTOS_SEED, buildImagenDeRelleno, imageSampleFor } from "./productos.seed";

interface Reporte {
  readonly creados: string[];
  readonly omitidos: string[];
  readonly errores: string[];
}

const crearReporte = (): Reporte => ({ creados: [], omitidos: [], errores: [] });

const registrarError = (reporte: Reporte, paso: string, error: unknown): void => {
  const mensaje = error instanceof Error ? error.message : String(error);
  reporte.errores.push(`${paso}: ${mensaje}`);
  console.error(`[seed] ${paso} -> ${mensaje}`);
};

/**
 * Estado editorial efectivo de los productos del seed.
 *
 * D-01 / decisiones-negocio §5: el set MOCK siempre nace en DRAFT y solo
 * pasa a PUBLISHED si el entorno lo pide **explícitamente**. Nunca se
 * "infieren" productos publicados a partir de los datos: un precio de
 * negocio no se inventa y un mock no se publica.
 */
const estadoDeProductos = (): ProductStatus =>
  process.env["SEED_PUBLISH_MOCK"] === "true" ? "PUBLISHED" : "DRAFT";

/**
 * Normaliza los alérgenos del dato semilla al glosario cerrado.
 *
 * Si el menú llegara con "Maní" o "MANI", acá se guarda "maní". Si una
 * clave no está en el glosario, se descarta y se avisa: es preferible un
 * alérgeno faltante en el dato de ejemplo que uno inventado en la base.
 */
const prepararAlergenos = (
  valores: readonly string[],
  nombre: string,
  reporte: Reporte,
): Allergen[] => {
  const canonicos = valores
    .map((valor) => toCanonicalAllergen(valor))
    .filter((valor): valor is Allergen => valor !== null);

  const descartados = valores.length - canonicos.length;
  if (descartados > 0) {
    registrarError(reporte, `alérgenos de "${nombre}"`, `${descartados} fuera del glosario`);
  }
  return canonicos;
};

const sembrarConfiguracion = async (reporte: Reporte): Promise<void> => {
  await saveBusinessSettings(NEGOCIO_SEED);
  reporte.creados.push("business_settings (id='1', siempre sobrescrito)");
};

const sembrarCategorias = async (reporte: Reporte): Promise<Map<string, string>> => {
  // Lee TODAS, no solo las visibles: si el encargado ocultó una categoría
  // desde el panel, una corrida posterior no debe resucitarla.
  const existentes = new Map(
    (await findAllCategoriesForAdmin()).map((categoria) => [categoria.slug, categoria]),
  );

  const idsPorSlug = new Map<string, string>();

  for (const categoria of CATEGORIAS_SEED) {
    const existente = existentes.get(categoria.slug);
    if (existente !== undefined) {
      reporte.omitidos.push(`categoría "${categoria.slug}" (ya existía)`);
      idsPorSlug.set(categoria.slug, existente.id);
      continue;
    }

    const creada = await createCategory({
      name: categoria.name,
      slug: categoria.slug,
      description: categoria.description,
      position: categoria.position,
      isVisible: categoria.isVisible,
    });
    idsPorSlug.set(categoria.slug, creada.id);
    reporte.creados.push(`categoría "${categoria.slug}"`);
  }

  return idsPorSlug;
};

const sembrarProductos = async (
  idsPorSlug: ReadonlyMap<string, string>,
  reporte: Reporte,
): Promise<void> => {
  const existentes = new Map(
    (await findAllProductsForAdmin()).map((producto) => [producto.slug, producto]),
  );
  const status = estadoDeProductos();

  for (const [index, producto] of PRODUCTOS_SEED.entries()) {
    if (existentes.has(producto.slug)) {
      reporte.omitidos.push(`producto "${producto.slug}" (ya existía)`);
      continue;
    }

    const categoryId = idsPorSlug.get(producto.categorySlug);
    if (categoryId === undefined) {
      registrarError(
        reporte,
        `producto "${producto.slug}"`,
        `categoría "${producto.categorySlug}" inexistente`,
      );
      continue;
    }

    await createProduct({
      name: producto.name,
      slug: producto.slug,
      description: producto.description,
      price: producto.price,
      imageUrl: buildImagenDeRelleno(imageSampleFor(index)),
      // null a propósito: el asset de relleno no es de la nube del negocio
      // y no hay nada que destruir al reemplazar la foto (Tarea 06).
      imagePublicId: null,
      categoryId,
      status,
      isFeatured: producto.isFeatured,
      isAvailable: true,
      allergens: prepararAlergenos(producto.allergens, producto.name, reporte),
      sortOrder: producto.sortOrder,
    });
    reporte.creados.push(`producto "${producto.slug}" [${status.toLowerCase()}]`);
  }
};

/**
 * Crea el usuario en `auth.users` y su fila en `staff_members`.
 *
 * ⛔ `SUPABASE_SERVICE_ROLE_KEY` bypasea RLS. Se usa acá y en ningún otro
 *    lado: este es un script local que corre una vez por ambiente.
 *
 * Se importa el cliente de forma DIFERIDA dentro de la función, no como
 * import estático del módulo: si la infra de Supabase no está configurada
 * (credenciales en placeholder, como en este sprint), se detecta antes y
 * el error del reporte explica qué configuación falta en lugar de
 * estallar con un fetch fallido de red.
 */
const sembrarAdministrador = async (reporte: Reporte): Promise<void> => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (
    supabaseUrl === undefined ||
    serviceKey === undefined ||
    supabaseUrl.includes("PENDIENTE") ||
    serviceKey === "PENDIENTE"
  ) {
    // Todavía no hay proyecto real de Supabase (Tarea 02 lo documentó).
    // No es un error del seed: se omite con aviso y se retoma cuando las
    // credenciales existan. El criterio §8.1 del admin en auth.users
    // + staff_members queda explícitamente bloqueado en §13.
    reporte.omitidos.push(
      "administrador (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en placeholder; " +
        "cuando exista el proyecto real, la próxima corrida lo crea)",
    );
    console.warn(
      "[seed] Supabase sin configurar (Aún en MODO LOCAL): se omite la creación del admin.",
    );
    return;
  }

  // El email se exige SOLO cuando realmente se puede crear el usuario:
  // si el seed pudiera seguir con un email de fábrica, en producción nadie
  // entraría al panel y la única salida sería editar Supabase a mano.
  const { email, password } = leerAdminDelEntorno();

  const { supabaseAdmin } = await import("../../src/server/infra/supabase/admin");

  const { data: creado, error: errorCreacion } = await supabaseAdmin.auth.admin.createUser({
    email,
    ...(password === null ? {} : { password }),
    // confirmado aunque no haya mail: el alta de identidad es manual
    // del encargado, no un registro público.
    email_confirm: true,
    user_metadata: { name: NEGOCIO_SEED.name },
  });

  let userId: string;

  if (creado.user !== null) {
    userId = creado.user.id;
    reporte.creados.push(`auth.users "${email}"`);
  } else {
    if (errorCreacion === null) {
      registrarError(reporte, "administrador", "no se pudo crear ni recuperar el usuario");
      return;
    }
    const existente = await buscarUsuarioPorEmail(supabaseAdmin, email);
    if (existente === null) {
      registrarError(reporte, "administrador", errorCreacion.message);
      return;
    }
    userId = existente;
    reporte.omitidos.push(`auth.users "${email}" (ya existía)`);
  }

  const yaRegistrado = await findStaffByEmail(email);
  if (yaRegistrado !== null) {
    reporte.omitidos.push(`staff_members "${email}" (ya existía)`);
    return;
  }

  await createStaffMember({ id: userId, email, name: null, role: "OWNER" });
  reporte.creados.push(`staff_members "${email}" (OWNER)`);
};

/**
 * `listUsers` pagina; con `perPage: 200` y 2 o 3 usuarios de un local
 * alcanza una sola página y el filtro por email no depende del orden.
 */
const buscarUsuarioPorEmail = async (
  supabaseAdmin: SupabaseClient,
  email: string,
): Promise<string | null> => {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  if (error !== null) return null;
  const usuario = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return usuario?.id ?? null;
};

/**
 * ⛔ Guarda de producción. Un `db:seed` con datos MOCK sobre la base real
 * pisa `business_settings` (incluido el número de WhatsApp) y publicaría
 * precios inventados si viniera `SEED_PUBLISH_MOCK`. La guarda es código,
 * no un recordatorio en una wiki.
 */
const verificarGuardas = (): void => {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env["SEED_ALLOW_IN_PRODUCTION"] !== "1") {
    throw new Error(
      "⛔ El seed está bloqueado en producción. Si realmente hay que correrlo, " +
        "exportá SEED_ALLOW_IN_PRODUCTION=1 y verificá el número de WhatsApp después.",
    );
  }
  console.warn("[seed] ⚠️ Corriendo el seed sobre PRODUCCIÓN con SEED_ALLOW_IN_PRODUCTION=1.");
};

export const ejecutarSeed = async (): Promise<void> => {
  verificarGuardas();

  const reporte = crearReporte();
  if (estadoDeProductos() === "DRAFT") {
    console.log(
      "[seed] SEED_PUBLISH_MOCK ausente: todos los productos nacen en DRAFT. Ninguno se muestra en el catálogo público.",
    );
  }
  console.log("[seed] Iniciando…");

  try {
    await sembrarConfiguracion(reporte);
  } catch (error) {
    registrarError(reporte, "business_settings", error);
  }

  let idsPorSlug = new Map<string, string>();

  try {
    idsPorSlug = await sembrarCategorias(reporte);
  } catch (error) {
    registrarError(reporte, "categorías", error);
  }

  if (idsPorSlug.size > 0) {
    try {
      await sembrarProductos(idsPorSlug, reporte);
    } catch (error) {
      registrarError(reporte, "productos", error);
    }
  }

  try {
    await sembrarAdministrador(reporte);
  } catch (error) {
    registrarError(reporte, "administrador", error);
  }

  console.log(`\n[seed] Creados: ${reporte.creados.length}`);
  for (const linea of reporte.creados) console.log(`  + ${linea}`);
  console.log(`[seed] Omitidos: ${reporte.omitidos.length}`);
  for (const linea of reporte.omitidos) console.log(`  = ${linea}`);

  if (reporte.errores.length > 0) {
    console.error(`[seed] Errores: ${reporte.errores.length}`);
    for (const linea of reporte.errores) console.error(`  ! ${linea}`);
    throw new Error("El seed terminó con errores. Revisá el log de arriba.");
  }

  console.log(
    "\n[seed] Listo. Si los datos son MOCK, reemplazalos antes de publicar (menú-maestro §0).",
  );
};
