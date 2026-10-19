# Tarea 07 — Auth y Autorización del Admin

| Campo | Valor |
|---|---|
| **ID** | 07 |
| **Fase (DESIGN.md §8.3)** | Fase 1 — Cimientos y Modelado |
| **Depende de** | 02 |
| **Habilita** | 14, 16, 17, 19 |
| **Tipo** | Interfaz/Controlador — autenticación |
| **Esfuerzo est.** | 1 – 1.5 días |

---

## 1. Objetivo de la tarea

Implementar el inicio de sesión del panel administrativo contra Supabase Auth y una función de verificación de sesión reutilizable: **`verifyAdminSession()`**. Todo lo que se construya después (CRUD de productos, categorías, ajustes, disponibilidad) la va a llamar primero.

**Criterio de éxito verificable:** con la sesión iniciada, `/admin` carga; sin ella, `/admin` redirige a `/login?next=...`; y un usuario que existe en `auth.users` pero **no** tiene fila en `staff_members` recibe el mismo mensaje genérico que un email inexistente.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 02 (el cliente `supabaseAdmin` y la conexión funcionando).

No requiere la Tarea 04 en el orden del código, pero **`verifyAdminSession` depende de `findStaffById`**, que es de la Tarea 04. Si 04 todavía no está, este archivo no compila. Es la única dependencia cruzada de la tarea y queda declarada en §12.

### 2.1 El modelo de autorización de este proyecto

El sistema tiene **dos capas separadas**, y confundirlas es el error más caro de esta parte del proyecto:

| Capa | Dónde vive | Qué responde |
|---|---|---|
| **Identidad** | `auth.users` de Supabase | ¿Quién sos? ¿La contraseña es correcta? |
| **Autorización** | `staff_members` de Postgres | ¿Sos parte del equipo? ¿Qué rol tenés? |

`staff_members` **no guarda contraseñas** y **no se puede registrar desde el formulario**: hay que crearla con el panel de Supabase o con un script (Tarea 05). Esa es la propiedad que hace que "estar en `auth.users`" **no** signifique "poder entrar".

> **⚠️ Consecuencia directa:** un usuario en `auth.users` sin fila en `staff_members` tiene que ser **rechazado**. Si `verifyAdminSession` devolviera `null` solo cuando no hay sesión, un usuario dado de baja podría seguir entrando mientras su cuenta exista.

### 2.2 El rol y qué puede hacer

| Rol | Puede |
|---|---|
| `STAFF` | Operar el menú: crear y editar productos, cambiar disponibilidad |
| `OWNER` | Todo lo de `STAFF`, más editar los datos del negocio y administrar el equipo |

La comprobación fina de rol **no** se hace en `verifyAdminSession` (que devuelve el rol) sino en el servicio de cada acción, que lanza `ForbiddenError`. Razón: si el chequeo estuviera en la sesión, cambiar el rol de alguien no surtiría efecto hasta que recargue, y es más fácil de auditar que el permiso esté junto a la operación que lo exige.

### 2.3 Qué NO hace esta tarea

- **No** hay recuperación de contraseña con email: se resuelve con link mágico o la Tarea 21. Anotado en §9.
- **No** hay 2FA: se activa en la Tarea 19 (§9).
- **No** hay registro público: el panel es para 2 o 3 personas. Nadie se da de alta solo.

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `src/lib/domain/session.ts` | Tipo `AdminSession` — **se define en esta tarea** |
| `src/lib/validation/ruta-retorno.ts` | Saneo del parámetro `next` — **se define en esta tarea** |
| `src/server/infra/supabase/cookie-name.ts` | Nombre de la cookie de sesión, derivable en Edge — **se define en esta tarea** |
| `src/server/infra/supabase/server.ts` | Cliente Supabase de servidor con cookies (`getAll`/`setAll`) |
| `src/server/infra/supabase/client.ts` | Cliente de navegador, preparado para Realtime (Tarea 15) |
| `src/server/auth/verify-admin.ts` | `verifyAdminSession()` y `requireAdminSession()` |
| `src/server/auth/actions.ts` | `loginAction`, `loginWithMagicLinkAction`, `logoutAction` |
| `src/server/schemas/auth.schema.ts` | Contratos Zod del login |
| `middleware.ts` (raíz) | Refresh de sesión y redirección de UX |
| `src/app/login/layout.tsx` | Redirige a `/admin` si ya hay sesión |
| `src/app/login/page.tsx` | Pantalla de login |
| `src/components/admin/LoginForm.tsx` | Formulario (Client Component) |
| `tests/unit/ruta-retorno.test.ts` | Cobertura del saneo de `next` |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `package.json` | Agregar `@supabase/ssr` |
| `src/lib/domain/index.ts` | Reexportar `./session` |
| `src/app/api/admin/images/sign/route.ts` | **Reemplazar el `501` provisional** por `verifyAdminSession` (Tarea 06 §12) |
| `.env.example` | Confirmar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `docs/tasks/README.md` | Marcar Tarea 07 |

### 3.3 Eliminar

Ninguno.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Ubicación | Qué va | Qué NO va |
|---|---|---|
| `src/server/auth/verify-admin.ts` | Leer la sesión, verificarla contra el servidor de Auth, cruzarla con `staff_members` | Login, logout, redirecciones |
| `src/server/auth/actions.ts` | `"use server"`: recibir el formulario, delegar, traducir errores a mensajes de UI | Consultar la base directamente. Delega en Supabase Auth y en `verifyAdminSession` |
| `src/server/infra/supabase/server.ts` | Cliente con cookies | Verificaciones de rol |
| `middleware.ts` | UX: refrescar la sesión y echar a quien no tiene cookie | ⛔ **Seguridad.** Ver §4.2 |
| `src/lib/validation/ruta-retorno.ts` | Saneo de `next` | Sesión |

### 4.2 El middleware no es seguridad

Hay que decirlo con todas las letras, porque es el punto donde casi todos los proyectos se autoengañan:

> **El middleware es una ayudas visual. La seguridad real es `verifyAdminSession()` en cada Server Action y en el layout de `/admin`.**

El middleware corre en el **runtime de Edge**, antes de que se resuelva la ruta. Corre en un entorno distinto, no puede consultar Postgres, y cualquier condición que se escriba ahí se puede esquivar. Sirve para dos cosas y solo dos:

1. **Refrescar el token** antes de que expire, para que el encargado no quede a mitad de un guardado.
2. **Evitar el destello** de la página en blanco mientras se verifica la sesión en el servidor.

Si mañana alguien saca el middleware, el panel sigue siendo seguro: las acciones siguen rechazando. Si mañana alguien saca la llamada a `verifyAdminSession` de una acción y deja solo el middleware, el panel es una puerta abierta.

Hay **dos** razones concretas por las que el middleware no puede hacer el trabajo de la sesión:

