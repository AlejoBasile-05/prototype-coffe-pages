# Mi Negocio — sitio y panel de administración

Catálogo público y panel de control para **Mi Negocio**, sándwiches de miga artesanales en
San Rafael, Mendoza. El cliente completa su pedido por WhatsApp; no hay pasarela de pago ni
carrito en el servidor.

La especificación completa del proyecto vive en [`DESIGN.md`](./DESIGN.md) y el plan de
ejecución en [`docs/tasks/`](./docs/tasks/README.md).

---

## Stack

| Capa           | Tecnología                                | Versión instalada |
| -------------- | ----------------------------------------- | ----------------- |
| Framework      | Next.js (App Router)                      | 16.3.6            |
| Lenguaje       | TypeScript                                | 5.9.3             |
| UI             | React Server Components + islands         | 19.2.8            |
| Estilos        | Tailwind CSS                              | 4.3.3             |
| Estado cliente | Zustand                                   | _(Tarea 11)_      |
| Validación     | Zod                                       | _(Tarea 02)_      |
| Datos          | Supabase PostgreSQL + Prisma              | _(Tarea 02)_      |
| Imágenes       | Cloudinary                                | _(Tarea 06)_      |
| Auth           | Supabase Auth                             | _(Tarea 07)_      |
| Deploy         | Vercel                                    | _(Tarea 21)_      |
| Tests          | Vitest                                    | 5.0.2             |
| Lint / Format  | ESLint 9 (config de Next 16) + Prettier 3 | 9.39.5 / 3.9.9    |

> **Nota de baseline:** `DESIGN.md §4.1` fijaba Next.js 15. La Tarea 01 se implementó sobre
> **Next 16.3.6** (decisión explícita del proyecto, 2026-09-29): Turbopack es el bundler por
> defecto y ESLint usa flat config nativa. La tabla de arriba refleja las versiones reales
> instaladas; `DESIGN.md` se actualizó en la misma tarea.

---

## Requisitos

- **Node.js ≥ 20.9** (probado en 24.14.0)
- **npm ≥ 10**
- Git con `user.name` y `user.email` configurados

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # .env.local NUNCA se commitea
npm run dev                  # http://localhost:3000
```

`.env.local` no es necesario para esta etapa: el proyecto compila y arranca sin ninguna
variable definida. Los placeholders de `.env.example` son documentos del contrato de
variables, no credenciales.

## Scripts

| Script                  | Qué hace                                        |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | Servidor de desarrollo (Turbopack, `next dev`)  |
| `npm run build`         | Build de producción                             |
| `npm start`             | Sirve el build de producción                    |
| `npm run lint`          | ESLint + reglas de frontera de capas            |
| `npm run typecheck`     | `tsc --noEmit` con tipado estricto              |
| `npm test`              | Pruebas unitarias (Vitest)                      |
| `npm run test:watch`    | Vitest en modo interactivo                      |
| `npm run test:coverage` | Pruebas con reporte de cobertura                |
| `npm run format`        | `prettier --write .`                            |
| `npm run format:check`  | `prettier --check .`                            |
| `npm run verify`        | **Quality Gate**: `lint` + `typecheck` + `test` |

> **Regla de proceso:** `npm run verify` pasa **antes de cada commit**. Sin excepciones.

---

## Arquitectura N-capas

La dependencia se lee de arriba hacia abajo. Nunca al revés.

```
Presentación ──▶ Controlador ──▶ Servicio ──▶ Repositorio ──▶ Prisma
     │                │              │              │
     └────────────────┴──────────────┴──────────────┘
                    CAPA 0 — Dominio
