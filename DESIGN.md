# DESIGN.md — Mi Negocio · Plataforma Web-to-WhatsApp

> **Software Design Description (SDD)** · Catálogo Digital con cierre de pedido vía WhatsApp
> **Cliente:** Mi Negocio — Sándwiches de miga artesanales · San Rafael, Mendoza, AR
> **Versión del documento:** 1.0
> **Estado:** Propuesta base para inicio de desarrollo

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Objectives](#2-objectives)
3. [Scope & Non-Goals](#3-scope--non-goals)
4. [Architecture & Tech Stack](#4-architecture--tech-stack)
5. [Data Model](#5-data-model)
6. [System Flows](#6-system-flows)
7. [Directory Structure](#7-directory-structure)
8. [Development Phases](#8-development-phases)
9. [Task Breakdown](#9-task-breakdown)
10. [UX/UI Guidelines](#10-uxui-guidelines)
11. [Security](#11-security)
12. [Performance & SEO](#12-performance--seo)
13. [Testing Strategy](#13-testing-strategy)
14. [Environment Variables](#14-environment-variables)
15. [Deployment & Operations](#15-deployment--operations)
16. [KPIs & Analytics](#16-kpis--analytics)
17. [Risks & Mitigations](#17-risks--mitigations)
18. [Decisiones Técnicas Consolidadas (ADR Log)](#18-decisiones-técnicas-consolidadas-adr-log)

---

## 1. Project Overview

### 1.1 Problema

Mi Negocio opera como un comercio local de inyección manual en la toma de pedidos. El flujo actual tiene las siguientes fricciones:

| Fricción | Impacto |
|---|---|
| El cliente escribe por WhatsApp preguntando precio, disponibilidad y horarios | Decenas de mensajes por día, respondidos uno por uno |
| El encargado responde el mismo precio y la misma disponibilidad N veces | Tiempo del único recurso humano desperdiciado en tareas repetitivas |
| No existe un inventario explícito: el stock se comunica verbalmente | Clientes frustrados ("llegué y no había"), pedidos perdidos |
| El cliente no tiene una referencia visual del producto ni del menú completo | Decisiones de compra más lentas, más consultas previas |
| La toma de pedidos manual mezcla información dispersa (precio + dirección + pago + horario) | Errores de tipeo, pedidos incompletos |

**Costo principal:** entre 30 y 60 minutos diarios de trabajo manual en tareas que una página web resuelve mejor, más la pérdida de ventas por fricción y falta de información.

### 1.2 Solución propuesta

Una aplicación web **mobile-first** que cumple exactamente dos funciones, sin agregar complejidad innecesaria:

1. **Catálogo público + Carrito → Handoff a WhatsApp.**
   El cliente navega el menú, arma su pedido, completa sus datos de entrega/retiro y el sistema genera un **mensaje de WhatsApp preformateado, estructurado y listo para confirmar**. La conversación y el pago quedan en el canal que el negocio ya usa y domina. El sistema **no procesa pagos ni cobra commission**: es un motor de pedido estructurado, no un e-commerce.

2. **Panel de control de disponibilidad en tiempo real.**
   Un panel privado, deliberadamente simple, donde el encargado puede **alternar un switch `isAvailable` por producto** para ocultarlo del catálogo al instante cuando se agota el stock, y restaurarlo cuando se repone. El cambio se propaga a los clientes conectados **sin necesidad de recargar la página** (Supabase Realtime).

### 1.3 Principio rector de diseño

> **"El sistema prepara el pedido; el humano lo confirma."**

Cada decisión de arquitectura debe evaluarse contra esta pregunta: *¿esto reduce trabajo manual del encargado sin agregar una función que el negocio no pidió?* Si la respuesta no es un sí claro, la funcionalidad se posterga (ver [Non-Goals](#3-scope--non-goals)).

### 1.4 Resumen ejecutivo de la arquitectura

```
┌──────────────┐   HTTPS    ┌──────────────────────────────────────────┐
│   Cliente    │───────────▶│        Next.js 16 (App Router)          │
│  (móvil)     │◀───────────│  Vercel Edge Network · Node Runtime      │
└──────────────┘            │                                          │
                            │  ┌────────────┐      ┌────────────────┐  │
                            │  │  RSC / ISR │─────▶│    Prisma 6    │  │
                            │  └────────────┘      │  (server-only) │  │
                            │  ┌────────────┐      └────────┬───────┘  │
                            │  │  API Routes│───────────────┼──────────▶│
                            │  └────────────┘               ▼          │
                            │  ┌────────────┐        ┌──────────────┐  │
                            │  │ supabase-js│───────▶│  Supabase    │  │
                            │  │ (SSR + RT) │        │  PostgreSQL  │  │
                            │  └────────────┘        │  + Auth      │  │
                            │        │               └──────────────┘  │
                            │        │ wa.me/…?text=…                    │
                            │        ▼                                   │
                            │  ┌────────────┐      ┌────────────────┐  │
                            │  │  Cloudinary│      │ WhatsApp (chat)│  │
                            │  └────────────┘      └────────────────┘  │
                            └──────────────────────────────────────────┘
```

**Lectura del diagrama:** dos caminos de acceso a datos, deliberadamente separados.

- **Camino 1 — Prisma (privilegiado, server-only).** Lecturas y escrituras de catálogo y panel admin desde Server Components, Server Actions y Route Handlers. Pasa por el connection pooler de Supabase.
- **Camino 2 — supabase-js (no privilegiado, cliente).** Solamente **Auth** (cookies de sesión SSR) y **Realtime** (suscripción a cambios de `products`). Pasa por la API de Supabase y por lo tanto **sí respeta las políticas RLS**.

Esta separación es la clave del diseño de seguridad y está detallada en [§11 Security](#11-security).

---

## 2. Objectives

### 2.1 Objetivos de negocio

| # | Objetivo | Métrica de éxito | Plazo |
|---|---|---|---|
| OB-1 | Eliminar las consultas repetitivas de precio/disponibilidad | Reducción ≥ 70% de mensajes "informativos" vs. línea base semanal | 30 días post-lanzamiento |
| OB-2 | Capturar pedidos completos y correctos desde el primer mensaje | ≥ 90% de pedidos iniciados en la web llegan al chat con todos los campos completos | 60 días |
| OB-3 | Eliminar la venta perdida por rotura de stock | 0 ventas perdidas por productos publicados y agotados | Continuo |
| OB-4 | Reducir el tiempo de atención por pedido | ≤ 20 s de trabajo activo del encargado por pedido web (solo confirmar) | 30 días |
| OB-5 | Brindar independencia operativa | El encargado gestiona el menú y la disponibilidad **sin depender de un desarrollador** | Al launch |

### 2.2 Objetivos técnicos

| # | Objetivo | Criterio de aceptación |
|---|---|---|
| OT-1 | Carga extremely rápida en mobile (el cliente está parado en la calle, con 3G/4G variable) | LCP < 2.5 s en dispositivos móviles de gama media con conexión 4G |
| OT-2 | Disponibilidad propagada en tiempo real | Cambio de `isAvailable` visible en el catálogo de clientes conectados en **< 2 s** |
| OT-3 | UI mobile-first impecable | Diseño verificado a 360 px, 390 px, 768 px, 1280 px; sin scroll horizontal en ninguna |
| OT-4 | Tipado estricto de extremo a extremo | `tsc --noEmit` sin errores; `strict: true`; cero `any` explícito en código de negocio |
| OT-5 | Aislamiento de la base de datos | Ningún secreto de DB expuesto al cliente; el bundle del navegador no contiene `DATABASE_URL` |
| OT-6 | Mantenibilidad por parte de un equipo pequeño | Cero archivos de > 300 líneas; componentes con responsabilidad única; el modelo de datos cabe en una pantalla |
| OT-7 | Accesibilidad razonable | Navegación completa por teclado; WCAG AA en contraste de texto de la UI principal |
| OT-8 | Costo operativo cercano a cero | Free tier de Vercel + Supabase + Cloudinary suficiente para el volumen esperado (< 30 pedidos/día) |

### 2.3 Anti-objetivos (lo que este sistema NO va a ser)

Explícitamente, para evitar scope creep:

- ❌ No será un e-commerce con checkout ni pago online.
- ❌ No habrá multi-tenant ni múltiples negocios.
- ❌ No habrá sistema de roles complejo (más de 2 roles).
- ❌ No habrá app móvil nativa.
- ❌ No habrá sistema de reseñas/comentarios públicos en v1.

---

## 3. Scope & Non-Goals

### 3.1 In Scope (v1)

- Catálogo público responsive agrupado por categorías
- Ficha de producto con imagen optimizada, precio, descripción y alérgenos
- Carrito persistente en el navegador (localStorage)
- Flujo de checkout en 2 pasos: identificación →modalidad (envío/retiro) → confirmación
- Generación de enlace de WhatsApp con el pedido formateado
- Panel admin protegido por Supabase Auth (email + magic link / password)
- CRUD completo de productos (crear, editar, archivar)
- CRUD de categorías
- Switch de disponibilidad por producto con propagación por Realtime
- Subida y gestión de imágenes vía Cloudinary (upload firmado)
- Gestión de datos del negocio: nombre, número de WhatsApp, dirección, horarios, texto legal
- Páginas legales mínimas (privacidad) y metadatos SEO/social

### 3.2 Out of Scope (v1) — Backlog candidato

| Feature | Razón de exclusión | Esfuerzo estimado |
|---|---|---|
| Pagos online (Mercado Pago / Stripe) | Decisión de negocio explícita; requiere PCI, expansión y soporte | Alto |
| Persistencia de pedidos en DB (tabla `Order`) | El pedido vive en WhatsApp; una tabla sin consumidor real es deuda | Bajo (pero inútil hoy) |
| Sistema de variantes y modificadores completos | El menú de sándwiches de miga es_simple_; se resuelve con notas y cantidades | Medio |
| Códigos de descuento / programas de fidelidad | Sin requerimiento del negocio | Medio |
| Multi-idioma | El público es local, 100% español rioplatense | Bajo |
| Panel de métricas / dashboard de ventas | No hay datos de venta estructurados en v1 | Alto |
| Notificaciones push o emails automáticos | El canal de comunicación ya es WhatsApp | Medio |
| Modo "pre-pedido" con horario de retiro | Feature futura valiosa; requiere modelo de horarios más rico | Medio |

### 3.3 Decisión de diseño sobre la tabla `Order`

> **Decisión ORIGINAL (v1): no se creaba la tabla `Order`.**
> **REVERTIDA el 2026-10-07 (Tarea 23 — tablero de comandas).**

La decisión de v1 era no persistir pedidos: el chat de WhatsApp era el sistema de registro real del negocio, y una tabla "por si acaso" sería un segundo sistema de verdad sin consumidor. El propio documento dejaba abierto el retrofit "con un simple registro en el backend al hacer clic en Enviar por WhatsApp".

La Tarea 23 ejecutó ese retrofit con un consumidor real: **el tablero de cocina** (`/admin/comandas`). Las reglas de convivencia entre los dos sistemas quedaron así:

- **El chat sigue siendo la confirmación humana.** La comanda entra a la columna *Pendientes* al confirmar el checkout; el encargado la pasa a *En preparación* solo cuando el mensaje llegó por WhatsApp. Ninguno de los dos sistemas reemplaza al otro: la fila ordena el trabajo, el chat cierra el trato.
- **El handoff nunca se bloquea.** Si el registro de la comanda falla, el `wa.me` se abre igual: la cocina pierde una tarjeta, el negocio no pierde el pedido.
- **La línea del pedido es un snapshot** (nombre y precio congelados, sin FK viva a `Product`): un cambio de precio de mañana no reescribe la comanda de anoche.
- **La escritura pública está defendida** (rate limit por IP, honeypot, revalidación contra catálogo y cotización server-side en `registerOrderAction`); la lectura del tablero exige staff por RLS.

---

## 4. Architecture & Tech Stack

### 4.1 Stack tecnológico

| Capa | Tecnología | Versión | Rol en el sistema |
|---|---|---|---|
| Framework | **Next.js** (App Router) | 16.x | Rendering (RSC + ISR), Server Actions, Route Handlers, `proxy.ts` |
| Lenguaje | **TypeScript** | 5.9.x | Tipado estricto de extremo a extremo |
| Estilos | **Tailwind CSS** | 4.x | Sistema de diseño consistente y rápido de iterar |
| Componentes | **React Server Components** + islands | 19.2.x | Máximo HTML enviado al cliente; interactividad mínima |
| Estado cliente | **Zustand** (middleware `persist`) | 5.x | Carrito con persistencia en localStorage, sin boilerplate |
| Validador | **Zod** | 3.x | Validación de entradas de Server Actions y boundaries de la API |
| Base de datos | **Supabase PostgreSQL** | 15+ | Almacenamiento relacional, RLS, backups |
| Auth | **Supabase Auth** | — | Login del admin; sesiones por cookie SSR |
| ORM | **Prisma** | 6.x | Acceso tipado y migraciones versionadas |
| Imágenes | **Cloudinary** | — | Hosting, transformaciones y optimización de fotos |
| Realtime | **Supabase Realtime** | — | Propagación de cambios de disponibilidad |
| Deploy | **Vercel** | — | Hosting, previews por rama, edge network |
| Tests | **Vitest** + **Testing Library** | 5.x / 16.x | Unitarios de lógica de negocio y componentes |
| Lint/Format | **ESLint** (Next config, flat config nativa) + **Prettier** | 9.x / 3.x | Calidad estática |

> **Baseline actualizado por la Tarea 01 (2026-09-29).** La tabla pasó de Next.js 15 a
> **Next.js 16.3.6** y de Vitest 3 a **5.0.2**, con versiones exactas en el `README.md`.
> Consecuencias para el resto del documento: Turbopack es el bundler por defecto (sin
> `--turbopack`), ESLint usa flat config nativa (sin `FlatCompat`) y el archivo de
> middleware se llama **`proxy.ts`**. Registro completo de desviaciones:
> [`docs/tasks/01-bootstrap-y-herramientas.md` §12](docs/tasks/01-bootstrap-y-herramientas.md).

### 4.2 Decisión sobre el stack de UI
**Se evita instalar una librería de componentes completa (shadcn/ui, MUI, Chakra).** El catálogo es visual por naturaleza: la identidad de una marca de sándwiches artesanales vive en la fotografía, la tipografía y el color, no en un set de componentes genéricos. Un set de ~10 componentes propios (Card, Price, Badge, Sheet, Button, Input) es suficiente, pesa cero KB extra y da control total del resultado estético.

Se mantiene, en cambio, un uso **estricto y consistente** de las primitivas de Tailwind y de tokens semánticos de color (ver [§10](#10-uxui-guidelines)) para garantizar consistencia sin framework.

> 🔄 **Actualización (ADR-25, deroga ADR-12):** el proyecto adoptó **Arc UI** como sistema de componentes. Los componentes viven como código vendor en `src/components/arc/` (instalados con `npx shadcn add @uiarc/<componente>`, no se editan a mano) y consumen los tokens semánticos de marca definidos en `globals.css`, que incluyen el tema oscuro (`data-theme="dark"`). La capa `src/components/ui/` sigue siendo la fachada estable del negocio.

### 4.3 Cómo interactúan las tecnologías (flujo específico)

#### Flujo A — Lectura del catálogo (público, cacheable)

```
Browser GET /menu
   → Next.js Route (Server Component)
     → Prisma finds products where status = 'PUBLISHED'
       → Supabase Postgres (vía pooler, puerto 6543)
     ← datos + imágenes de Cloudinary
   → HTML renderizado en el servidor
   → caché ISR: se revalida por tag ("products")
   ← Browser: HTML + CSS (JS mínimo)
```

La Availability Layer (disponibilidad en vivo) se hidrata después en el cliente vía Realtime, para no invalidar la caché estática con cada toggle.

#### Flujo B — Toggle de disponibilidad (admin → público)

```
Admin: click en Switch
  → Server Action "toggleProductAvailability" (auth verificada)
    → Prisma UPDATE products SET isAvailable = …
      → Postgres
        → NOTIFY supabase_realtime  (automático vía trigger/publication)
          → WebSocket push a clientes suscritos
            → Zustand store actualiza el ítem
              → Card del producto se desatura + badge "Agotado"
```

**Latencia objetivo < 2 s. La página del cliente NO se recarga.**

#### Flujo C — Cierre del pedido hacia WhatsApp

```
Cliente: completa checkout → "Enviar pedido por WhatsApp"
  → el navegador arma el snapshot del carrito (Zustand)
    → buildWhatsAppMessage(cart, customer, business)   [función pura, testeada]
      → buildWhatsAppUrl(phone, message)  [encodeURIComponent + normalización E.164]
        → window.open(url)  /  <a href target="_blank" rel="noopener">
          → WhatsApp App / WhatsApp Web con el chat abierto y el borrador listo
            → el cliente presiona enviar → el encargado confirma
```

**El sistema nunca contacta la API de WhatsApp Business Platform.** No hay costo por conversación, no hay webhooks, no hay verificación de plantillas, no hay manejo de tokens. El handoff es un deep-link gratuito y universal (`wa.me`). Esta decisión elimina de un plumazo la mayor parte de la complejidad operacional típica de un sistema de pedidos.

#### Flujo D — Imágenes

```
Admin: selecciona archivo
  → POST a Server Action /api/admin/upload
    → valida sesión admin + MIME + tamaño
    → Cloudinary API signed upload (SHA-1 de params con API Secret)
      ← { publicId, secure_url }
        → Cloudinary guarda en /modo-miga/products/
          → el admin guarda publicId en el producto
            → el catálogo sirve con next/image + transformaciones f_auto, q_auto
```

### 4.4 Decisiones estructurales de Next.js

| Decisión | Elección | Justificación |
|---|---|---|
| Directorio | `app/` (App Router) | RSC por defecto, Server Actions, streaming, metadata API |
| ¿SPA o SSR? | **ISR + islands** | El catálogo es casi estático y debe ser instantáneo. El cliente recibe HTML completo, no un spinner de skeleton perpetuate. |
| Mutaciones | **Server Actions** | Menos boilerplate que API REST, validación en el servidor por definición, tipado de extremo a extremo en el payload |
| Endpoint público | Route Handler `GET /api/availability` | Único endpoint JSON público, útil como fallback si Realtime falla |
| Carga de imágenes | `next/image` con loader de Cloudinary | Optimización automática, `sizes` correctos, sin doble descarga |
| Middleware | `proxy.ts` | Redirección temprana de `/admin/*` no autenticado (UX + ahorro de cómputo). **No es la única barrera** — ver §11 |
| Variables de entorno | Archivos `.env.local` / `.env.production` en Vercel | Prefijo `NEXT_PUBLIC_` **exclusivamente** para valores realmente públicos |

### 4.5 Conexión Prisma ↔ Supabase (punto crítico de infraestructura)

Este es uno de los puntos que más errores causa en proyectos reales. Supabase ofrece tres formas de conectar y usarlas sin criterio agota el pool de conexiones en pocas horas.

| Variable | Host / Puerto | Propósito | Configuración |
|---|---|---|---|
| `DIRECT_DATABASE_URL` | `db.<ref>.supabase.co:5432` | Conexión directa, **sin pooler** | Reservar para **migraciones únicamente** |
| `DATABASE_URL` | `aws-0-<region>.pooler.supabase.com:6543` | **Transaction mode** (PgBouncer) | Usar en runtime (serverless) |

Configuración en `schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // pooler — runtime
  directUrl = env("DIRECT_DATABASE_URL") // directo — migraciones
}
```

**Reglas innegociables:**

1. En Vercel (serverless), el runtime **SIEMPRE** usa el pooler en modo transaction. Una conexión directa desde una función serverless agota el límite de conexiones de Supabase (usuariosfree: 15) casi de inmediato.
2. `prisma migrate dev` y `prisma migrate deploy` **deben** correr con la URL directa.
3. `pgbouncer` en modo transaction **no soporta** consultas preparadas persistentes ni `LISTEN/NOTIFY` del lado Prisma. Por eso el Realtime se resuelve con `supabase-js` (WebSocket) y no con Prisma. Esto es intencional.

### 4.6 Patrón de Singleton de Prisma

Crítico en desarrollo: Next.js hot-reload crea un nuevo módulo en cada cambio, y sin singleton cada uno abre su propio pool.

```ts
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 4.7 Nota crítica: Prisma y las políticas RLS

**Prisma conecta con el rol `postgres` (superusuario del proyecto), que es dueño de las tablas y por lo tanto las políticas RLS no se aplican a sus consultas.**

Esto significa que **toda lógica de autorización y filtrado debe existir también en el código de aplicación**, no solo en la base de datos. RLS es una capa de defensa en profundidad (protege contra cualquier acceso futuro vía API REST de Supabase, dashboards, etc.), pero **no puede ser la única barrera** en las rutas que usan Prisma.

Consecuencia práctica para este proyecto:
- Lecturas públicas: el filtro `status = 'PUBLISHED'` debe estar **en la query de Prisma**, no solo en RLS.
- Lecturas de admin: verificar sesión en cada Server Action, sin excepción.
- RLS debe permanecer activa y configurada para que un descuido futuro no sea catastrófico.

---

## 5. Data Model

### 5.1 Diagrama de entidades

```
        ┌──────────────────────┐
        │       Category       │
        │──────────────────────│
        │ id          PK       │
        │ name                │
        │ slug         UK      │
        │ description         │
        │ position            │
        └──────────┬───────────┘
                   │ 1
                   │
                   │ N
        ┌──────────┴──────────────────────────────┐
        │                 Product                 │
        │─────────────────────────────────────────│
        │ id                    PK                │
        │ name                                    │
        │ slug                                   UK│
        │ description                             │
        │ price                  DECIMAL(10,2)    │
        │ imageUrl                               │
        │ imagePublicId                           │
        │ isAvailable          BOOLEAN (switch)   │
        │ status              ENUM (draft/…)      │
        │ isFeatured          BOOLEAN             │
        │ sortOrder           INT                 │
        │ allergens           TEXT[]              │
        │ categoryId          FK → Category       │
        │─────────────────────────────────────────│
        │ 1                                        │
        │                                          │
        │ N                                        │
        │ ┌─────────────────────────────────────┐ │
        │ │          ProductVariant              │ │
        │ │─────────────────────────────────────│ │
        │ │ id        PK │ productId FK          │ │
        │ │ name │ priceDelta │ isAvailable      │ │
        │ │ sortOrder                          │ │
        │ └─────────────────────────────────────┘ │
        └─────────────────────────────────────────┘

        ┌─────────────────────────────────────────┐
        │              BusinessSettings            │
        │─────────────────────────────────────────│
        │ id              PK (singleton, id = 1)  │
        │ name                                    │
        │ whatsappPhone    E.164 sin +            │
        │ address                                   │
        │ instagramUrl                              │
        │ openingHours    JSONB                    │
        │ closingMessage  TEXT                     │
        │ legalNotice     TEXT                     │
        │ updatedAt                                 │
        └─────────────────────────────────────────┘

        ┌─────────────────────────────────────────┐
        │               StaffMember                │
        │─────────────────────────────────────────│
        │ id              PK (uuid)               │
        │ email           UK  (FK → auth.users)   │
        │ name                                    │
        │ role         ENUM (owner/staff)         │
        │ createdAt                                 │
        └─────────────────────────────────────────┘
```

### 5.2 Esquema Prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}

enum ProductStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum StaffRole {
  OWNER
  STAFF
}

model Category {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String?   @db.Text
  position    Int       @default(0)
  isVisible   Boolean   @default(true)
  products    Product[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([position])
  @@map("categories")
}

model Product {
  id          String        @id @default(cuid())
  name        String
  slug        String        @unique
  description String?       @db.Text
  price       Decimal       @db.Decimal(10, 2)
  imageUrl    String
  imagePublicId String?
  isAvailable Boolean       @default(true)
  status      ProductStatus @default(DRAFT)
  isFeatured  Boolean       @default(false)
  sortOrder   Int           @default(0)
  allergens   String[]      @default([])
  categoryId  String
  category    Category      @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  variants    ProductVariant[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([status, categoryId])
  @@index([isAvailable])
  @@map("products")
}

// ⚠️ SIN USO EN v1 (decisión D-02): ningún repositorio ni UI lo consume.
// Se conserva como vía de retrofit barata si el encargado reabre la decisión.
model ProductVariant {
  id          String  @id @default(cuid())
  name        String
  priceDelta  Decimal @default(0) @db.Decimal(10, 2)
  isAvailable Boolean @default(true)
  sortOrder   Int     @default(0)
  productId   String
  product     Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@map("product_variants")
}

model BusinessSettings {
  id             String   @id @default("1")
  name           String
  whatsappPhone  String
  address        String?
  instagramUrl   String?
  openingHours   Json?
  closingMessage String?  @db.Text
  legalNotice    String?  @db.Text
  updatedAt      DateTime @updatedAt
  @@map("business_settings")
}

model StaffMember {
  id        String    @id
  email     String    @unique
  name      String?
  role      StaffRole @default(STAFF)
  createdAt DateTime  @default(now())
  @@map("staff_members")
}
```

### 5.3 Decisiones de modelado y sus porqués

| Decisión | Porqué |
|---|---|
| `price: Decimal(10,2)` y **no** `Float`/`Int` | Nunca usar punto flotante para dinero. `Decimal` mapea a `numeric` nativo de Postgres. **Gotcha crítico:** Prisma devuelve `Prisma.Decimal`, que **no es serializable por RSC hacia Client Components**. Convertir siempre con `.toNumber()` en el límite servidor→cliente, o definir un tipo `SerializedProduct` en `lib/types.ts`. |
| `isAvailable` separado de `status` | Conceptualmente distinto: `status` es editorial (¿está en el catálogo? `DRAFT` = no publicado, `ARCHIVED` = retirado) y `isAvailable` es **operativo en tiempo real** (¿queda stock ahora?). Mezclarlos fuerza a crear Workarounds para ocultar temporalmente un producto sin despublicarlo. |
| `status: ProductStatus` en vez de `isActive: Boolean` | Permite el flujo editorial real: crear en borrador → revisar → publicar. Un `Boolean` obliga a publicar un producto para poder verlo, lo cual es peligroso si el precio aún no está confirmado. |
| Borrado lógico (`ARCHIVED`) en lugar de `DELETE` | Un `ON DELETE CASCADE` accidental borra el historial y, sobre todo, deja URLs de imágenes huérfanas en Cloudinary. Archivar es reversible; borrar no. Los productos archivados se pueden purgar con un script explícito. |
| `imagePublicId` además de `imageUrl` | `imageUrl` es lo que se sirve (con transformaciones). `imagePublicId` es lo que permite **borrar/reemplazar** la imagen en Cloudinary. Sin esto, cada cambio de foto deja un asset huérfano pagando almacenamiento. |
| `allergens: String[]` (array nativo de Postgres) | Un café de sándwiches necesita declarar alérgenos. Un array de texto es correcto aquí; una tabla `allergens` sería sobre-normalización para el dominio. |
| `BusinessSettings` como singleton (`id = 1`) | Un solo negocio. Una tabla de una fila con `CHECK (id = 1)` en la DB es más simple y evita un `ORDER BY` en cada request para leer la config. Implementado desde la migración init como `CHECK (id = '1')` (la columna es `TEXT`; Prisma no soporta CHECK nativo, vive solo en el SQL de la migración). |
| `CHECK (price >= 0)` en `products` | Prisma no soporta CHECK nativo en el schema: se declara en la migración inicial (`products_price_non_negative`, Tarea 03 §10). Es la red de abajo para un precio negativo insertado fuera del formulario (Zod no lo vería). |
| `StaffMember` separado de `auth.users` | Supabase Auth maneja credenciales. Esta tabla maneja **autorización** (quién es del equipo). Desacopla identidad de permiso y permite quitar acceso sin borrar la cuenta de Auth. |
| Sin tabla `Order` | Ver [§3.3](#33-decisión-de-diseño-sobre-la-tabla-order). |

### 5.4 Notas de convención

- **Slugs:** siempre en minúsculas, sin tildes ni caracteres especiales (`café con queso` → `cafe-con-queso`). Generar con una función pura `slugify()` testeada, y garantizar unicidad con un sufijo numérico.
- **Desambiguación de slugs duplicados:** si dos productos de categorías distintas comparten nombre, el slug lleva el prefijo de la categoría (`jamon-y-queso` vs. `premium-jamon-y-queso`). Definido en [`docs/menu-maestro.md` §4](./docs/menu-maestro.md). Un slug publicado no se modifica nunca: cambiarlo exige un 301 y deja una URL indexada muerta.
- **Timestamps:** todos los modelos con `createdAt` / `updatedAt` para trazabilidad.
- **Naming:** PascalCase en modelos/tablas, camelCase en campos de TypeScript, snake_case en columnas (mapeado con `@map` cuando difiera).
- **Borrado de categorías:** `onDelete: Restrict` — no se puede eliminar una categoría con productos asignados; hay que reasignar o archivar primero. Previene pérdida de datos silenciosa.

---

## 6. System Flows

### 6.1 Flujo de lectura del catálogo (optimizado para caché)

El catálogo se divide en **dos capas de datos** para no invalidar caché con cada toggle de disponibilidad:

| Capa | Contenido | Mecanismo | Caché |
|---|---|---|---|
| **Capa de contenido** | Productos, categorías, precios, imágenes, nombres | Server Component + Prisma | **ISR con tag** `products` — se revalida al publicar/editar |
| **Capa de disponibilidad** | `isAvailable` de cada producto | `supabase-js` cliente + Realtime | **Sin caché** — estado en memoria del navegador, actualizado por push |

```
Usuario entra a /menu
  │
  ├─ Servidor (ISR, ~instantáneo si está cacheado)
  │    ├─ getProducts()  → Prisma → 6 productos (con isAvailable inicial)
  │    └─ HTML completo renderizado
  │
  └─ Cliente (hidratación, ~0.5s)
       ├─ useEffect: supabase.channel('products').on('postgres_changes')
       └─ Estado local de disponibilidad por productId
            └─ Cada UPDATE recibido → actualiza solo ese producto
```

**Por qué importa esta separación:** si la disponibilidad viviera en el HTML cacheado, cada toggle obligaría a revalidar todo el catálogo para todos los usuarios — con un solo encargado, sería aceptable, pero el diseño correcto escala gratis y evita invalidaciones constantes.

### 6.2 Flujo de autorización del panel admin

```
Request a /admin/products
  │
  ├─ 1. proxy.ts
  │     └─ supabase.auth.getUser() desde cookies
  │        ├─ sin sesión → 302 a /login?next=/admin/products
  │        └─ con sesión → continue
  │
  ├─ 2. Layout de /admin (Server Component, Defense in Depth)
  │     └─ verifyAdminSession() → redirect('/login') si falla
  │
  └─ 3. Cada Server Action (el paso que realmente importa)
        ├─ const session = await verifyAdminSession()  ← SIEMPRE primero
        ├─ if (!session) throw new Error("Unauthorized")
        ├─ validar input con Zod
        └─ ejecutar mutation + revalidateTag("products")
```

**El paso 3 es innegociable.** El middleware es una optimización (evita renderizar páginas que nadie verá), no un control de seguridad. Si un middleware está mal configurado o deshabilitado, las Server Actions siguen protegidas porque cada una revalida la sesión.

### 6.3 Flujo de generación del mensaje de WhatsApp

Función pura, sin efectos secundarios, **totalmente testeable**:

```ts
// lib/whatsapp.ts

export type CartItemSnapshot = {
  productId: string;
  name: string;
  variantName?: string | null;
  unitPrice: number;   // ya resuelto con variant priceDelta
  quantity: number;
};

export type CustomerSnapshot = {
  fullName: string;
  phone: string;
  fulfillment: "delivery" | "pickup";
  address?: string | null;
  notes?: string | null;
};

export type BusinessSnapshot = {
  name: string;
  whatsappPhone: string; // formato E.164 sin "+": "5492615xxxxxx"
};

export function formatARS(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function buildWhatsAppMessage(
  items: CartItemSnapshot[],
  customer: CustomerSnapshot,
  business: BusinessSnapshot,
): string {
  const lines: string[] = [];

  lines.push(`¡Hola! Quiero hacer un pedido en *${business.name}*:`);
  lines.push("");

  items.forEach((item) => {
    const variant = item.variantName ? ` (${item.variantName})` : "";
    const lineTotal = item.unitPrice * item.quantity;
    lines.push(
      `• ${item.quantity} x ${item.name}${variant} — ${formatARS(lineTotal)}`,
    );
  });

  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  lines.push("");
  lines.push(`*Total: ${formatARS(total)}*`);
  lines.push("");

  lines.push("*Mis datos:*");
  lines.push(`Nombre: ${customer.fullName}`);
  lines.push(`Teléfono: ${customer.phone}`);

  if (customer.fulfillment === "delivery") {
    lines.push(`Entrega en: ${customer.address}`);
  } else {
    lines.push("Retiro en el local");
  }

  if (customer.notes?.trim()) {
    lines.push(`Comentarios: ${customer.notes.trim()}`);
  }

  lines.push("");
  lines.push("¡Gracias!");

  return lines.join("\n");
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  // wa.me exige el número sin signos: código de país + área + número, sin "+"
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
```

**Reglas de robustez del constructor:**

| Regla | Razón |
|---|---|
| `encodeURIComponent` sobre el mensaje | Los saltos de línea, tildes y `&` romperían la URL. Los saltos de línea deben ser `%0A` para que WhatsApp los respete. |
| Sanitizar el teléfono a solo dígitos | El número se configura a mano en el panel; un `+`, espacio o guion rompe el deep-link. |
| Whitespace (`*` en negrita) en nombres y totales | El cliente ve el mensaje formateado y la confirmación visual es inmediata. |
| Límite de longitud (~1800 caracteres) | Si se excede (carrito enorme con notas largas), se recorta el bloque de comentarios y se agrega `…`. WhatsApp de lo contrario trunca silenciosamente el mensaje, perdiendo datos del pedido. |
| Preferencia de encoding de fin de línea | Considerar reemplazar `\n` por `%0D%0A` si se observan saltos de línea incorrectos en versiones antiguas de WhatsApp. Verificar en dispositivo real durante QA. |

> **La especificación literal del mensaje no vive acá.** Vive en [`docs/decisiones-negocio.md` § D-01](./docs/decisiones-negocio.md#d-01--formato-del-mensaje-de-whatsapp), que es la decisión de negocio acordada con el encargado (Variante C). El código de arriba es la implementación de referencia: si diverge de D-01, **gana D-01** y se corrige el código.
>
> Reglas que el código de arriba todavía **no** implementa y que la Tarea 12 debe agregar: límite de 240 caracteres en las notas, eliminación de `*` y de caracteres de control en los campos del cliente, y truncado explícito con `…` al superar los 1800 caracteres.

### 6.4 Carga de imágenes a Cloudinary

```
Admin selecciona archivo
  │
  ├─ Validación client-side: MIME (jpg/png/webp/avif), < 6 MB
  ├─ POST /api/admin/upload  (o Server Action con FormData)
  │    ├─ verifyAdminSession()
  │    ├─ Validar file.type + file.size + dimensiones
  │    ├─ Construir timestamp = Math.floor(Date.now()/1000)
  │    ├─ signature = SHA1(`folder=modo-miga/products&public_id=${pid}&timestamp=${ts}${API_SECRET}`)
  │    ├─ POST a https://api.cloudinary.com/v1_1/{cloud}/image/upload
  │    └─ Return { publicId, secureUrl, width, height }
  ├─ Prisma UPDATE products SET imageUrl, imagePublicId
  └─ revalidateTag("products")  →  el catálogo se actualiza
```

**Reglas críticas de seguridad de imágenes:**

- ❌ **Nunca** usar *unsigned upload preset* en un panel donde cualquiera pueda alcanzarlo. Un preset unsigned con `folder: productos` es una puerta abierta: cualquiera puede subir (o sobrescribir) imágenes de la tienda.
- ✅ **Siempre** upload firmado, con la firma calculada **en el servidor** usando `CLOUDINARY_API_SECRET`. El secret nunca llega al cliente.
- Guardar siempre el `publicId` para poder destruir assets huérfanos.

**Configuración de entrega optimally:**

```ts
// next.config.ts
images: {
  remotePatterns: [
    { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
  ],
  formats: ["image/avif", "image/webp"],
}
```

```ts
// Transformación aplicada al renderizar
cloudinaryUrl(imageUrl, {
  transformation: [
    { width: 640,  crop: "fill", gravity: "auto", dpr: "auto" },  // thumbnail catálogo
    { width: 1200, crop: "fill", gravity: "auto", dpr: "auto" },  // detalle
  ],
  fetch_format: "auto",
  quality: "auto",
})
```

`gravity: "auto"` + `crop: "fill"` es crítico: el negocio sube fotos verticales desde el celular y horizontales desde otros dispositivos. Sin esto, el encuadre se recorta mal y el producto se ve mal en la mitad de las cards.

---

## 7. Directory Structure

```
webpage-cafes/
├── DESIGN.md                          # Este documento
├── README.md                          # Setup rápido, comandos, deploy
├── prisma/
│   ├── schema.prisma                  # Modelado de datos
│   ├── migrations/                    # Migraciones versionadas (generadas)
│   └── seed.ts                        # Datos iniciales (admin + categorías + menú)
├── public/
│   └── (favicon.ico, og-image.png)
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout: fonts, metadata, providers
│   │   ├── globals.css                # Tokens de diseño + Tailwind
│   │   ├── page.tsx                   # Home (hero + destacados + categorías)
│   │   ├── menu/
│   │   │   ├── page.tsx               # Catálogo completo (Server Component, ISR)
│   │   │   └── loading.tsx            # Skeleton de carga
│   │   ├── producto/
│   │   │   └── [slug]/page.tsx        # Ficha de producto
│   │   ├── checkout/
│   │   │   ├── page.tsx               # Formulario de identificación y modalidad
│   │   │   └── success/page.tsx       # Confirmación + botón de WhatsApp
│   │   ├── login/
│   │   │   └── page.tsx               # Login admin (Supabase Auth)
│   │   ├── admin/                     # ← PROTEGIDO
│   │   │   ├── layout.tsx             # verifyAdminSession() + shell con sidebar
│   │   │   ├── page.tsx               # Dashboard: resumen rápido
│   │   │   ├── productos/
│   │   │   │   ├── page.tsx           # Tabla con switches de disponibilidad
│   │   │   │   └── [id]/page.tsx      # Editor de producto (form + imagen)
│   │   │   ├── categorias/page.tsx    # CRUD de categorías
│   │   │   └── ajustes/page.tsx       # Datos del negocio y WhatsApp
│   │   ├── api/
│   │   │   ├── availability/route.ts  # GET público: estado de disponibilidad
│   │   │   └── admin/upload/route.ts  # POST: upload firmado a Cloudinary
│   │   ├── sitemap.ts                 # SEO
│   │   ├── robots.ts                  # SEO (bloquear /admin)
│   │   ├── not-found.tsx
│   │   └── error.tsx                  # Error boundary
│   ├── components/
│   │   ├── catalog/
│   │   │   ├── CategorySection.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductGrid.tsx
│   │   │   └── AvailabilityBadge.tsx  # "Agotado" / "Disponible"
│   │   ├── cart/
│   │   │   ├── CartSheet.tsx          # Drawer lateral
│   │   │   ├── CartLineItem.tsx
│   │   │   ├── CartButton.tsx         # FAB con contador
│   │   │   └── QuantityStepper.tsx
│   │   ├── checkout/
│   │   │   ├── CustomerForm.tsx
│   │   │   ├── FulfillmentPicker.tsx
│   │   │   └── OrderSummary.tsx
│   │   ├── admin/
│   │   │   ├── AvailabilitySwitch.tsx # El switch isAvailable
│   │   │   ├── ProductForm.tsx
│   │   │   ├── ImageUploader.tsx
│   │   │   ├── CategoryManager.tsx
│   │   │   └── AdminNav.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Select.tsx
│   │       ├── Sheet.tsx              # Drawer accesible
│   │       ├── Toast.tsx              # Feedback visual
│   │       └── Skeleton.tsx
│   ├── lib/
│   │   ├── prisma.ts                  # Singleton
│   │   ├── supabase/
│   │   │   ├── client.ts              # Cliente browser (realtime)
│   │   │   ├── server.ts              # Cliente server (cookies SSR)
│   │   │   └── proxy.ts              # Helpers de refresh de sesión
│   │   ├── auth/
│   │   │   ├── verify-admin.ts        # verifyAdminSession()
│   │   │   └── actions.ts             # login / logout Server Actions
│   │   ├── data/
│   │   │   ├── products.ts            # getProducts(), getProductBySlug()
│   │   │   ├── categories.ts
│   │   │   └── settings.ts
│   │   ├── actions/
│   │   │   ├── product-actions.ts     # create/update/archive/toggle
│   │   │   ├── category-actions.ts
│   │   │   └── settings-actions.ts
│   │   ├── whatsapp.ts                # buildWhatsAppMessage/Url  ← puro, testeado
│   │   ├── cloudinary.ts              # signed upload + transformaciones
│   │   ├── format.ts                  # formatARS, formatDate, slugify
│   │   ├── validation/
│   │   │   └── schemas.ts             # Schemas de Zod
│   │   └── types.ts                   # Tipos serializables (post-Decimal)
│   ├── store/
│   │   └── cart-store.ts              # Zustand + persist
│   ├── hooks/
│   │   ├── use-availability-realtime.ts
│   │   ├── use-cart.ts
│   │   └── use-media-query.ts
│   └── config/
│       ├── site.ts                    # Nombre, URLs, redes
│       └── navigation.ts              # Definición de rutas
├── proxy.ts
├── tests/
│   ├── unit/                          # Vitest
│   │   ├── whatsapp.test.ts           # ★ Prioridad alta
│   │   ├── cart-store.test.ts
│   │   └── format.test.ts
│   └── e2e/                           # Playwright (opcional, fase tardía)
└── .env.example
```

---

## 8. Development Phases

### 8.1 Vista general

| Fase | Nombre | Duración est. | Entregable verificable |
|---|---|---|---|
| **Fase 0** | Descubrimiento y Auditoría | 2–3 días | Menú digitalizado, decisiones tomadas |
| **Fase 1** | Cimientos y Modelado | 3–4 días | App desplegada, schema migrado, seed cargado |
| **Fase 2** | Catálogo Público | 4–5 días | Menú navegable y responsive con datos reales |
| **Fase 3** | Carrito y Handoff a WhatsApp | 3–4 días | Flujo completo probado en un dispositivo real |
| **Fase 4** | Panel Admin | 5–6 días | El encargado opera el negocio sin developer |
| **Fase 5** | Pulido, Seguridad y Deploy | 3–4 días | Sitio en producción, monitoreado, backup de stock |
| **Fase 6** | Buffer y Soporte | ongoing | Iteración post-lanzamiento |

**Total estimado: 24–30 días de trabajo.**

> **Principio de fases:** cada fase termina con algo **demostrable y desplegado a `main`**. Nunca se acumula trabajo sin integrar. En las fases 0–3 el sitio público se puede publicar temprano (aunque incompleto) para obtener feedback real del encargado.

### 8.2 Fase 0 — Descubrimiento y Auditoría (sin código)

**Objetivo:** eliminar la incertidumbre antes de escribir la primera línea de código. Casi todo el retrabajo en proyectos de catálogo proviene de datos no confirmados.

> 🔴 **No se hizo ninguna de estas sesiones.** El proyecto arrancó sin acceso al encargado. Los entregables de la fase están escritos y completos, pero sus valores son **simulados** (ADR-23). Todo lo de esta lista sigue pendiente, y el criterio de salida **no** está cumplido.

- [ ] Sesión con el encargado: **capturar el menú completo** (cada producto, descripción, precio, foto) — 🔴 hay un set MOCK de 23 productos
- [ ] Definir **categorías** del menú (ej. Classic, Premium, Combos, Bebidas, Postres) — 🔴 hay 5 categorías MOCK
- [ ] Confirmar **número de WhatsApp** en formato internacional (prefijo 54, sin `+`) — 🔴 `5492615000000` no está asignado
- [ ] Definir **horarios de atención** y días de cierre — 🔴 supuestos, incluido el cierre del domingo
- [ ] Definir **política de envíos**: ¿hay radio de entrega? ¿mínimo de compra? ¿horario de corte? — 🔴 5 km / 3000 ARS / corte 20:30
- [ ] Confirmar **zonas de retiro** y dirección exacta — 🔴 dirección ficticia
- [ ] Definir **métodos de pago** (efectivo, transferencia) — se comunican dentro del mensaje o en el chat — 🔴 efectivo y transferencia
- [ ] Pedir **fotos reales** de los productos en buena luz (o fotografiarlas); NO usar stock photos genéricas — 🔴 hay 23 placeholders etiquetados
- [ ] Confirmar **alérgenos** a declarar por producto — 🔴 el dato de mayor riesgo del set
- [x] Decidir si los productos tendrían **variantes** (ej. "simple" / "doble") o alcanza con cantidades → **no** (D-02); queda sin uso `ProductVariant`
- [x] Definir **nombre de usuario admin** y método de login preferido → enlace mágico por email (D-10, sujeto a confirmación)
- [ ] Verificar disponibilidad de dominio y perfil de Instagram/redes — 🔴 Instagram ficticio
- [ ] Acordar el **formato del mensaje de WhatsApp** con el encargado (probándolo a mano en su chat) — 🔴 Variante C adoptada por default (D-01), sin probar en dispositivo

**Criterio de salida:** un documento/tabla con el 100% del menú capturado, y el mensaje de ejemplo de WhatsApp acordado de forma literal. — 🔴 **No cumplido.** El documento está al 100% en *forma* y al 0% en *verificación*.

> **Salidas de esta fase** (estado actual: 🟡 entregables escritos con valores MOCK, 🔴 sin ninguna confirmación del encargado):
> - [`docs/menu-maestro.md`](./docs/menu-maestro.md) — contrato de datos cerrado, **23 productos MOCK en `DRAFT`** y 23 placeholders
> - [`docs/operacion-actual.md`](./docs/operacion-actual.md) — protocolo de medición y **línea base MOCK** de 6 días
> - [`docs/decisiones-negocio.md`](./docs/decisiones-negocio.md) — log de decisiones, formato literal del mensaje (D-01), variantes (D-02)
> - [`docs/assets/`](./docs/assets) — 23 placeholders `1600×1200` con banda visible `IMAGEN MOCK - REEMPLAZAR`
> - [x] Decidir si los productos tendrían **variantes** → **no** (D-02); queda sin uso `ProductVariant`
> - [x] Definir **método de login preferido** → enlace mágico por email (D-10, sujeto a confirmación)
>
> **Lo que sí se puede hacer sin estos datos:** la Tarea 03 (schema) y la Tarea 12 (`buildWhatsAppMessage`) dependen del contrato, no de los valores. La Tarea 05 (seed) se puede **escribir** contra el set MOCK, pero su salida es un catálogo de prueba.

### 8.3 Fase 1 — Cimientos y Modelado

**Objetivo:** app desplegada, base de datos conectada, modelo de datos vivo, y un admin capaz de iniciar sesión.

- [ ] `npx create-next-app@latest` con TypeScript, Tailwind, App Router, ESLint
- [ ] Configurar `tsconfig.json` estricto (`strict: true`, `noUncheckedIndexedAccess: true`)
- [ ] Crear proyecto en Supabase; copiar credenciales a `.env.local`
- [ ] Configurar `schema.prisma` con los modelos de [§5.2](#52-esquema-prisma)
- [ ] Instalar y configurar `prisma` y `@prisma/client`; añadir `postinstall: prisma generate`
- [ ] Implementar `lib/prisma.ts` (singleton) y verificar que no se_instance duplica en dev
- [ ] Ejecutar `prisma migrate dev` con la URL **directa**
- [ ] Crear `prisma/seed.ts` con categorías y productos de ejemplo
- [ ] Crear el usuario admin en Supabase Auth y el registro en `staff_members`
- [ ] Implementar `lib/supabase/server.ts` con `@supabase/ssr` (cookies)
- [ ] Implementar `proxy.ts` con refresh de sesión y protección de `/admin/*`
- [ ] Crear `/login` funcional: magic link **o** email+password
- [ ] Configurar Cloudinary: script de upload, `folder` dedicado, y `.env` con el API Secret
- [ ] Implementar `lib/cloudinary.ts` con firma SHA-1
- [ ] Configurar `next.config.ts` con `remotePatterns` para Cloudinary y `images.formats`
- [ ] Verificar build de producción (`npm run build`) y primer deploy a Vercel

**Criterio de salida:** deploy verificado; login admin funcionando; DB con schema aplicado; `/admin` vacío pero accesible solo por el admin.

### 8.4 Fase 2 — Catálogo Público

**Objetivo:** un menú navegable, rápido y bonito, con todos los productos reales.

- [ ] Definir tokens de diseño en `globals.css` (colores, tipografías, espaciado, radios, sombras)
- [ ] Implementar `lib/data/products.ts` con `getPublishedProducts()` usando Prisma + cache tag
- [ ] Componente `CategorySection` agrupando productos por categoría
- [ ] Componente `ProductCard`: imagen optimizada, nombre, descripción corta, precio
- [ ] Componente `AvailabilityBadge` (disponible / agotado)
- [ ] Skeletons de carga (`loading.tsx`) con la geometría real de las cards
- [ ] Página `/menu` con el catálogo completo agrupado y navegable
- [ ] Sticky category nav (scroll-snap horizontal en mobile)
- [ ] Página de producto `/producto/[slug]`: imagen grande, descripción, alérgenos, precio, CTA
- [ ] Estados vacíos: sin productos, producto no encontrado
- [ ] `generateMetadata()` por producto para SEO y previews de redes
- [ ] Verificar `next/image` en todas las imágenes con `sizes` correctos
- [ ] Auditoría de rendimiento con Lighthouse en modo móvil

**Criterio de salida:** el menú completo se ve correctamente en 360 px, 390 px, 768 px y 1280 px; Lighthouse móvil ≥ 90 en Performance.

### 8.5 Fase 3 — Carrito y Handoff a WhatsApp

**Objetivo:** el flujo completo desde agregar un producto hasta el chat abierto con el pedido listo.

- [ ] Store de carrito con Zustand + `persist` (localStorage)
- [ ] **Guard de hidratación:** leer el carrito de localStorage en `useEffect`, nunca durante el render del servidor
- [ ] `CartButton` (FAB / botón fijo) con contador de ítems y animación al agregar
- [ ] `CartSheet`: drawer con líneas, cantidad, subtotal, botón "Continuar"
- [ ] `QuantityStepper`: +/− con validación de límites (1–20 por producto)
- [ ] Eliminación de líneas con animación y confirmación visual
- [ ] Toast de confirmación al agregar al carrito (feedback háptico en móvil si es posible)
- [ ] Página `/checkout`: formulario de nombre, teléfono y modalidad (envío/retiro)
- [ ] `FulfillmentPicker`: la dirección solo es requerida si eligió envío
- [ ] Campo de notas/observaciones (opcional)
- [ ] `OrderSummary`: resumen read-only con el total calculado
- [ ] `lib/whatsapp.ts` con `buildWhatsAppMessage` y `buildWhatsAppUrl` — **funciones puras**
- [ ] Validar con Zod el payload del checkout
- [ ] Validación de teléfono argentino (formato local o internacional; normalizar a E.164)
- [ ] Página de confirmación `/checkout/success` con el botón grande de WhatsApp
- [ ] Fallback: si el popup está bloqueado, mostrar un enlace `<a>` visible para clic directo
- [ ] Manejo del caso "mensaje demasiado largo": recortar y notificar
- [ ] **Tests unitarios de `buildWhatsAppMessage`** con casos borde (carrito vacío, cantidades altas, acentos, delivery vs. retiro, notas largas)
- [ ] **QA manual en un teléfono real Android e iPhone** — no solo emulador

**Criterio de salida:** un pedido completo llega al WhatsApp del local correctamente formateado, verificado en dispositivo real por el encargado.

### 8.6 Fase 4 — Panel Admin

**Objetivo:** autosuficiencia operativa. Si el encargado necesita un developer para cambiar un precio, la fase falló.

- [ ] `admin/layout.tsx` con `verifyAdminSession()` en servidor + sidebar responsive
- [ ] `AvailabilitySwitch`: componente toggle optimista (UI responde al instante, revierte si la Server Action falla)
- [ ] Feedback claro del switch: qué cambió, si falló, si está sincronizando
- [ ] Suscripción Realtime en el panel (ver el cambio en otra pestaña inmediatamente)
- [ ] Hook `useAvailabilityRealtime` reutilizado por cliente y admin
- [ ] Tabla de productos: imagen, nombre, precio, categoría, estado, switch
- [ ] Búsqueda y filtro por categoría en la tabla
- [ ] Ordenamiento manual (`sortOrder`) con drag & drop o flechas
- [ ] Formulario de producto: nombre, slug autogenerado, descripción, precio, categoría, alérgenos, destacado
- [ ] `ImageUploader`: drag & drop, preview, progreso, error, y borrado del asset anterior
- [ ] `CategoryManager`: crear, renombrar, ordenar, ocultar; proteger borrado con productos
- [ ] `SettingsForm`: nombre, WhatsApp, dirección, horarios, mensaje de cierre, aviso legal
- [ ] Server Actions con validación Zod + `verifyAdminSession()` en cada una
- [ ] `revalidateTag("products")` en cada mutación relevante
- [ ] Confirmaciones para acciones destructivas (archivar, eliminar)
- [ ] Manejo de errores de red con mensajes accionables ("No se pudo guardar. Revisá tu conexión.")
- [ ] Estado de carga en todos los botones que disparan mutaciones

**Criterio de salida:** el encargado crea un producto nuevo con foto, lo publica, lo agota con el switch, y todo se refleja en el catálogo público sin tocar una línea de código.

### 8.7 Fase 5 — Pulido, Seguridad y Deploy a Producción

- [ ] `robots.ts` bloqueando `/admin`, `/login` y `/checkout` del rastreo
- [ ] `sitemap.xml` solo con páginas públicas
- [ ] Metadatos Open Graph y Twitter Card; imagen OG dinámica
- [ ] Página 404 de marca (no la genérica de Next)
- [ ] `error.tsx` global y por sección con mensaje útil
- [ ] Verificar que **ningún** secreto aparece en el bundle del cliente (revisar `.next/static`)
- [ ] `security headers` en `next.config.ts`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP razonable
- [ ] Configurar **políticas RLS** en todas las tablas ([§11.3](#113-políticas-rls))
- [ ] Habilitar Realtime: `alter publication supabase_realtime add table public.products;`
- [ ] Verificar que el pool de conexiones de Supabase aguanta el tráfico
- [ ] **Autenticación de dos factores (2FA)** activada para la cuenta admin
- [ ] Redirigir `www` → no-`www` (o viceversa) y forzar HTTPS
- [ ] Variables de entorno configuradas en Vercel para producción y previews
- [ ] Migraciones de producción aplicadas con `prisma migrate deploy`
- [ ] Dominio personalizado + certificado SSL
- [ ] **Prueba de humo post-deploy**: catálogo, carrito, WhatsApp, login admin, toggle
- [ ] Backup: configurar backups automáticos de Supabase; exportar el menú a CSV/JSON como red de seguridad
- [ ] Documentar el runbook: qué hacer si Cloudinary cae, si Supabase falla, si se pierde la contraseña
- [ ] Capacitación al encargado: 15 minutos, grabación de pantalla incluida

**Criterio de salida:** `https://<dominio>` en producción, testeado de punta a punta, y el encargado sabe operar el panel.

### 8.8 Fase 6 — Buffer y Soporte

- [ ] Semana 1 post-lanzamiento: monitoreo diario de errores y contactos
- [ ] Recoger feedback explícito del encargado y del cliente
- [ ] Ajustar el formato del mensaje de WhatsApp según el uso real
- [ ] Corregir los bugs priorizados por impacto real
- [ ] Documentar en el README cómo operar el panel

---

## 9. Task Breakdown

> Checklists accionables. Marcá cada ítem al completarlo. La leyenda `[F1]` indica la fase.

### 🧱 Fase 1 — Cimientos y Modelado

- [x] `[F1]` Inicializar proyecto Next.js 16 + TypeScript + Tailwind + App Router
- [ ] `[F1]` Endurecer `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`
- [ ] `[F1]` Crear `.env.example` con todas las variables documentadas
- [ ] `[F1]` Crear proyecto Supabase y configurar Auth (email habilitado, confirmar que el redirect de email esté en la whitelist de Vercel)
- [ ] `[F1]` Definir `schema.prisma` completo
- [ ] `[F1]` Migración inicial ejecutada con URL directa
- [ ] `[F1]` `seed.ts`: categorías + 3–4 productos de ejemplo con URLs de imagen reales
- [ ] `[F1]` Singleton de Prisma
- [ ] `[F1]` Cliente Supabase SSR (`@supabase/ssr`) para servidor
- [ ] `[F1]` `proxy.ts` con refresh de sesión + guard de `/admin`
- [ ] `[F1]` `verifyAdminSession()` reutilizable
- [ ] `[F1]` Crear usuario admin en Supabase Auth + registro en `staff_members`
- [ ] `[F1]` `/login` funcional con logout
- [ ] `[F1]` `lib/cloudinary.ts` con firma SHA-1
- [ ] `[F1]` `next.config.ts`: `remotePatterns`, formatos de imagen, security headers
- [ ] `[F1]` `postinstall: prisma generate` en `package.json`
- [ ] `[F1]` `npm run build` limpio
- [ ] `[F1]` Primer deploy a Vercel + variables de entorno

### 🍞 Fase 2 — Catálogo Público

- [ ] `[F2]` Paleta y tokens de diseño en `globals.css`
- [ ] `[F2]` Fuente display + fuente de texto (elegir y cargar vía `next/font`)
- [ ] `[F2]` `lib/types.ts` con el tipo `ProductDTO` (post-Decimal)
- [ ] `[F2]` `lib/data/products.ts`: `getPublishedProducts()`, `getProductBySlug()`, `getFeaturedProducts()`
- [ ] `[F2]` `lib/data/categories.ts` y `lib/data/settings.ts`
- [ ] `[F2]` `ui/Skeleton.tsx` y `menu/loading.tsx`
- [ ] `[F2]` `catalog/ProductCard.tsx` con imagen, nombre, precio, badge
- [ ] `[F2]` `catalog/CategorySection.tsx`
- [ ] `[F2]` `catalog/ProductGrid.tsx`
- [ ] `[F2]` `catalog/AvailabilityBadge.tsx`
- [ ] `[F2]` Sticky category nav con scroll-snap en mobile
- [ ] `[F2]` Página `/menu`
- [ ] `[F2]` Página `/producto/[slug]` con `generateMetadata`
- [ ] `[F2]` Estados vacíos y 404 de producto
- [ ] `[F2]` Imágenes con `next/image` + `sizes` correctos
- [ ] `[F2]` Lighthouse en modo móvil

### 🛒 Fase 3 — Carrito y WhatsApp

- [ ] `[F3]` `store/cart-store.ts` (Zustand + persist)
- [ ] `[F3]` Guard de hidratación (leer localStorage en `useEffect`)
- [ ] `[F3]` `ui/Toast.tsx` + provider
- [ ] `[F3]` `cart/CartButton.tsx` con contador y animación
- [ ] `[F3]` `cart/CartSheet.tsx` (drawer accesible: focus trap, ESC, `aria-modal`)
- [ ] `[F3]` `cart/CartLineItem.tsx`
- [ ] `[F3]` `cart/QuantityStepper.tsx` con límites
- [ ] `[F3]` Eliminación de líneas con confirmación
- [ ] `[F3]` `checkout/CustomerForm.tsx` (nombre, teléfono)
- [ ] `[F3]` `checkout/FulfillmentPicker.tsx` (envío/retiro)
- [ ] `[F3]` `checkout/OrderSummary.tsx`
- [ ] `[F3]` Validación de teléfono AR y normalización a E.164
- [ ] `[F3]` `lib/validation/schemas.ts` con Zod
- [ ] `[F3]` `lib/whatsapp.ts`: `formatARS`, `buildWhatsAppMessage`, `buildWhatsAppUrl`
- [ ] `[F3]` Manejo de longitud de mensaje (truncado seguro)
- [ ] `[F3]` Página `/checkout`
- [ ] `[F3]` Página `/checkout/success` con botón de WhatsApp + fallback `<a>`
- [ ] `[F3]` **Tests unitarios de `whatsapp.ts`** (mínimo 10 casos)
- [ ] `[F3]` Test del reducer del carrito (agregar, quitar, cambiar cantidad, limpiar, persistir)
- [ ] `[F3]` QA manual en Android e iPhone reales

### 🔐 Fase 4 — Panel Admin

- [ ] `[F4]` `admin/layout.tsx` con verificación de sesión en servidor
- [ ] `[F4]` `admin/AdminNav.tsx` responsive
- [ ] `[F4]` `admin/AvailabilitySwitch.tsx` con actualización optimista y rollback
- [ ] `[F4]` `hooks/use-availability-realtime.ts`
- [ ] `[F4]` Suscripción Realtime en el panel admin
- [ ] `[F4]` `/api/availability` (GET público, `no-store`)
- [ ] `[F4]` Habilitar publicación Realtime en la tabla `products`
- [ ] `[F4]` Tabla de productos con búsqueda y filtro
- [ ] `[F4]` `lib/actions/product-actions.ts`: create, update, archive, toggleAvailability
- [ ] `[F4]` `admin/productos/[id]/page.tsx` (editor)
- [ ] `[F4]` `admin/ProductForm.tsx` con validación Zod en cliente y servidor
- [ ] `[F4]` `admin/ImageUploader.tsx` (drag & drop + preview + progreso)
- [ ] `[F4]` `/api/admin/upload` con validación de MIME, tamaño y sesión
- [ ] `[F4]` Destrucción del asset de Cloudinary al reemplazar imagen
- [ ] `[F4]` `/admin/categorias` con `CategoryManager`
- [ ] `[F4]` `/admin/ajustes` con `SettingsForm`
- [ ] `[F4]` `revalidateTag("products")` en todas las mutaciones
- [ ] `[F4]` Confirmaciones en acciones destructivas
- [ ] `[F4]` Estados de carga y de error en todos los botones de mutación
- [ ] `[F4]` Pruebas de autorización: verificar que una sesión inválida no puede mutar

### 🚀 Fase 5 — Pulido y Producción

- [ ] `[F5]` `robots.ts` (bloquear admin, login, checkout)
- [ ] `[F5]` `sitemap.ts`
- [ ] `[F5]` Metadatos OG/Twitter e imagen social
- [ ] `[F5]` 404 y `error.tsx` de marca
- [ ] `[F5]` Security headers en `next.config.ts`
- [ ] `[F5]` Políticas RLS en todas las tablas
- [ ] `[F5]` Verificación de que no hay secretos en el bundle cliente
- [ ] `[F5]` 2FA activado en la cuenta admin
- [ ] `[F5]` Redirección de dominio + HTTPS forzado
- [ ] `[F5]` Variables de entorno en Vercel (producción y previews)
- [ ] `[F5]` `prisma migrate deploy` en producción
- [ ] `[F5]` Dominio personalizado + SSL
- [ ] `[F5]` Prueba de humo post-deploy
- [ ] `[F5]` Backups automáticos de Supabase configurados
- [ ] `[F5]` Export de seguridad del menú (CSV)
- [ ] `[F5]` Runbook de operación y contingencias
- [ ] `[F5]` Capacitación al encargado

---

## 10. UX/UI Guidelines

### 10.1 Dirección estética

**Concepto:** "artesanal, cálido, urgente". Sándwiches de miga hechos a mano en San Rafael. El diseño debe sentirse como un local pequeño y cuidado, **no** como un SaaS corporativo genérico ni como un e-commerce discount.

**Reglas anti-genéricas (importantes):**

- ❌ No gradientes morados/azules neón.
- ❌ No glassmorphism, no sombras difusas excesivas, no cards flotantes sobre fondos difuminados.
- ❌ No iconos de carrito genéricos de librería.
- ❌ No emojis usados como iconografía de UI.
- ❌ No "cards" grises sobre fondo gris. Contraste real.

**Paleta propuesta (tokens semánticos en `globals.css`):**

| Token | Valor | Uso |
|---|---|---|
| `--color-crust` | `#B85C38` | Acento primario (marrón de costra tostada) |
| `--color-crust-deep` | `#8A3E20` | Hover, estados activos |
| `--color-ink` | `#241611` | Texto principal (marrón muy oscuro, no negro puro) |
| `--color-cream` | `#FAF6F0` | Fondo de página |
| `--color-paper` | `#FFFFFF` | Fondo de cards |
| `--color-sage` | `#5C7A5E` | Disponibilidad OK, confirmación |
| `--color-amber` | `#C98A2B` | Advertencias, "últimos" |
| `--color-clay` | `#A33B2A` | Agotado, errores, destructivo |

**Tipografía:** una serif cálida con carácter para títulos (display) y una sans-serif limpia y muy legible para el cuerpo. Ambas vía `next/font` (auto-hospedadas, sin request a terceros, sin CLS). En mobile, tamaño base mínimo **16 px** para evitar el zoom automático de iOS al enfocar un input.

### 10.2 Mobile-First

> El ~95% del tráfico se genera desde el teléfono. Por lo tanto, se construye mobile-first. El desktop es la adaptación.

- **Breakpoints de trabajo:** mobile `< 768`, tablet `768–1024`, desktop `> 1024`.
- Ancho máximo del contenido: ~1200 px centrado.
- Grid de productos: **1 columna en mobile**, 2 en tablet, 3–4 en desktop.
- Todo objetivo táctil ≥ 44×44 px.
- `padding` lateral de 16–20 px en mobile; 32 px en desktop.
- Testear en 360 px (el ancho más estrecho aún relevante) para detectar desbordes.

### 10.3 Flujo del cliente y feedback

| Momento | Feedback requerido | Implementación |
|---|---|---|
| Toca "Agregar" | Confirmación inmediata | Ícono del producto con un check animado + toast breve; vibración háptica si está disponible |
| Abre el carrito | Confirmación de que hay contenido | Contador visible en el botón, incluso con el carrito cerrado |
| Cambia cantidad | Respuesta instantánea | El stepper actualiza sin delay ni spinner; el subtotal se recalcula en vivo |
| Quita un producto | Confirmación no ambigua | La línea desaparece con animación; un toast ofrece "Deshacer" durante 5 s |
| Envía el pedido | Éxito claro | Pantalla de confirmación con el resumen y un botón grande de WhatsApp |
| Producto se agota en vivo | Actualización perceptible | La card se desatura, muestra badge "Agotado" y el botón pasa a deshabilitado, sin refresh |

**Regla de oro:** ninguna acción del usuario puede quedar sin respuesta visual en menos de 100 ms. Si una mutación de red está en curso, el control afectado debe mostrar estado de carga inline — nunca deshabilitarse en silencio.

### 10.4 Accesibilidad (mínimo razonable)

- HTML semántico: `nav`, `main`, `section`, `article`, `footer`.
- El carrito es un drawer con `role="dialog"`, `aria-modal="true"`, focus trap y cierre con `ESC`.
- Todos los inputs con `<label>` asociado (no solo `placeholder`).
- Errores de validación con `aria-describedby` y `aria-invalid`.
- Foco visible en todos los elementos interactivos (no `outline: none` sin reemplazo).
- Contraste AA (4.5:1) para texto de cuerpo.
- Imágenes con `alt` descriptivo en español.
- Respetar `prefers-reduced-motion` para las animaciones.

### 10.5 Estados de UI obligatorios

Cada vista interactiva debe implementar los cinco estados. Los estados vacíos y de error son donde más sitios se ven desprolijos:

1. **Carga** — skeleton con la geometría real del contenido.
2. **Vacío** — ilustración o ícono + mensaje que explique qué hacer ("Todavía no hay productos publicados. Publicá uno desde el panel.").
3. **Error** — mensaje en español comprensible + acción de reintento. Nunca un error técnico en crudo.
4. **Éxito** — confirmación visible y persistente de la acción realizada.
5. **Deshabilitado/Agotado** — visualmente distinto, con explicación ("Sin stock por ahora").

---

## 11. Security

### 11.1 Modelo de amenazas resumido

| # | Amenaza | Vector | Mitigación |
|---|---|---|---|
| T1 | Acceso no autorizado al panel | URL directa a `/admin` | `verifyAdminSession()` en **layout + cada Server Action**; RLS; auth por email verificado |
| T2 | Manipulación de datos vía API pública | Llamada directa a Supabase REST o PostgREST | RLS denegando `INSERT/UPDATE/DELETE` al rol `anon`; el cliente no tiene credenciales de escritura |
| T3 | Secreto de DB filtrado al navegador | `NEXT_PUBLIC_` mal puesto, import accidental | Auditoría del bundle; `DIRECT_DATABASE_URL` nunca pública; Prisma solo se importa en server components/actions |
| T4 | Upload de archivo malicioso | Panel de imágenes | Upload firmado, validación de MIME y tamaño, Cloudinary como sandbox (transforma y re-sirve, sirviendo de antivirus implícito) |
| T5 | Inyección SQL | Query mal construida | Prisma parametriza por defecto; nunca usar `$queryRawUnsafe` en rutas de escritura |
| T6 | XSS | Campo de texto renderizado | React escapa por defecto; evitar `dangerouslySetInnerHTML`; sanitizar si algún día se usa |
| T7 | Abuso de recursos / spam | Route handlers públicos | Caché agresiva; rate limiting en Vercel si se observa tráfico anómalo; la única escritura pública no existe |
| T8 | Robo de sesión | Cookie de sesión sin protección | Cookies `httpOnly`, `secure`, `sameSite=lax`; 2FA en la cuenta admin |
| T9 | Enumeración de usuarios | Login | Mensajes de error genéricos; Auth por magic link como opción preferida |
| T10 | Pérdida de datos | Sin backups | Backups automáticos de Supabase + export periódico del menú |

### 11.2 Frontera de confianza

```
┌─ NAVEGADOR (no confiable) ────────────────────────────────┐
│  Bundle público: componentes, estilos, catálogo cacheado    │
│  SIN: DATABASE_URL, CLOUDINARY_API_SECRET, SERVICE_ROLE    │
└───────────────────────────────────────────────────────────┘
                            │  HTTPS
┌─ SERVIDOR (confiable) ───────────────────────────────────┐
│  Server Components / Actions / Route Handlers              │
│  Valida sesión · Valida input (Zod) · Firma uploads        │
│  Consulta DB vía Prisma (pooler)                           │
└───────────────────────────────────────────────────────────┘
                            │  mTLS / Pooler
┌─ SUPABASE ───────────────────────────────────────────────┐
│  Postgres (Prisma: rol postgres, bypasea RLS)             │
│  Auth + Realtime + REST (supabase-js: rol anon/authed)    │
│  → RLS se aplica SOLO en el camino supabase-js             │
└───────────────────────────────────────────────────────────┘
```

**Invariante de diseño:** ninguna mutación del catálogo es posible desde el cliente. El navegador únicamente *dispara intents* contra Server Actions, que revalidan sesión y payload antes de tocar la base. Esto hace que el bypass de RLS por parte de Prisma sea irrelevante en términos de escritura.

### 11.3 Políticas RLS

```sql
-- Activar RLS en todas las tablas (una por vez)
alter table public.products        enable row level security;
alter table public.categories      enable row level security;
alter table public.product_variants enable row level security;
alter table public.business_settings enable row level security;
alter table public.staff_members    enable row level security;

-- Lectura pública: solo productos publicados
create policy "anon_read_published_products"
  on public.products for select
  to anon, authenticated
  using (status = 'PUBLISHED');

-- El cliente no puede escribir NUNCA
-- (sin policy de INSERT/UPDATE/DELETE = denegado por defecto)

-- El menú y las categorías se pueden leer públicamente
create policy "anon_read_visible_categories"
  on public.categories for select
  to anon, authenticated
  using ("isVisible" = true);

create policy "anon_read_settings"
  on public.business_settings for select
  to anon, authenticated
  using (true);

-- El staff no puede leer el directorio de staff vía API pública
-- (staff_members queda sin policy de select para anon/authenticated)

-- Realtime: publicar la tabla de productos
alter publication supabase_realtime add table public.products;
```

> **Nota sobre Realtime + RLS:** Supabase verifica las políticas RLS del suscriptor antes de entregar cada evento. Con la policy de lectura pública sobre `products`, los clientes anónimos recibirán los cambios de disponibilidad (que es exactamente lo deseado) pero ningún otro dato.

### 11.4 Buenas prácticas de implementación

- **Session validation ≠ session existence.** `getSession()` lee la cookie (no verificable); `getUser()` va al servidor de Auth (verificable). **Usar siempre `getUser()`** en rutas protegidas.
- **Server Actions siempre validadas.** Nunca confiar en el input del cliente, aunque el formulario ya valide. Re-validar con Zod en el servidor.
- **Denegar por defecto.** Lo que no está explícitamente permitido está prohibido. Sin policies de escritura, la escritura está bloqueada.
- **Rotar credenciales.** Rotar `CLOUDINARY_API_SECRET` y la `SERVICE_ROLE_KEY` si alguna vez se filtran. La `anon key` puede quedar pública sin riesgo por diseño de RLS.
- **Loguear lo que importa** en el panel admin (cambios de precio, publicación, archivado), sin datos sensibles.

---

## 12. Performance & SEO

### 12.1 Presupuesto de performance

| Métrica | Objetivo (móvil, 4G emulada) |
|---|---|
| LCP (Largest Contentful Paint) | < 2.5 s |
| INP (Interaction to Next Paint) | < 200 ms |
| CLS (Cumulative Layout Shift) | < 0.1 |
| TBT | < 600 ms |
| Lighthouse Performance | ≥ 90 |

### 12.2 Técnicas aplicadas

| Técnica | Detalle |
|---|---|
| **RSC por defecto** | El catálogo se renderiza en el servidor. El JS enviado al cliente es mínimo. |
| **ISR con tags** | `export const revalidate` + `unstable_cache` con tag `products`. El catálogo se sirve desde la edge de Vercel. |
| **Capas de datos separadas** | La disponibilidad en vivo no invalida la caché del contenido ([§6.1](#61-flujo-de-lectura-del-catálogo-optimizado-para-caché)). |
| **next/image + Cloudinary** | `AVIF`/`WebP` automático, `q_auto`, `dpr=auto`, `sizes` por breakpoint, placeholder blur. |
| **Fuentes con `next/font`** | Auto-hospedadas, `display: swap`, preload de la fuente principal, sin CLS. |
| **Zustand sobre Context** | Un solo listener de hidratación en lugar de propagar contexto por todo el árbol. |
| **Route handler con `no-store`** | `/api/availability` explícitamente sin caché. |
| **Sin librería de animaciones pesada** | Transiciones CSS de 150–200 ms. `prefers-reduced-motion` respetado. |

### 12.3 SEO local (el motor de descubrimiento real de un local)

- Títulos y descripciones únicos por página y por producto.
- Datos estructurados **JSON-LD `Restaurant`** con nombre, dirección, horarios, menú y URL de Google Maps.
- `sitemap.xml` con home, menú y productos publicados (excluir borradores y archivados).
- `robots.txt` bloqueando `/admin`, `/login`, `/api`, `/checkout`.
- URLs limpias y estables: `/producto/[slug]`. Un slug no se cambia una vez publicado (o se crea un redirect 301).
- Imagen Open Graph de 1200×630 para previews en WhatsApp e Instagram (**relevante: es el mismo canal donde viven los clientes**).
- Enlace a Instagram desde el header y el footer.

---

## 13. Testing Strategy

### 13.1 Enfoque

El valor de este negocio está en que **el pedido llegue bien formateado a WhatsApp** y en que **el switch de disponibilidad sea confiable**. Esas dos cosas son exactamente donde debe estar la cobertura de tests. Los tests de UI decorativa tienen retorno de inversión casi nulo para un catálogo de sándwiches.

### 13.2 Plan por capa

| Capa | Alcance | Herramienta | Prioridad |
|---|---|---|---|
| **Unitarios** | `buildWhatsAppMessage`, `buildWhatsAppUrl`, `formatARS`, `slugify`, normalización de teléfono, reducer del carrito | Vitest | **Alta** |
| **Integración** | Server Actions de producto con sesión mockeada (autorización) | Vitest | **Alta** |
| **Componentes** | `AvailabilitySwitch` (estado optimista + rollback), `QuantityStepper` | Testing Library | Media |
| **E2E** | Flujo completo: menú → carrito → checkout → URL de WhatsApp correcta | Playwright | Media (fase tardía) |
| **Manual** | QA en dispositivos reales; verificación del mensaje en WhatsApp app real | Humano | **Crítica** |

### 13.3 Casos de prueba prioritarios para `whatsapp.ts`

| # | Caso | Resultado esperado |
|---|---|---|
| 1 | Un solo producto, qty 1, retiro | Mensaje con total correcto, "Retiro en el local", sin sección de dirección |
| 2 | Múltiples productos con acentos | "Jamon de queso" sin `Ã³`; encoding correcto en la URL |
| 3 | Envío con dirección que contiene `#` y `&` | URL válida; el `&` no trunca el parámetro |
| 4 | Producto con variante | La línea incluye `(Doble)` y el precio ya ajustado |
| 5 | Notas con saltos de línea | Se conservan los saltos y no rompen el formato |
| 6 | Carrito vacío | Retorna un mensaje de error controlado, no un string vacío |
| 7 | Mensaje > 1800 caracteres | Se trunca con aviso explícito, no silenciosamente |
| 8 | Teléfono con formato `+54 261 555-1234` | `buildWhatsAppUrl` produce `wa.me/542615551234` |
| 9 | Teléfono con guiones/espacios | Mismo resultado normalizado |
| 10 | Carrito con cantidades altas (20 unidades) | Cantidades y totales exactos, sin errores de punto flotante |

> El caso 10 es especialmente relevante: `0.1 + 0.2 !== 0.3` en punto flotante. Los totales deben calcularse sobre valores ya redondeados a 2 decimales.

### 13.4 Quality Gates

Cada pull request debe pasar:

```bash
npm run lint        # ESLint, sin warnings
npm run typecheck   # tsc --noEmit, sin errores
npm run test        # Vitest en modo watch=false
npm run build       # Build de producción
```

---

## 14. Environment Variables

| Variable | Ejemplo | Expuesta al cliente | Propósito |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.xxx:***@aws-0-sa-east-1.pooler.supabase.com:6543/postgres` | ❌ | Prisma en runtime (pooler) |
| `DIRECT_DATABASE_URL` | `postgresql://postgres.xxx:***@db.xxx.supabase.co:5432/postgres` | ❌ | Migraciones |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | ✅ | URL pública de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | ✅ | Anon key (segura si RLS está activa) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | ❌ | Operaciones administrativas puntuales |
| `CLOUDINARY_CLOUD_NAME` | `modo-miga` | ❌ | Identificador del cloud |
| `CLOUDINARY_API_KEY` | `123456789012345` | ❌ | Upload firmado |
| `CLOUDINARY_API_SECRET` | `***` | ❌ | **Firma de uploads. Nunca exponer.** |
| `NEXT_PUBLIC_SITE_URL` | `https://modomiga.com.ar` | ✅ | URL canónica (metadata, sitemap) |

**Regla:** el prefijo `NEXT_PUBLIC_` es una declaración pública irreversible. Antes de agregarlo, preguntarse si el valor puede quedar expuesto en el bundle. La `ANON_KEY` sí puede (por diseño de RLS); `SERVICE_ROLE_KEY` **jamás** (bypasea todas las políticas).

---

## 15. Deployment & Operations

### 15.1 Entornos

| Entorno | Rama | Datos | Propósito |
|---|---|---|---|
| **Local** | — | Supabase branch de desarrollo | Desarrollo diario; datos de prueba |
| **Preview** | cualquier rama | **La misma DB de desarrollo** | Revisión visual antes de mergear |
| **Production** | `main` | DB de producción | Sitio público |

> Usar [Supabase branching](https://supabase.com/docs/guides/deployment/database-branching) permite migraciones en `dev` sin riesgo. Si no se usa branching, al menos asegurar que las migraciones se appliquen solo manualmente a producción.

### 15.2 Pipeline de despliegue

```
git push (rama) → Vercel Preview Build
                   ├─ npm ci
                   ├─ prisma generate      (postinstall)
                   ├─ next build
                   └─ Preview URL
                        ↓ revisión manual
git merge a main  → Vercel Production Build
                   ├─ prisma migrate deploy  (solo si hay migraciones)
                   └─ producción
```

> **Advertencia sobre `prisma migrate deploy` en el build de Vercel:** si múltiples previews se despliegan simultáneamente contra la misma DB de desarrollo, las migraciones pueden entrar en conflicto. Solución recomendada: **aplicar migraciones manualmente** (`npx prisma migrate deploy` desde la máquina local) y dejar que el build solo ejecute `prisma generate`. Alternativa: usar el comando de migrate como paso previo en CI con un lock.

### 15.3 Checklist de operación

- [ ] Backups automáticos de Supabase habilitados (retención ≥ 7 días)
- [ ] Export mensual del menú a CSV/JSON
- [ ] Monitoreo de errores:Vercel Analytics (incluye error boundaries de React) + uptime check externo
- [ ] Alertas ante caída de `/menu`
- [ ] Alerta por uso anómalo de la DB (pool cercano al límite)
- [ ] Runbook escrito con: qué hacer si Cloudinary falla, si Supabase no responde, si se pierde el acceso admin

---

## 16. KPIs & Analytics

Privacidad primero: **no se instala ningún tracker de terceros**. La analítica usa un evento propio y sin cookies si en el futuro hace falta medir conversión, o directamente las métricas del hosting.

| KPI | Cómo se mide | Meta |
|---|---|---|
| Pedidos iniciados en la web | Contador de clics en el botón de WhatsApp (endpoint propio) | Tendencia creciente |
| Tasa de finalización del checkout | Pedidos iniciados vs. pedidos enviados | ≥ 70% |
| Tiempo medio de armado del pedido | Fecha de primer `view` de menú vs. fecha del clic de envío | Objetivo < 2 min |
| Productos con mayor Rotación de `isAvailable` | Registro de eventos de toggle | Identificar productos problemáticos |
| Mensajes "informativos" diarios | Conteo manual en el chat (línea base de la Fase 0) | Reducción ≥ 70% |
| Disponibilidad real del sitio | Uptime check externo | ≥ 99.5% |
| Errores de Server Action | Logs de Vercel | Tendencia a 0 |

**Línea base obligatoria en Fase 0:** contar durante 7 días completos cuántos mensajes diarios son puramente informativos (precio, disponibilidad, horarios) y cuántos son pedidos reales. Sin esa línea base, es imposible demostrar el OB-1.

### 16.1 Línea base medida (Fase 0 — Tarea 00)

> 🔴 **Estado: línea base MOCK, medición real pendiente.** El relevamiento de 7 días naturales **no se realizó**: no hubo datos del negocio. El protocolo, la clasificación de mensajes y la planilla están en [`docs/operacion-actual.md`](./docs/operacion-actual.md), y el bloque de abajo está cargado con números **simulados** para poder dimensionar el resto del trabajo.
>
> **Este bloque se reemplaza en bloque, no se edita "un poco".** O es la línea base medida, o es una simulación, y tiene que decir cuál. Mientras diga MOCK, **el OB-1 no se puede declarar cumplido**.

**Línea base medida (Fase 0, Tarea 00):** período `14` – `19` de septiembre de 2026, `6` días de atención (el domingo `20/09` el local estaba cerrado y se excluye del promedio).
Promedio de `39.8` mensajes diarios totales, de los cuales **`24.5` son informativos** (`61.5%`) y `10.3` son pedidos reales. Tickets promedio: `6.5` mensajes por pedido (recibidos + enviados). Pedidos perdidos por rotura de stock: `2` en la semana.
**Meta a 30 días post-lanzamiento: ≤ `7.4` mensajes informativos diarios** (OB-1).

| KPI con línea base | Origen | Valor MOCK |
|---|---|---|
| Mensajes diarios totales | `docs/operacion-actual.md` §4 | `39.8` |
| Mensajes informativos diarios | `docs/operacion-actual.md` §4 | `24.5` |
| Porcentaje de mensajes informativos | `docs/operacion-actual.md` §4 | `61.5%` |
| Tickets promedio por pedido | `docs/operacion-actual.md` §4 | `6.5` |
| Pedidos perdidos por rotura de stock | `docs/operacion-actual.md` §4 | `2` / semana |
| Pedidos incompletos (OB-2) | — | **Sin medir.** No se inventó un número: requiere ver chats reales |

> **El ticket promedio cuenta recibidos y enviados.** El trabajo del encargado está en lo que responde, no en lo que recibe: calcularlo solo con mensajes recibidos da 3.9 en esta semana, menos de la mitad del esfuerzo real, y exagera la mejora del OB-4.

---

## 17. Risks & Mitigations

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | **Prisma agota el pool de conexiones** de Supabase en serverless | Alta | Crítica | Pooler en modo transaction (puerto 6543) como `DATABASE_URL`; `directUrl` solo para migraciones. Singleton de Prisma. Verificado en Fase 1. |
| R2 | **El mensaje de WhatsApp se rompe** en algún dispositivo (saltos de línea, caracteres) | Media | Alta | `encodeURIComponent`; suite de tests unitarios; QA en Android e iPhone reales antes del deploy. |
| R3 | **El carrito se corrompe** con un `localStorage` antiguo o manipulado | Media | Media | Validar el estado persistido con Zod al rehidratar; descartar y reiniciar si falla el parseo. |
| R4 | **Desajuste de hidratación** por leer `localStorage` durante el render | Alta | Media | Leer el carrito siempre en `useEffect`; el estado inicial en el servidor es siempre `[]`. |
| R5 | **`Prisma.Decimal` no serializable** hacia Client Components | Alta | Alta | DTOs explícitos en `lib/types.ts` con `.toNumber()` en el límite. Definir esto en Fase 1, no descubrirlo en Fase 2. |
| R6 | **RLS ByPaseada por Prisma** → exposición de borradores | Media | Alta | Filtrar por `status` en la query de Prisma (no confiar solo en RLS); auditar queries. |
| R7 | **Cloudinary rechaza el build** por formato de URL en `next/image` | Baja | Media | `remotePatterns` correcto; validar en Fase 1 con una imagen real. |
| R8 | **El botón de WhatsApp no abre la app** en un dispositivo | Media | Media | Usar `wa.me` (estándar, funciona en web y nativo); fallback a enlace `<a>` visible si el popup se bloquea. |
| R9 | **Scope creep** (el cliente empieza a pedir pagos, cuentas de usuario, etc.) | Alta | Media | Sección explícita [§3.2](#32-out-of-scope-v1--backlog-candidato); toda funcionalidad nueva se cotiza aparte. |
| R10 | **El encargado no adopta el panel** y sigue anotando pedidos a mano | Media | Alta | Fase 0 incluye conocer su flujo real; panel deliberadamente simple; capacitación; el catálogo público le ahorra trabajo aunque no lo use. |
| R11 | **Coste de Cloudinary** por assets huérfanos en cada cambio de foto | Baja | Baja | Guardar `imagePublicId` y destruir el asset anterior al reemplazar. |
| R12 | **La base se llena de productos `DRAFT`** porque nadie publica | Media | Baja | El panel muestra un recordatorio de productos sin publicar; `/menu` solo muestra `PUBLISHED`. |
| R13 | **Migración conflictiva** entre previews y producción | Media | Alta | Migraciones aplicadas por comando explícito, no automáticamente en cada build. |
| R14 | **Sin repositorio** (el trabajo queda en una sola máquina) | Media | Alta | `git init` en la Fase 1, commits frecuentes, README actualizado. |

---

## 18. Decisiones Técnicas Consolidadas (ADR Log)

Registro de decisiones para evitar reconsideraciones estériles durante el desarrollo.

| # | Decisión | Alternativas descartadas | Motivo |
|---|---|---|---|
| ADR-1 | Next.js App Router con RSC | Pages Router, SPA con Vite, otro framework | Server Components reducen el JS del cliente, el SEO y el LCP son gratis. Un solo proyecto para todo. |
| ADR-2 | Handoff por deep-link `wa.me` | WhatsApp Business Platform API, backend que envía mensajes | Cero costo, cero templates, cero webhooks, cero tokens. La conversación queda donde ya está. |
| ADR-3 | Sin pagos online | Mercado Pago, Stripe | Requisito explícito del negocio. El pago se coordina en el chat, que es el flujo real actual. |
| ADR-4 | Sin tabla `Order` en v1 | Persistir todos los pedidos | WhatsApp es el sistema de registro real. Una tabla sin consumidor crea dos fuentes de verdad. Retrofitable después. |
| ADR-5 | Prisma sobre el pooler, con `directUrl` para migraciones | Solo conexión directa, solo pooler | La conexión directa desde serverless agota el pool; el pooler rompe `migrate`. Ambos son necesarios y con roles distintos. |
| ADR-6 | Dos clientes de datos (Prisma + supabase-js) | Solo Prisma, solo supabase-js | Prisma para queries tipadas y migraciones; supabase-js para Auth y Realtime (que Prisma no soporta sobre PgBouncer). |
| ADR-7 | Disponibilidad en capa de cliente, no en caché del HTML | Disponibilidad leída del HTML con ISR | Evita invalidar el catálogo completo en cada toggle; permite propagación < 2 s sin recargar. |
| ADR-8 | Realtime de Supabase | Polling, refetch manual, WebSocket propio | Una línea de código, infraestructura gestionada, < 2 s de latencia. |
| ADR-9 | `isAvailable` separado de `status` | Un solo campo `isActive` | Editorial (publicación) y operativo (stock) son ejes distintos. Mezclarlos fuerza workarounds. |
| ADR-10 | Upload firmado de Cloudinary | Preset unsigned, `<input type="file">` directo a Cloudinary | Un preset unsigned es una vía abierta de subida desde cualquier origen. La firma se calcula solo en el servidor. |
| ADR-11 | Zustand para el carrito | React Context, Redux, estado en la URL | Persistencia en localStorage incluida, sin boilerplate, un solo punto de hidratación. |
| ~~ADR-12~~ | ~~Componentes de UI propios~~ — **DEROGADA por ADR-25** | shadcn/ui, MUI, Chakra | ~~La identidad visual vive en la foto y la tipografía, no en una librería. Cero KB extra.~~ |
| ADR-25 | **Arc UI (uiarc.dev) como sistema de componentes** (deroga ADR-12) | Seguir con primitivas propias, shadcn/ui plano | La premisa de ADR-12 era cierta y se mantiene: la identidad sigue viviendo en la foto y la tipografía — por eso los tokens de marca (paleta crust/cream/ink, Fraunces + Inter, radios, sombras "con dirección") se mapearon a los roles semánticos de Arc y Tailwind delega en ellos (`@theme` → variables CSS). Lo que ADR-12 subestimó es el costo real de mantener a mano focus traps, retorno de foco, drag-to-dismiss y animaciones con `prefers-reduced-motion`: Arc (Radix + Motion, código vendor en `src/components/arc/`, instalado vía CLI shadcn) lo resuelve con calidad de biblioteca. Además se gana dark mode nativo (`data-theme`) sin bifurcar el CSS. Los componentes `src/components/ui/` quedan como fachada estable: la API pública no cambió, solo el motor. |
| ADR-13 | Validación de input en cliente **y** servidor | Solo cliente, solo servidor | La validación de cliente es UX; la de servidor es seguridad. La de servidor es la que importa. |
| ADR-14 | `Decimal` para precio | `Float`, `Int` en centavos | `numeric` nativo de Postgres, sin errores de punto flotante. Requiere el DTO serializer para RSC. |
| ADR-15 | Tailwind v4 | CSS Modules, CSS-in-JS | Consistencia visual sin decisiones repetidas, sin runtime, y el resultado se lee en el markup. |
| ADR-16 | Sin librería de analytics | Google Analytics, Plausible, PostHog | Privacidad, y el volumen no justifica un tracker. Las métricas del hosting y un evento propio alcanzan. |
| ADR-17 | Deploy en Vercel | Servidor propio, Cloudflare, Railway | El modelo serverless de Vercel + el pooler de Supabase resuelven el problema de conexiones sin infraestructura propia. |
| ADR-18 | Deploy en Vercel | Vercel Hobby vs. plan pago | El hobby tiene límite de 100 builds/día; para este volumen alcanza. Migrar a Pro solo si el build falla por cuota. |
| ADR-19 | Sitemap y `robots` generados por código | Manuales, plugin de terceros | Es un catálogo dinámico; un XML manual se desactualiza en el primer día. |
| ADR-20 | Pre-orden sin slot de horario | Sistema de horarios y ventanas de retiro | El negocio no lo pidió; el horario se conversa por chat. YAGNI. |
| ADR-21 | **Sin variantes de producto en v1** | `ProductVariant` + CRUD de variantes | El menú de miga se resuelve con cantidades y notas ([D-02](./docs/decisiones-negocio.md)). Agregarlas después es un CRUD en el panel, no una migración: la tabla queda en el schema sin uso. |
| ADR-22 | **El precio del carrito es una instantánea del cliente** | Revalidar precios contra el servidor antes de enviar | Evita un endpoint público extra y una capa de invalidación de líneas ([D-13](./docs/decisiones-negocio.md)). El precio se acuerda en el chat, que es el canal real. El riesgo real es un cambio de precio en la misma hora del pedido, que se resuelve conversando. |
| ADR-23 | **El catálogo se siembra con datos MOCK etiquetados, en `DRAFT`, detrás de un flag** | 1. Esperar los datos reales y no arrancar · 2. Sembrar datos inventados como si fueran reales | No hay datos reales del negocio ([`docs/menu-maestro.md`](./docs/menu-maestro.md) 🔴). Sin esto, las Tareas 02–16 no se pueden escribir ni probar. El costo se acota con cuatro condiciones: banner 🔴 en la documentación, `status: DRAFT` en las 23 filas, publicación solo con `SEED_PUBLISH_MOCK=true`, y destinos inválidos (número inexistente, dominio `.invalid`). La alternativa 1 dejaba el proyecto entero bloqueado; la 2 es exactamente el fallo que este ADR previene. El mock **no habilita el lanzamiento**: la Tarea 00 sigue en 🟡. |
| ADR-24 | **Glosario de alérgenos ampliado con `pescado`** | Mantener las 7 claves de la Tarea 00 y quitar Atún y Salmón del set | Declarar `pescado` es una decisión de seguridad de la información: sin esa clave, un cliente que no puede comer pescado no ve la advertencia en ninguno de los 2 productos que lo contienen. Un filtro de alérgenos que deja pasar lo que debe filtrar es peor que no tener filtro. La opción de quitar los productos queda documentada en [`docs/menu-maestro.md`](./docs/menu-maestro.md) §5 por si el encargado prefiere el glosario de 7 claves. |

---

## Apéndice A — Glosario

| Término | Significado en este proyecto |
|---|---|
| **Deep-link** | URL que abre directamente una conversación de WhatsApp con un mensaje precargado. |
| **RLS** | Row Level Security; políticas de control de acceso por fila en PostgreSQL. |
| **PgBouncer** | Pooler de conexiones; multiplexa muchas conexiones de aplicación sobre pocas conexiones reales. |
| **Transaction mode** | Modo de PgBouncer que presta una conexión por transacción; el más seguro para serverless. |
| **Handoff** | Punto donde el sistema entrega el pedido al canal humano (WhatsApp) y deja de intervenir. |
| **ISR** | Incremental Static Regeneration; HTML estático regenerado en background. |
| **SKU** | Código único de un producto. No se usa en v1 (el slug basta). |
| **YAGNI** | "You Ain't Gonna Need It"; no construir lo que no se pidió. |
| **Stockout** | Momento en que un producto se agota y debe ocultarse del catálogo. |

## Apéndice B — Checklist de arranque rápido

```bash
# 1. Clonar e instalar
cp .env.example .env.local     # Completar con las credenciales reales
npm install

# 2. Base de datos
npx prisma migrate dev --name init
npx prisma db seed

# 3. Desarrollo
npm run dev                    # http://localhost:3000

# 4. Quality gates
npm run lint && npm run typecheck && npm run test

# 5. Producción
npm run build
npx prisma migrate deploy
```

**Variables que hay que tener a mano antes de empezar la Fase 1:**

- [ ] Project URL y anon key de Supabase
- [ ] Connection string del pooler (puerto 6543) y directa (5432)
- [ ] Cloud name, API key y API secret de Cloudinary
- [ ] Número de WhatsApp del local en E.164 (`5492615xxxxxx`) 🔴 hoy hay un MOCK en `5492615000000`
- [ ] Menú completo capturado (Fase 0) 🔴 hoy hay un set MOCK de 23 productos
- [ ] Email del administrador para Supabase Auth 🔴 hoy hay `dueno@modo-miga.invalid` (RFC 2606, no resuelve en DNS)