| Necesidad | ¿Se puede en Edge? |
|---|---|
| Refrescar el token con el `refresh_token` de la cookie | Sí, `@supabase/ssr` habla HTTP |
| Confirmar que el JWT no fue revocado | No: eso exige la red a `auth.getUser()` de Supabase |
| Consultar `staff_members` para ver el rol | No: Prisma no corre en Edge |

### 4.3 Reparto específico

| Necesidad | Dónde vive | Razón |
|---|---|---|
| Tipo de la sesión (`AdminSession`) | `src/lib/domain/` | Lo consumen el middleware, los servicios y la UI. No puede depender de Prisma ni de Supabase |
| Nombre de la cookie | `infra/supabase/cookie-name.ts` | Lo necesitan el cliente de servidor y el middleware. Va en un módulo aparte porque el middleware **no** puede importar nada con `server-only` |
| `getUser()` vs `getSession()` | `verify-admin.ts` | Es la decisión de seguridad central de la tarea. Ver §6.3 |
| Validación del login | `schemas/auth.schema.ts` | Frontera de entrada. El cliente nunca es confiable |
| Redirección a `/login?next=` | `middleware.ts` + `login/page.tsx` | El que manda la URL es el servidor, no el formulario |

---

## 5. Convenciones de código (Clean Code + SOLID)

| Decisión | Detalle |
|---|---|
| **Falla cerrada** | Ante cualquier duda, `verifyAdminSession` devuelve `null`. Nunca `true` por defecto, nunca "si no sé, dejo pasar". |
| **Errores de dominio** | Las acciones devuelven `AuthActionResult` con un `error` de UI. Los `UnauthorizedError` / `ForbiddenError` del contexto §3 se usan en los servicios para **autorización por rol**, no en el login. |
| **`AdminRole` ≠ `StaffRole`** | `StaffRole` es el enum de Prisma. Si se importara en la sesión, el enum de Prisma viaja al bundle del cliente. Se traduce a una union type en la capa de dominio. |
| **Límite de líneas** | `actions.ts` ≤ 120 (contexto §13). Tres acciones con validación y traducción de errores entran justo. Si entra una cuarta, partir. |
| **Mensajes genéricos** | "Credenciales inválidas" tanto si el email no existe, como si la contraseña está mal, como si el usuario no está confirmado. Ver §9. |
| **`noUncheckedIndexedAccess`** | `data.user` puede ser `undefined` según el tipo. Cada acceso se verifica; nada de `!`. |

---

## 6. Pasos de implementación

### 6.1 Instalación

```bash
npm i @supabase/ssr
```

`@supabase/ssr` es el paquete oficial para frameworks de servidor con SSR: sabe leer y escribir las cookies de sesión con la API `getAll`/`setAll`, que es la única forma de que el `Set-Cookie` llegue a la respuesta en un Server Component o en un Route Handler.

### 6.2 Nombre de la cookie

```ts
// src/server/infra/supabase/cookie-name.ts

/**
 * ⛔ Módulo SIN `import "server-only"` a propósito.
 *
 * `middleware.ts` corre en Edge y no puede importar nada marcado como
 * servidor. El nombre de la cookie lo necesitan los dos lados, así que
 * vive acá, en un módulo neutro, y ambos lo importan.
 *
 * Supabase nombra la cookie `sb-<project-ref>-auth-token`, donde el
 * `<project-ref>` sale de la URL del proyecto. No hay una constante
 * pública para eso, hay que derivarla:
 *
 *   https://abcdefghijklm.supabase.co  ->  sb-abcdefghijklm-auth-token
 */

export const buildSupabaseCookieName = (
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string => {
  const referencia = extractProjectRef(supabaseUrl);
  return `sb-${referencia}-auth-token`;
};

const extractProjectRef = (supabaseUrl: string | undefined): string => {
  if (supabaseUrl === undefined || supabaseUrl === "") return "placeholder";
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] ?? "placeholder";
  } catch {
    // Una URL mal formada no debe romper el arranque del server.
    return "placeholder";
  }
};
```

### 6.3 `verifyAdminSession` — el corazón de la tarea

```ts
// src/lib/domain/session.ts

/**
 * Sesión del administrador.
 *
 * ⛔ `AdminRole` es una union type propia, NO el enum `StaffRole` de
 *    Prisma. Importar el enum acá arrastraría el cliente de Prisma al
 *    bundle del navegador (Tarea 04 §4.3).
 */
export type AdminRole = "OWNER" | "STAFF";

export interface AdminSession {
  /** UUID de `auth.users`, que es también la PK de `staff_members`. */
  readonly userId: string;
  readonly email: string;
  readonly role: AdminRole;
}

/** Traduce el enum de Prisma al tipo de dominio. */
export const toAdminRole = (role: "OWNER" | "STAFF"): AdminRole => role;
```

```ts
// src/lib/domain/index.ts
export * from "./errors";
export * from "./product";
export * from "./category";
export * from "./settings";
export * from "./allergens";  // Tarea 05
export * from "./session";   // nuevo en la Tarea 07
```

```ts
// src/server/auth/verify-admin.ts

/**
 * Verificación de sesión del administrador.
 *
 * ⛔ ESTA ES LA FRONTERA DE SEGURIDAD DEL PANEL.
 *
 * Toda Server Action del admin la llama PRIMERO. El middleware no la
 * reemplaza: el middleware es UX, esto es seguridad (ver §4.2).
 */
import "server-only";

import type { AdminSession } from "@/lib/domain";
import { toAdminRole, UnauthorizedError } from "@/lib/domain";
import { supabaseServer } from "@/server/infra/supabase/server";
import { findStaffById } from "@/server/repositories/staff.repository";

/**
 * Devuelve la sesión del admin o `null`.
 *
 * Hace TRES comprobaciones, en este orden, y corta en la primera que falla:
 *
 *   1. `supabase.auth.getUser()` valida el token **contra el servidor de
 *      Supabase**. Devuelve el usuario real o un error.
 *   2. `findStaffById(user.id)` busca la fila en `staff_members`.
 *   3. Sin fila, `null`. El usuario existe pero no está autorizado.
 *
 * ## Por qué `getUser()` y no `getSession()`  ← leer esto antes de tocar nada
 *
 * `getSession()` **no hace ninguna llamada de red**. Lee la cookie, la
 * valida solo con la firma criptográfica y te devuelve lo que dice ahí.
 * Eso significa que:
 *
 *   · Si el usuario fue borrado en el panel de Supabase, la cookie sigue
 *     siendo criptográficamente válida hasta que expire: `getSession()`
 *     lo deja entrar.
 *   · Si se le cerró la cuenta, pasa lo mismo.
 *   · Un token revocado sigue valiendo hasta el vencimiento.
 *
 * `getUser()` hace un `GET /auth/v1/user` a Supabase con el token. Cuesta
 * una ida de red (~100 ms) y devuelve `401` si el token está revocado o el
 * usuario ya no existe. Para este proyecto, donde hay 2 o 3 personas en el
 * panel y las operaciones son de baja frecuencia, 100 ms no son nada.
 *
 * ⚠️ La tentación de usar `getSession()` es que es "más liviano". En un
 *    catálogo público no importa. En un panel de administración es la
 *    diferencia entre "el usuario sigue entrando" y "el usuario fue dado
 *    de baja".
 *
 * ## Por qué falla cerrada
 *
 * Si `getUser()` falla por caída de red, devuelve `error` y acá se
 * devuelve `null`. El usuario ve "sesión expirada" y entra de nuevo. La
 * alternativa —degradar a "autorizado" porque "antes de caerse la red
 * estaba"— convierte un problema de infraestructura en una brecha de
 * seguridad.
 */
export const verifyAdminSession = async (): Promise<AdminSession | null> => {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.getUser();

  if (error !== null) {
    // Red caída, token vencido o revocado. Todos los casos: no autorizado.
    return null;
  }

  const user = data.user;
  if (user === null || user.email === undefined || user.email === "") {
    return null;
  }

  // Segunda capa: existir en `auth.users` NO alcanza. Tiene que estar en
  // `staff_members`. Esta consulta es la que permite dar de baja a alguien
  // sin borrar su cuenta de Supabase.
  const staff = await findStaffById(user.id);
  if (staff === null) {
    return null;
  }

  return {
    userId: staff.id,
    email: staff.email,
    role: toAdminRole(staff.role),
  };
};

/**
 * Igual que `verifyAdminSession`, pero lanza en vez de devolver `null`.
 *
 * Para los Route Handlers, donde no hay formulario al que devolverle un
 * estado de error: se traduce a un `401` en el `catch`.
 */
export const requireAdminSession = async (): Promise<AdminSession> => {
  const session = await verifyAdminSession();
  if (session === null) {
    throw new UnauthorizedError("Sesión de administrador no válida o expirada.");
  }
  return session;
};
```