```

| #   | Capa                   | Directorio                                          | Regla dura                                                          |
| --- | ---------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Presentación           | `src/app/**`, `src/components/**`, `src/store/**`   | Nunca Repositories, Prisma ni `src/server/infra`                    |
| 2   | Interfaz / Controlador | `src/server/actions/**`, `src/app/api/**/route.ts`  | Valida entrada y autoriza; habla con servicios, no con repositorios |
| 3   | Servicio               | `src/server/services/**`                            | Sin React, sin Next, sin acciones                                   |
| 4   | Acceso a Datos         | `src/server/repositories/**`, `src/server/infra/**` | Única capa que conoce Prisma. Sin lógica de negocio                 |
| 0   | Dominio                | `src/lib/**`                                        | Sin dependencias: ni internas ni externas                           |

### Dos mecanismos de enforcement

1. **`import "server-only"` — garantía dura.** Si un Client Component importa un módulo de
   `src/server/**`, **`npm run build` falla**. No es un warning: es un error de compilación.
   El centinela vive en `src/server/infra/server-boundary.ts` y **no se borra**.
2. **ESLint `no-restricted-imports` — feedback temprano.** Las mismas fronteras, con mensaje
   explicativo, en el editor y en `npm run lint`.

Excepción documentada: los **servicios de dominio puro** (cálculo determinista, sin red ni
disco) **no** llevan `server-only`, para poder ejecutarse en el navegador y en tests sin
mocks. Se materializa en las tareas 11 y 12.

## Errores de dominio

Los errores de negocio son clases de `src/lib/domain/errors.ts` con un `code` **estable**
(`RESOURCE_NOT_FOUND`, `VALIDATION_ERROR`, …) para compararse por código, nunca por texto.
El mensaje que ve el usuario se decide en la capa de presentación con
`toSafeErrorMessage()`, que no filtra detalles de infraestructura.

Prohibido: `any` explícito, `@ts-ignore`, `throw new Error("lógica en español")` y `!` en
código de negocio.

## Seguridad

- `.env*` está ignorado por Git con excepción de `.env.example`. Verificable con
  `git check-ignore -v .env.local`.
- `SUPABASE_SERVICE_ROLE_KEY` y `CLOUDINARY_API_SECRET` **nunca** se exponen al cliente:
  la service role de Supabase bypasea todas las políticas RLS.
- `ExternalServiceError` registra el **tipo** de la causa, nunca su mensaje: los drivers de
  conexión incluyen credenciales y hosts internos en sus errores.
- Los headers de seguridad (CSP, HSTS, `X-Frame-Options`) se configuran en la **Tarea 19**.

---

## Estado del proyecto

| Tarea                           | Estado                                               |
| ------------------------------- | ---------------------------------------------------- |
| 00 — Descubrimiento y auditoría | 🟡 Mockeado; pendiente validación real del encargado |
| 01 — Bootstrap y tooling        | ✅                                                   |

Detalle y grafo de dependencias: [`docs/tasks/README.md`](./docs/tasks/README.md).

## Decisiones técnicas de esta tarea

- **`exactOptionalPropertyTypes: true` activado.** La Tarea 01 lo dejaba como opcional
  ("activar solo si no genera fricción"). Con el stack actual compila sin fricción, así que
  queda activo: distingue `notes?: string` de `notes?: string | undefined`, que es la
  fuente clásica de errores en el carrito.
- **`next dev` sin `--turbopack`.** En Next 16 Turbopack es el bundler por defecto; el flag
  es redundante.
- **ESLint 9.39.5.** ESLint 10 ya no tiene soporte declarado, pero `eslint-config-next@16.3.6`
  incluye `eslint-plugin-react`, `eslint-plugin-import` y `eslint-plugin-jsx-a11y`, cuyos
  peers topean en ESLint 9. `npm install` emite por eso un warning de deprecación de ESLint;
  es la única advertencia de la instalación y desaparece cuando Next actualice esos plugins.
- **`DESIGN.md` y `docs/` están en `.prettierignore`.** Son documentación escrita a mano:
  reformatear 32 000 líneas de Markdown en cada `npm run format` generaría un diff enorme y
  sin relación con el código.
- **Sin Google Fonts todavía.** `next/font` se configura en la Tarea 09 junto con el sistema
  de diseño; durante el bootstrap el build no depende de la red.

---

## Para el local (Tarea 22 — Soporte Post-Lanzamiento)

Estas son las cinco tareas que el encargado ejecuta en el panel. Sin jerga, sin pasos de más.

- **Agregar un producto:** Productos → Nuevo → nombre, precio, foto, Guardar.
- **Marcar que no hay:** en la lista, el interruptor de la primera columna.
  Aparece al instante en la web, sin recargar.
- **Cambiar el teléfono de WhatsApp:** Ajustes → el primer campo. Cambia
  en todos los pedidos siguientes.
- **Cambiar un precio:** Productos → editar → precio → Guardar.
- **Sacar un producto:** archivar. Deja de aparecer, no se borra.

> La pregunta que decide si la capacitación sirvió: **«¿podés entrar solo, agregar un producto con foto y marcarlo como agotado, sin llamarme?»** Si la respuesta es un "sí" con seguridad, la sesión está terminada.