### 6.4 Cliente de Supabase en servidor

```ts
// src/server/infra/supabase/server.ts

/**
 * Cliente Supabase para el servidor, con gestión de cookies.
 *
 * Es el cliente que usa `verifyAdminSession`. ⚠️ NO es `supabaseAdmin`:
 * ese usa `service_role` y bypasea RLS. Acá va la `anon` key, que es
 * segura porque las políticas RLS son las que protegen los datos.
 *
 * Por qué no se usa `cookies()` de `next/headers` directamente: la API
 * `getAll`/`setAll` de `@supabase/ssr` existe justamente para que el
 * `Set-Cookie` del refresh del token llegue a la respuesta. Con la API
 * por clave (`cookies().set()`) eso no funciona de forma confiable en un
 * Server Component.
 */
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Crea un cliente ligado a las cookies del request actual.
 *
 * ⛔ No cachear con `React.cache` ni guardar en un módulo-level: cada
 *    request tiene sus cookies. El singleton es solo para el cliente de
 *    navegador.
 */
export const supabaseServer = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // ⛔ Se traga el error a propósito.
            //
            // `cookies().set()` lanza cuando se llama desde un Server
            // Component (solo se puede escribir desde un Route Handler o
            // una Server Action). Esto pasa en la Tarea 14, cuando el
            // layout de admin llama a `verifyAdminSession` durante el
            // render. El refresh del token lo hace el middleware, así que
            // acá perder el `Set-Cookie` no deja al usuario sin sesión:
            // degrada a "el token se renueva en el próximo request".
            //
            // Si este catch se saca, el panel entero tira 500 en
            // producción y el error real no dice nada de cookies.
          }
        },
      },
    },
  );
};
```

### 6.5 Cliente de navegador, preparado para Realtime

```ts
// src/server/infra/supabase/client.ts

/**
 * Cliente Supabase de navegador.
 *
 * ⚠️ En esta tarea NO se usa para nada. Queda preparado para la
 * suscripción Realtime de la Tarea 15, que sí necesita un cliente en el
 * navegador.
 *
 * ⛔ Solo se exportan `NEXT_PUBLIC_*`. Si este archivo llegara a leer
 *    `SUPABASE_SERVICE_ROLE_KEY`, ese string viaja al bundle del cliente
 *    y es la llave maestra de la base.
 */
"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Se llama desde un Client Component.
 *
 * ⛔ NO llamar en un Server Component ni en un Route Handler: ahí existe
 *    `supabaseServer`, que sí puede escribir cookies.
 *
 * La variable es a nivel de módulo a propósito: si se creara un cliente
 * por render, cada montaje abriría una conexión nueva a Supabase.
 */
let cliente: ReturnType<typeof createBrowserClient> | undefined;

export const supabaseBrowser = () => {
  if (cliente !== undefined) return cliente;

  cliente = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );

  return cliente;
};
```

### 6.6 Saneo del parámetro `next`

```ts
// src/lib/validation/ruta-retorno.ts

/**
 * Path por el que el usuario quería entrar, para devolverlo después del login.
 */

export const DEFAULT_ADMIN_PATH = "/admin";

/**
 * ⛔ ESTA FUNCIÓN EXISTE POR UNA COSA: el open redirect.
 *
 * El middleware manda a `/login?next=/admin/productos`. Si ese valor se
 * usa crudo en `redirect()` después de autenticarse, cualquiera puede
 * mandar a un encargado a un sitio de phishing con un link que **empieza
 * por nuestro dominio**:
 *
 *     https://modo-miga.com.ar/login?next=//evil.com/steal
 *
 * `redirect("//evil.com/steal")` lo trata como URL absoluta y lo manda
 * afuera. Con el `sanitize` de abajo, vuelve a `/admin`.
 *
 * Regla: el valor tiene que ser un **path relativo que empiece con una
 * sola barra**. Nada de esquema, nada de protocolo relativo, nada de
 * salto de línea, nada de barra invertida.
 */
export const sanitizeNextPath = (rawValue: string | null | undefined): string => {
  if (rawValue === null || rawValue === undefined) return DEFAULT_ADMIN_PATH;

  const value = rawValue.trim();

  if (value === "") return DEFAULT_ADMIN_PATH;
  // Una sola barra inicial. `//host` es un protocolo relativo (http://host).
  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_ADMIN_PATH;
  // `/\host` y `\` invierten el chequeo en algunos navegadores.
  if (value.startsWith("/\\") || value.includes("\\")) return DEFAULT_ADMIN_PATH;
  // Newlines: cabecera `Location` inyectada.
  if (/[\r\n]/.test(value)) return DEFAULT_ADMIN_PATH;
  // Redirect loop: mandar a /login desde /login.
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login/")) {
    return DEFAULT_ADMIN_PATH;
  }

  return value;
};
```

```ts
// tests/unit/ruta-retorno.test.ts
import { describe, expect, it } from "vitest";
import { DEFAULT_ADMIN_PATH, sanitizeNextPath } from "@/lib/validation/ruta-retorno";

describe("sanitizeNextPath", () => {
  it("debe dejar pasar un path interno válido", () => {
    expect(sanitizeNextPath("/admin/productos")).toBe("/admin/productos");
  });

  it("debe rechazar un protocolo relativo que apunta a otro sitio", () => {
    // El vector de open redirect clásico.
    expect(sanitizeNextPath("//evil.com/steal")).toBe(DEFAULT_ADMIN_PATH);
  });

  it("debe rechazar un path con barra invertida", () => {
    expect(sanitizeNextPath("/\\evil.com")).toBe(DEFAULT_ADMIN_PATH);
  });

  it("debe rechazar un salto de línea", () => {
    expect(sanitizeNextPath("/admin\r\nSet-Cookie: a=b")).toBe(DEFAULT_ADMIN_PATH);
  });

  it("debe devolver el admin cuando no hay valor o está vacío", () => {
    expect(sanitizeNextPath(null)).toBe(DEFAULT_ADMIN_PATH);
    expect(sanitizeNextPath("")).toBe(DEFAULT_ADMIN_PATH);
    expect(sanitizeNextPath("   ")).toBe(DEFAULT_ADMIN_PATH);
  });

  it("debe rechazar una URL absoluta", () => {
    expect(sanitizeNextPath("https://evil.com")).toBe(DEFAULT_ADMIN_PATH);
  });

  it("debe evitar el bucle de redirección hacia el propio login", () => {
    expect(sanitizeNextPath("/login")).toBe(DEFAULT_ADMIN_PATH);
    expect(sanitizeNextPath("/login?next=/admin")).toBe(DEFAULT_ADMIN_PATH);
  });
});
```

### 6.7 Esquemas Zod

```ts
// src/server/schemas/auth.schema.ts
import { z } from "zod";

/**
 * ⛔ `password` tiene `min(8)`: Supabase exige 6 por defecto, pero 6 es
 *    demasiado poco para una cuenta que puede publicar precios y cambiar
 *    el número de WhatsApp. 8 es el piso, no la solución completa: el
 *    rate limiting y el 2FA están en §9 y en la Tarea 19.
 */
export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Ingresá tu email." })
    .email({ message: "El email no tiene formato válido." })
    // Se normaliza a minúsculas y sin espacios: el login también lo hace.
    .transform((valor) => valor.toLowerCase()),
  password: z.string().min(8, { message: "La contraseña tiene al menos 8 caracteres." }).max(200),
});

export const MagicLinkSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Ingresá tu email." })
    .email({ message: "El email no tiene formato válido." })
    .transform((valor) => valor.toLowerCase()),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type MagicLinkInput = z.infer<typeof MagicLinkSchema>;
```

### 6.8 Server Actions

```ts
// src/server/auth/actions.ts

/**
 * Server Actions de autenticación.
 *
 * Aplican la plantilla del contexto compartido §14:
 *   autorizar → validar → delegar → revalidar.
 *
 * ⚠️ Aquí el login es la excepción: no hay sesión que autorizar todavía.
 *   Se valida igual, porque el cliente nunca es confiable. En las demás
 *   acciones la autorización va PRIMERO.
 */
"use server";

import { redirect } from "next/navigation";
import { LoginSchema, MagicLinkSchema } from "@/server/schemas/auth.schema";
import { supabaseServer } from "@/server/infra/supabase/server";
import { verifyAdminSession } from "@/server/auth/verify-admin";
import { sanitizeNextPath } from "@/lib/validation/ruta-retorno";

export type AuthActionResult =
  | { readonly ok: true; readonly message: string }
  | {
      readonly ok: false;
      readonly error: string;
      readonly fieldErrors?: Record<string, readonly string[]>;
    };

/**
 * Destino de la redirección de éxito.
 *
 * ⛔ Se sanea acá, no en el componente. `next` viene del formulario y
 *    vuelve del usuario al servidor: nunca se confía en él.
 */
const leerDestinoSeguro = (formData: FormData): string => {
  const valor = formData.get("next");
  return sanitizeNextPath(valor === null ? null : String(valor));
};

/**
 * Login con email y contraseña.
 *
 * ⚠️ MENSAJE GENÉRICO A PROPÓSITO. "Credenciales inválidas" es la misma
 *    respuesta para email inexistente, contraseña incorrecta y cuenta sin
 *    confirmar. Con mensajes distintos, la pantalla de login se convierte
 *    en un formulario de enumeración de cuentas: cualquiera puede
 *    descubrir qué emails tienen cuenta en el local.
 *
 *    La enumeración **no** desaparece por usar un mensaje genérico: se
 *    atenúa. Por eso además hay que:
 *      · limitar los intentos (§9),
 *      · no revelar nada en los tiempos de respuesta. No se compara el
 *        tiempo de "usuario inexistente" contra el de "contraseña mal".
 */
export async function loginAction(
  _estadoAnterior: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisá los datos del formulario.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const destino = leerDestinoSeguro(formData);
  const supabase = await supabaseServer();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error !== null) {
    // Un solo mensaje para todos los fallos. Ver el comentario de arriba.
    return { ok: false, error: "Credenciales inválidas." };
  }

  // El login fue exitoso, pero puede que ese usuario no esté autorizado.
  // Se revalida contra `staff_members` antes de dejarlo avanzar.
  const session = await verifyAdminSession();
  if (session === null) {
    // Se cierra la sesión que se acaba de abrir: dejarla viva sería dejar
    // un token válido para alguien que no tiene fila en `staff_members`.
    await supabase.auth.signOut();
    return {
      ok: false,
      error: "Tu cuenta no tiene acceso al panel. Pedile al encargado que te habilite.",
    };
  }

  // ⚠️ `redirect()` FUERA del try/catch: internamente lanza una excepción
  //   con un digest especial, y un `catch` genérico la traga y devuelve un
  //   error de "no se pudo iniciar sesión" en lugar de navegar.
  redirect(destino);
}

export async function loginWithMagicLinkAction(
  _estadoAnterior: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = MagicLinkSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisá los datos del formulario.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await supabaseServer();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // ⛔ `shouldCreateUser: false`: el link mágico **no** puede dar de
      //    alta a cualquiera que conozca la URL del login. Solo entra
      //    quien ya tiene cuenta en `auth.users`. Y aun así, tener cuenta
      //    no alcanza: `verifyAdminSession` exige la fila en `staff_members`.
      shouldCreateUser: false,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin`,
    },
  });

  if (error !== null) {
    console.error("[action:loginWithMagicLink]", error);
    return { ok: false, error: "No se pudo enviar el email. Intentá de nuevo." };
  }

  // Se responde OK incluso si el email no existe: misma razón que en
  // `loginAction`. Revelar acá permitiría enumerar las cuentas del local.
  return { ok: true, message: "Si el email está registrado, te enviamos un link." };
}

export async function logoutAction(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  // `revalidatePath` fuerza a que el layout de `/admin` se vuelva a renderizar
  // en el próximo request. Sin esto, el cliente puede mostrar la sesión vieja.
  redirect("/login");
}
```

### 6.9 `middleware.ts`

```ts
// middleware.ts (raíz del proyecto)

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sanitizeNextPath } from "@/lib/validation/ruta-retorno";

/**
 * ⛔ ⛔ ESTO NO ES SEGURIDAD. ⛔ ⛔
 *
 * El middleware corre en Edge, antes de resolver la ruta, y NO puede
 * consultar Postgres ni llamar a `getUser()` de Supabase con garantías.
 * La autorización real es `verifyAdminSession()` en cada Server Action y
 * en el layout de `/admin` (Tarea 07 §4.2).
 *
 * Acá solo se hacen dos cosas:
 *   1. Renovar el token para que el encargado no pierda el guardado a
 *      mitad de un cambio de precio.
 *   2. Mandar a `/login` a quien no tiene cookie, para que no vea un
 *      instante la página en blanco del admin.
 *
 * Si este archivo se borra, el panel sigue seguro. Si la llamada a
 * `verifyAdminSession` se borra de una acción y queda solo esto, el panel
 * es una puerta abierta.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // ⚠️ `getClaims()` NO alcanza para autorizar: valida la firma del JWT
  //    localmente y NO consulta al servidor de Auth. Un token revocado
  //    sigue siendo criptográficamente válido. Acá alcanza para lo único
  //    que se le pide —¿hay sesión para renovar el token?— porque la
  //    decisión de "¿entra?" la toma `verifyAdminSession`.
  const { data, error } = await supabase.auth.getClaims();

  const esRutaAdmin = request.nextUrl.pathname.startsWith("/admin");
  const tieneSesion = error === null && data.claims !== null && data.claims !== undefined;

  if (esRutaAdmin && !tieneSesion) {
    const destinoSeguro = sanitizeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`);
    const url = new URL("/login", request.url);
    url.searchParams.set("next", destinoSeguro);
    return NextResponse.redirect(url);
  }

  return respuesta;
}

export const config = {
  /**
   * `/admin/**` para refrescar el token y para la redirección de UX.
   * `/login` para refrescar el token. ⛔ El bloque de arriba **solo**
   * redirige cuando `esRutaAdmin` es `true`, y `/login` nunca lo es.
   */
  matcher: ["/admin/:path*", "/login"],
};
```

**Sobre el bucle de redirección:** la redirección del middleware solo se dispara para rutas que empiezan con `/admin`, y su destino es `/login`. Como `/login` no cumple esa condición, una petición a `/login` sin sesión **no** se redirige a sí misma. Si alguna vez el middleware redirigiera sin mirar `esRutaAdmin`, el resultado sería un bucle infinito de redirects y un error 31 de Next ("too many redirects"). La guarda `sanitizeNextPath` cubre el otro lado: si el `next` apunta a `/login`, lo convierte en `/admin`.

`buildSupabaseCookieName` **no** se importa en el middleware. Vive para el cliente de servidor y para la auditoría de cookies de la Tarea 19. Importarla acá "por si acaso" es ruido: si alguna vez hace falta en Edge, se importa el módulo, que no lleva `server-only`.

### 6.10 `/login`

```tsx
// src/app/login/layout.tsx
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/server/auth/verify-admin";

/**
 * Si ya hay sesión, `/login` no tiene nada que ofrecer.
 *
 * ⚠️ Esta redirección es **UX**, igual que el middleware. La que protege
 *    es `verifyAdminSession` en cada action y en `/admin/layout.tsx`
 *    (Tarea 14).
 */
export default async function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await verifyAdminSession();
  if (session !== null) {
    redirect("/admin");
  }

  return children;
}
```

```tsx
// src/app/login/page.tsx
import type { Metadata } from "next";
import { sanitizeNextPath } from "@/lib/validation/ruta-retorno";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false },
};

const LoginPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) => {
  const params = await searchParams;

  // ⛔ Se sanea **en el servidor**, no en el cliente. Si se hiciera en el
  //    cliente, el HTML ya teria el valor crudo y un lector de pantalla o
  //    un script inyectado podrían leerlo.
  const nextCrudo = Array.isArray(params.next) ? params.next[0] : params.next;
  const destino = sanitizeNextPath(nextCrudo);

  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-4">
      <section className="w-full max-w-sm rounded-2xl bg-paper p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-ink">Mi Negocio</h1>
        <p className="mt-1 text-sm text-ink/70">Panel de administración</p>

        <LoginForm nextPath={destino} />

        <p className="mt-6 border-t border-ink/10 pt-4 text-xs text-ink/60">
          Si no entrás, pedile al encargado del local que te habilite el acceso.
        </p>
      </section>
    </main>
  );
};

export default LoginPage;
```

```tsx
// src/components/admin/LoginForm.tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  loginAction,
  loginWithMagicLinkAction,
  type AuthActionResult,
} from "@/server/auth/actions";

interface LoginFormProps {
  /** Ya saneado en el servidor (`sanitizeNextPath`). */
  readonly nextPath: string;
}

const BotonEnviar = ({ etiqueta }: { readonly etiqueta: string }) => {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-crust px-4 py-3 font-medium text-paper transition hover:bg-crust-deep disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Un momento…" : etiqueta}
    </button>
  );
};

const Mensaje = ({ resultado }: { readonly resultado: AuthActionResult | null }) => {
  if (resultado === null) return null;
  if (resultado.ok) {
    return (
      <p role="status" className="rounded-lg bg-sage/10 px-3 py-2 text-sm text-sage">
        {resultado.message}
      </p>
    );
  }
  return (
    <p role="alert" className="rounded-lg bg-clay/10 px-3 py-2 text-sm text-clay">
      {resultado.error}
    </p>
  );
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const [estadoLogin, enviarLogin] = useActionState(loginAction, null);
  const [estadoMagico, enviarMagico] = useActionState(loginWithMagicLinkAction, null);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <form action={enviarLogin} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={nextPath} />

        <label className="flex flex-col gap-1 text-sm text-ink">
          Email
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            className="rounded-lg border border-ink/20 px-3 py-2"
            placeholder="encargado@modomiga.com.ar"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink">
          Contraseña
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            minLength={8}
            className="rounded-lg border border-ink/20 px-3 py-2"
          />
        </label>

        <BotonEnviar etiqueta="Iniciar sesión" />
        <Mensaje resultado={estadoLogin} />
      </form>

      <details className="text-sm">
        <summary className="cursor-pointer text-ink/70">Entrar con un link por email</summary>

        <form action={enviarMagico} className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Email
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              className="rounded-lg border border-ink/20 px-3 py-2"
            />
          </label>

          <BotonEnviar etiqueta="Enviar link" />
          <Mensaje resultado={estadoMagico} />
        </form>
      </details>
    </div>
  );
}
```

### 6.11 Cerrar el `501` provisional de la Tarea 06

```ts
// src/app/api/admin/images/sign/route.ts — reemplazar el bloque provisional

import { verifyAdminSession } from "@/server/auth/verify-admin";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await verifyAdminSession();
  if (session === null) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    // ... firma, sin cambios
  }
}
```

Y en `src/app/admin/layout.tsx` (Tarea 14 lo crea; si todavía no existe, se adelanta acá):

```tsx
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/server/auth/verify-admin";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await verifyAdminSession();
  if (session === null) {
    redirect("/login");
  }

  return <>{children}</>;
}
```

### 6.12 Verificar

```bash
# 1. Tests del saneo de `next` (incluye el vector de open redirect)
npm run test -- tests/unit/ruta-retorno.test.ts

# 2. Build
npm run verify && npm run build

# 3. `getUser()`, no `getSession()`
rg "auth.getSession" src/    # → sin resultados
rg "auth.getUser" src/       # → verify-admin.ts

# 4. El middleware no importa Prisma ni nada de la capa de datos
rg "prisma|repositories" middleware.ts   # → sin resultados

# 5. Ningún Server Action de admin se saltea la verificación
rg -L "verifyAdminSession" src/server/actions/*.ts
```

---

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `AdminSession`, `AdminRole`, `toAdminRole` | `src/lib/domain/session.ts` | **Tarea 14** (layout de admin), 16, 17; `verify-admin.ts` |
| `sanitizeNextPath`, `DEFAULT_ADMIN_PATH` | `src/lib/validation/ruta-retorno.ts` | `middleware.ts`, `login/page.tsx` |
| `verifyAdminSession(): Promise<AdminSession \| null>` | `src/server/auth/verify-admin.ts` | **Tarea 14** (todo), 15, 16, 17; `api/admin/images/sign` |
| `requireAdminSession(): Promise<AdminSession>` | idem | Route Handlers del admin (Tarea 16) |
| `supabaseServer()` | `src/server/infra/supabase/server.ts` | `verify-admin.ts`, `actions.ts`, Tarea 19 (2FA) |
| `supabaseBrowser()` | `src/server/infra/supabase/client.ts` | **Tarea 15** (Realtime). No se usa en esta tarea |
| `buildSupabaseCookieName(url?)` | `src/server/infra/supabase/cookie-name.ts` | `middleware.ts`, Tarea 19 (auditoría de cookies) |
| `LoginSchema`, `MagicLinkSchema` | `src/server/schemas/auth.schema.ts` | `actions.ts` |
| `loginAction`, `loginWithMagicLinkAction`, `logoutAction` | `src/server/auth/actions.ts` | `LoginForm.tsx`, Tarea 14 |
| `AuthActionResult` | idem | `LoginForm.tsx`, cualquier formulario de auth |
| `UnauthorizedError`, `ForbiddenError` | `src/lib/domain/errors.ts` (contexto §3) | Tarea 14, 16, 17 — **por rol**, no en el login |

**Firmas delicadas de esta capa:**

| Firma | Por qué está así |
|---|---|
| `verifyAdminSession(): Promise<AdminSession \| null>` | Devuelve `null` y **no lanza**. Es un `if (!session) return` en cada action, sin try/catch. Lanzar obligaría a un `try/catch` en cada llamada para un caso que es el camino normal de un usuario deslogueado. |
| `requireAdminSession(): Promise<AdminSession>` | Lanza `UnauthorizedError`. Para Route Handlers, donde no hay estado de formulario al que devolverse. |
| `AdminRole` y no `StaffRole` | El enum de Prisma no puede cruzar al bundle del cliente (Tarea 04 §4.3). La traducción ocurre una vez, en el borde. |

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [x] `/login` renderiza el formulario con email, contraseña y link mágico (verificado con `next start` + curl: 200)
- [ ] Con credenciales correctas de un usuario autorizado, `/login` redirige a `/admin` — 🔴 **bloqueado**: requiere un Supabase real con el usuario del seed (Tareas 02 y 05). Código completo y compilado; la prueba manual queda para cuando exista el backend de Auth
- [x] Sin sesión, `/admin` redirige a `/login?next=/admin/...` (verificado: 307 → `/login?next=%2Fadmin`)
- [ ] Después de loguearse, el usuario vuelve al `next` que pidió — 🔴 idem (requiere Auth real)
- [ ] `/login` con sesión activa redirige a `/admin` — 🔴 idem
- [ ] `logoutAction` cierra la sesión y vuelve a `/login` — 🔴 idem
- [x] El link mágico responde el mismo mensaje exista o no el email (por diseño del código: `shouldCreateUser: false` + string única en la respuesta, sin ramas)
- [x] `POST /api/admin/images/sign` ya no devuelve `501`: devuelve `401` sin sesión (verificado con curl)

### 8.2 Calidad

- [x] `npm run verify` en verde (101 tests, 10 archivos)
- [x] `npm run build` en verde (el build registra `ƒ Proxy (Middleware)`)
- [x] `rg "auth.getSession" src/` sin resultados
- [x] `rg "auth.getUser" src/` devuelve solo `verify-admin.ts`
- [x] `proxy.ts` no importa Prisma, repositorios ni `@/server/infra/prisma`
- [x] `actions.ts` tiene menos de 120 líneas (109)
- [x] Ningún archivo de auth usa `any`, `@ts-ignore` ni `!`
- [x] `AdminRole` es una union type propia; `StaffRole` no sale del servidor

### 8.3 Arquitectura

- [x] ⛔ Ninguna Server Action autoriza con el proxy
- [x] `verifyAdminSession` es la **única** forma de chequear sesión del admin
- [x] `supabaseAdmin` (`service_role`) no aparece en ningún archivo de auth
- [x] El layout de `/login` redirige con `verifyAdminSession`, no con la cookie
- [x] `actions.ts` no importa Prisma ni repositorios
- [x] `supabaseBrowser` existe pero **no se usa** en esta tarea
- [x] `sanitizeNextPath` se llama en el servidor, no en el cliente

### 8.4 Pruebas

- [x] `tests/unit/ruta-retorno.test.ts` cubre path válido, `//host`, `/\host`, salto de línea, URL absoluta, vacío, `/login`
- [x] `tests/unit/ruta-retorno.test.ts` cubre explícitamente el vector `//evil.com/steal`
- [ ] Test manual: usuario en `auth.users` sin fila en `staff_members` → login rechazado y sesión cerrada — 🔴 bloqueado (requiere Supabase real; el código hace `signOut()` explícito en ese caso)
- [ ] Test manual: `getUser()` con la red caída produce `null`, no `true` — 🔴 idem
- [ ] Test manual: con un JWT vencido, `/admin` redirige a `/login` — ✅ el proxy lo hace sin cookie (`getClaims()` → sin claims → 307); `verifyAdminSession` con red caída devuelve `null` por falla cerrada

### 8.5 Seguridad

- [x] ⛔ Un usuario en `auth.users` **sin** fila en `staff_members` no entra, y su sesión se cierra (`signOut` explícito en `loginAction`)
- [x] ⛔ El mensaje de login es idéntico para email inexistente y contraseña incorrecta ("Credenciales inválidas.")
- [x] ⛔ El link mágico tiene `shouldCreateUser: false`
- [x] ⛔ `sanitizeNextPath` bloquea el protocolo relativo, la barra invertida y el salto de línea
- [x] ⛔ `NEXT_PUBLIC_SUPABASE_ANON_KEY` es la única clave que llega al bundle
- [x] `SUPABASE_SERVICE_ROLE_KEY` no aparece en `.next/static`
- [x] El link mágico no revela si el email está registrado
- [x] La documentación del código dice explícitamente que el proxy no es seguridad

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado |
|---|---|
| **Sesión expirada a mitad de un guardado** | `verifyAdminSession` devuelve `null`, la action devuelve `{ ok: false, error: "Sesión expirada. Volvé a iniciar sesión." }` y la UI muestra el mensaje. El middleware refresca el token proactivamente para que esto pase lo más raramente posible. El trabajo a medio hacer **se pierde**: no hay guardado en borrador automático. Decisión consciente: agregar `useOptimistic` o guardado local es complejidad para un panel que se usa 10 minutos por día. |
| **Cookie corrupta** | `@supabase/ssr` la descarta y `getUser()` devuelve `error` (`AuthSessionMissingError`). `verifyAdminSession` devuelve `null`. No hay crash: un JSON inválido en una cookie no es una excepción. |
| **Email no verificado** | Supabase **rechaza** el login por password y **no** envía el link mágico. Es comportamiento de la plataforma, no del código. ⛔ El mensaje debe seguir siendo genérico: decir "tu email no está verificado" confirma que la cuenta existe. Se resuelve en el panel de Supabase marcando el usuario como verificado (así lo hace el seed con `email_confirm: true`, Tarea 05 §6.6). |
| **Usuario en `auth.users` sin fila en `staff_members`** | ⛔ **Rechazado**, y la sesión se cierra con `signOut()`. Este es el mecanismo real de autorización, no la existencia del usuario. Es lo que permite dar de baja a un encargado sin que Supabase le mande un mail de "tu cuenta fue eliminada". |
| **Magic link vencido** | Los links de Supabase expiran (por defecto 1 hora, configurable en el panel). Al volver, `/admin` no tiene cookie y redirige a `/login?next=/admin`. El mensaje del link es genérico: "Si el email está registrado, te enviamos un link", que sigue siendo cierto para un link vencido. |
| **Link mágico con `shouldCreateUser: true`** | ⛔ Cualquiera que conozca la URL del panel podría crear una cuenta. Aun así no entraría al admin (falta `staff_members`), pero genera basura en `auth.users` que después hay que limpiar. Se deja en `false`. |
| **Bucle de redirección en el middleware** | El `matcher` incluye `/login`, pero el middleware **solo redirige** cuando la ruta es de `/admin`. `/login` nunca es destino de una redirección del middleware. Además, `sanitizeNextPath` convierte un `next` que apunta a `/login` en `/admin`. Doble barrera. |
| **`next` con URL externa (open redirect)** | ⛔ `sanitizeNextPath` la reemplaza por `/admin`. El chequeo corre en el servidor, en la página y en la action. El HTML servido nunca contiene la URL externa. |
| **Rate limiting de intentos de login** | Supabase Auth trae rate limiting propio en `/token?grant_type=password` y devuelve `429` después de varios intentos fallidos en poco tiempo. El código no agrega un limitador propio: sería una segunda capa sobre otra, y mal implementada se persistiría en memoria por instancia y no serviría de nada en serverless. Lo que **sí** hay que hacer, en la Tarea 19: activar CAPTCHA en el panel de Supabase y revisar la configuración de rate limiting por proyecto. Mientras tanto, el limitador de Supabase es la única defensa y **depende de que esté activo** en el proyecto. |
| **`getUser()` falla por caída de red** | ⛔ Devuelve `error` → `verifyAdminSession` devuelve `null` → "Sesión expirada". Degrada a **no autorizado**, nunca a autorizado. La UI muestra un mensaje que invita a reintentar. Un panel que se cae un rato es un problema operativo; un panel que se abre solo es una brecha. |
| **El usuario cierra sesión en otra pestaña** | La cookie se borra en esa pestaña. En la que sigue abierta, la próxima action recibe `null`. La UI muestra el mensaje de sesión expirada. |
| **El rol cambió de `STAFF` a `OWNER`** | `verifyAdminSession` lee el rol **de la base en cada llamada**. El cambio tiene efecto en la siguiente acción, sin necesidad de cerrar sesión. Es una consecuencia directa de consultar `staff_members` en cada `verifyAdminSession` en lugar de meter el rol en el JWT. |
| **Cookie de sesión sin `Secure` en producción** | Se resuelve en la Tarea 19 (headers). `@supabase/ssr` setea `Secure` según el protocolo. En desarrollo con `http://localhost` no lo setea, y está bien. |
| **El `layout` de admin llama `verifyAdminSession` y quiere escribir cookies** | El `setAll` de `supabaseServer` traga la excepción a propósito (comentario en §6.4). El refresh lo hace el middleware. Sacar ese `catch` hace que el panel entero tire 500. |

---

## 10. Pruebas

| Suite | Qué verifica |
|---|---|
| `tests/unit/ruta-retorno.test.ts` | El saneo del parámetro `next`, incluidos los vectores de open redirect |
| Manual | Login, logout, y rechazo del usuario sin `staff_members` |
| Manual | Con la red bloqueada (`getUser()` falla), el panel responde "no autorizado" |
| Manual | Con un token vencido, `/admin` redirige a `/login` |

**Criterio de diseño de las pruebas:**

- **Lo que se testea acá es la función pura.** `sanitizeNextPath` no depende de nada: es una función de strings con reglas. Es el único lugar de esta tarea donde un test automático da confianza real, porque es el único lugar donde un error es silencioso (un open redirect no rompe nada visible, solo manda personas al sitio equivocado).
- **Lo que NO se testea: `verifyAdminSession`.** Necesita Supabase Auth real, cookies reales y una fila en la base. Un mock de `supabase.auth.getUser()` verificaría que el código llama a la función que se escribió, no que la sesión se verifica. Es exactamente el criterio de la Tarea 04 §10: los mocks solo tienen sentido cuando la lógica que se prueba es una **traducción**. Acá la lógica está en el servicio externo.
- La prueba que más importa es la manual de §8.4: **usuario en `auth.users` sin fila en `staff_members`**. Es el caso de seguridad que justify toda esta tarea.

---

## 11. Definición de "Hecho" (Definition of Done)

- [x] Todos los criterios de §8 marcados (los bloqueados, anotados: requieren Supabase real — §13)
- [x] `npm run verify` + `npm run build` en verde
- [ ] El usuario del seed (Tarea 05) puede entrar con su contraseña o con link mágico — 🔴 bloqueado: el seed no pudo crearlo (Tarea 05 §13) porque no hay Supabase real
- [ ] Un usuario de prueba **sin** fila en `staff_members` es rechazado — 🔴 idem
- [x] `POST /api/admin/images/sign` devuelve `401` en vez de `501` (curl ✅)
- [x] `docs/tasks/README.md` actualizado
- [ ] Commit: `feat(07): login del admin con Supabase Auth y verificacion de sesion`
- [ ] PR mergeada a `main`
- [x] **`docs/erd.md` sin cambios** (esta tarea no toca el modelo)

---

## 13. Registro de ejecución y desviaciones

**Fecha:** 2026-09-30 · **Verificación:** `npm run verify` ✅ (101 tests, 10 archivos) · `npm run build` ✅ (`ƒ Proxy (Middleware)` en el resumen) · `curl /admin` sin sesión → **307 → `/login?next=%2Fadmin`** ✅ · `POST /api/admin/images/sign` sin sesión → **401** ✅ · `rg "auth.getSession" src/` → sin resultados ✅

### Bloqueos abiertos

Todo lo que requiere un proyecto Supabase real quedó 🔴 **bloqueado por las mismas credenciales placeholder de la Tarea 02** (y, en consecuencia, por la omisión del alta del admin en la Tarea 05): login con contraseña real, magic link real, rechazo del usuario sin `staff_members`. El código está completo y compilado; esas tres pruebas son manuales por naturaleza y se corren cuando exista el backend.

### Desviaciones respecto al documento

1. **El archivo es `src/proxy.ts`, no `middleware.ts` (raíz).** La Tarea 01 §12 ya renombró el middleware a `proxy.ts` (Next 16). Además, en este proyecto **debe** vivir dentro de `src/` porque `src/` es el app root: probado en build, un `proxy.ts` a la raíz quedaba silenciosamente fuera del middleware manifest. La función exportada se llama `proxy` (antes `middleware`) y el config exportado se sigue llamando `config` (Next 16 parsea `exportedConfig.config`: la skill que sugería `proxyConfig` aplicaba a otra versión).
2. **`getClaims()` de `@supabase/ssr` 2.117 con `data` posiblemente `null`:** el código del documento no compilaba con `noUncheckedIndexedAccess`. Se resolvió con `(data?.claims ?? null) !== null`.
3. **La regla ESLint de la Tarea 01 bloqueaba cualquier `@/server/*` en Client Components**, lo que imposibilita que un formulario consuma una Server Action —que es el patrón canónico de Next y el propio texto de la regla lo recomendaba en su mensaje de error. Se relajó con un **regex negativo** (`SERVIDOR_INTERNO_REGEX`) que solo permite importar entrypoints de acciones (`@/server/actions/**`, `@/server/auth/actions`). Las capas `infra`, `repositories` y `services` siguen bloqueadas. Documentado en el propio `eslint.config.mjs`.
4. **Colores de Tailwind por ahora neutros.** El código de la tarea usaba los tokens semánticos (`bg-cream`, `text-ink`…) que la Tarea 09 todavía no definió. Se escribió con la paleta neutra de Tailwind hasta que exista la paleta real (el `layout.tsx` raíz ya advertía esto de la Tarea 01). La Tarea 09 debe reemplazarlos. El placeholder de email del formulario usa `dueno@modo-miga.com.ar` como ejemplo de formato, no como dato registrable (el mock de D-09 es `.invalid`).
5. **`page.tsx` de `/admin` mínimo** para que la ruta exista y el 307 del proxy sea verificable: `layout` sola sin `page` no produce una ruta alcanzable. La Tarea 14 la reemplaza por el dashboard real.
6. **`logoutAction` no incluía nada entre `signOut` y `redirect`** en el pseudocódigo (el comentario mentía sobre `revalidatePath`, que no estaba). Quedó limpio: el signOut escribe la cookie vía `setAll` y el redirect navega.

> **Antes de mergear:** `rg "auth.getSession" src/` tiene que dar cero resultados. Si aparece uno, alguien optimizó la verificación de sesión y abrió la puerta para tokens revocados. Revisar el commit antes de aprobar.

---

## 12. Dependencias y bloqueos

**Habilita:** 14 (el panel y su layout), 16 (CRUD), 17 (ajustes y categorías), 19 (endurecimiento: RLS, headers, 2FA).

**Decisiones que esta tarea deja establecidas:**

1. La seguridad real es **`verifyAdminSession()`** en cada action y en el layout de admin. El middleware es UX.
2. La verificación usa **`getUser()`**, nunca `getSession()`: el token se valida contra el servidor de Supabase en cada request.
3. `verifyAdminSession` **falla cerrada**: ante cualquier error, devuelve `null`.
4. La autorización real es la fila en **`staff_members`**, no la existencia del usuario en `auth.users`.
5. El rol se lee de la base **en cada llamada**, no del JWT. Por eso un cambio de rol tiene efecto inmediato.
6. El rol viaja como **`AdminRole`** (union type propia). El enum de Prisma no cruza al cliente.
7. Los mensajes de login son **genéricos** y no distinguen entre causa de fallo.
8. El link mágico tiene **`shouldCreateUser: false`**.
9. El parámetro `next` se sanea **en el servidor**, con `sanitizeNextPath`, y nunca apunta afuera.
10. La cookie de sesión se maneja con la API `getAll`/`setAll` de `@supabase/ssr`, y el `setAll` del cliente de servidor **traga** los errores de escritura (los maneja el middleware).
11. `SUPABASE_SERVICE_ROLE_KEY` no aparece en ningún archivo de esta tarea.

**Bloqueos y decisiones pendientes:**

- **`src/app/admin/layout.tsx` tiene que existir antes que la Tarea 14.** Si no existe todavía, adelantarlo (el bloque está en §6.11). Es la pieza que convierte `/admin/**` en una zona protegida: sin ella, el middleware es lo único que separa el panel del público.
- **Dependencia cruzada no declarada en el grafo:** `verify-admin.ts` importa `findStaffById`, que es de la Tarea 04. El grafo del `README.md` muestra `02 → 07` sin pasar por `04`. Corregir el grafo o la firma de `verifyAdminSession`.
- **Rate limiting y CAPTCHA:** dependen de la configuración del proyecto en Supabase, no del código. La Tarea 19 tiene que revisarlos explícitamente; si no, el panel queda con la rate limit por defecto de la plataforma y nada más.
- **2FA:** no implementado. La Tarea 19 lo define. Cuando exista, `verifyAdminSession` **no cambia**: sigue devolviendo `null` o una sesión válida, y el factor extra se verifica en la action de login.
- **Rescate de cuenta:** si el encargado pierde la contraseña y no tiene acceso al email, la única salida es el panel de Supabase. Aceptable para 2 o 3 personas; anotar en el runbook de la Tarea 21.
