# Estrategia de pruebas

Referencia operativa de la Tarea 20. El documento de la tarea dice **qué** se
quiere probar; este dice **qué se corrió, contra qué y con qué números**.

## Los tres proyectos

Vitest corre tres proyectos ([`vitest.config.ts`](../vitest.config.ts)). No es
una organización estética: cada proyecto tiene un requisito distinto y una
manera distinta de fallar.

| Proyecto | Qué corre | Entorno | Base | Paralelismo |
|---|---|---|---|---|
| `unit` | `tests/unit/**` y `src/**/*.test.ts` | `node` | No abre conexión | Paralelo |
| `integracion` | `tests/integration/**` | `node` | Postgres real | `fileParallelism: false`, `maxWorkers: 1` |
| `ui` | `src/**/*.component.test.tsx` | `jsdom` | No abre conexión | Paralelo |

El proyecto `unit` **no** tiene `setupFiles` a propósito: un test de lógica pura
que necesita variables de entorno es un test que va a fallar en la máquina de
alguien y no en la tuya.

`integracion` va serializado porque los archivos comparten una base y cada uno
hace `TRUNCATE` en su `beforeEach`. En paralelo se borran la base mutuamente y
el error aparece como un `expect` que no cuadra, que es la forma más cara de
diagnosticar un problema de aislamiento.

## Comandos

```bash
npm run test              # los tres proyectos, como se corre en local
npm run test:unit         # sólo lógica pura: ni base ni .env
npm run test:ui           # sólo componentes, en jsdom
npm run test:integracion  # sólo integración: NECESITA la base levantada
npm run test:coverage     # mide src/lib/** y src/server/services/**
npm run test:ci           # unit → ui → integracion, en ese orden
```

`test:integracion` **falla al arrancar** si falta `DATABASE_URL` o
`DIRECT_DATABASE_URL`, y el mensaje dice cuál. Un `P1001` tres minutos después,
en el primer `beforeEach`, cuesta el doble de entender.

## Cobertura

El umbral mide `src/lib/**/*.ts` y `src/server/services/**/*.ts`:

| Métrica | Umbral | Actual |
|---|---|---|
| Líneas | 80 % | **93,67 %** (607/648) |
| Statements | 80 % | **92,88 %** (666/717) |
| Branches | 80 % | **88,68 %** (392/442) |
| Funciones | 85 % | **91,32 %** (158/173) |

Medido con `npm run test:coverage`, que corre los tres proyectos: los tests de
integración también tocan los servicios y por eso el número sube respecto de
`test:unit --coverage` a secas (92,74 / 91,91 / 86,65 / 89,01). Los repositorios, la
infraestructura, los Server Components y la presentación quedan **afuera**, y
el motivo está escrito en el archivo de configuración: los repositorios se
prueban contra la base real en `integracion`, y una suite de integración no
necesita que el umbral también los cuente.

### El umbral sólo baja agregando tests

Las funciones estaban en **84,39 %**, medio punto debajo del 85 % que pedía el
documento. No se bajó el número: se escribió
`tests/unit/services/category-admin.service.test.ts`, que ejercita el slug
congelado, el `ConflictError` del borrado y `camposEditadosDeCategoria`. Subir
el umbral después es un commit propio.

### Qué NO es cobertura

Un test que pasa con el cuerpo de la función vaciado se borra. La cobertura mide
que una línea se ejecutó, no que nadie la rompa; por eso el valor de la suite es
**qué clase de bug atrapa cada archivo** y no el porcentaje. Un archivo que no
aparece en la lista de abajo es un archivo que hay que revisar.

## Qué prueba cada archivo nuevo

| Archivo | Atrapa |
|---|---|
| `tests/unit/actions/autorizacion.test.ts` | Una action que autoriza después de leer el payload, o que delega sin sesión. Los nueve rechazos se prueban con un payload que **no** parsea: si una action lo mirara primero, el doble del servicio lo detectaría. También `STAFF` contra los ajustes del negocio, y el orden servicio → auditoría. |
| `tests/integration/verify-admin.test.ts` | Que la fila de `staff_members` deje de ser la segunda capa. Se prueba **contra la base real** y el único módulo doblado es `@/server/infra/supabase/server`: `findStaffById` es Prisma de verdad. Borrar la fila y ver caer la sesión es lo que demuestra que el test no se auto-confirma. |
| `tests/unit/cart/consistencia-de-totales.test.ts` | Que el total del carrito y el del mensaje de WhatsApp diverjan, y que el `priceDelta` de una variante se aplique dos veces al cruzar del carrito al pedido. |
| `tests/unit/services/category-admin.service.test.ts` | El slug congelado en una categoría con productos, el borrado que no debe tocar la base, y el log de campos editados. |

Los archivos movidos de `src/` a `tests/unit/` conservan su contenido: sólo
cambiaron los imports de relativos a alias.

## No se agregan tests de UI decorativa

Los 18 `.component.test.tsx` de la Tarea 09 cubren accesibilidad de primitivas
(foco atrapado, `Escape`, roles) y no se tocaron. **No se agregar tests de UI
decorativa**: si un componente se ve bien o se ve mal, eso lo decide una
persona mirando la pantalla, y un test que afirma el color de un borde es un
test que hay que actualizar cada vez que se toca el diseño sin que ninguna de sus
aserciones detecte un error real.

Un test de componente entra al proyecto `ui` por convención de sufijo, no por
una lista de rutas. Por eso `rg --files -g '*.test.ts' src/` tiene que devolver
nada: si alguien pega un test de lógica en `src/`, ese comando lo delata.

## Playwright: condicional y apagado

**No se adopta Playwright todavía**, y el job de CI no existe. El criterio para
reconsiderarlo es concreto, y se cumple todo junto:

1. Aparecen **al menos dos bugs** que sólo se reproducen en un navegador real —
   no en el contrato de un componente, no en la base, no en la lógica.
2. El recorrido del checkout está **estable**: la Tarea 00 sigue con el menú y
   los precios MOCK, y un E2E sobre datos que van a cambiar es un E2E que se
   rompe sin que nadie haya escrito una línea mala.
3. Existe un **entorno donde correrlo** contra el que uno comparable: hoy el
   despliegue es manual y no hay URL estable.

Si alguno de los tres deja de cumplirse, se escribe el job con la variable
`E2E` del repositorio en `"true"` y apagada por defecto. Un job opcional que se
vuelve obligatorio termina deshabilitado por todos.

## El pipeline

Dos jobs, y la separación no es estética: el primero no necesita secretos.

| Job | Corre | Necesita |
|---|---|---|
| `calidad` | `lint`, `typecheck`, `test:unit --coverage`, `test:ui`, `build` | Nada |
| `integracion` | stub de roles, `migrate deploy`, `test:integracion`, `verify:actions` | Un Postgres 16 |

### El stub de roles va antes de las migraciones

[`tests/infra/roles-y-auth-stub.sql`](../tests/infra/roles-y-auth-stub.sql) crea
los roles `anon` y `authenticated` y las funciones `auth.uid()` y `auth.jwt()`.
**Nunca se aplica en Supabase**: es sólo para el Postgres de Docker del runner.

Va antes de `prisma migrate deploy` porque la migración
`20261003184300_rls_y_lectura_realtime` está escrita con guardas
`IF EXISTS (rol 'authenticated') AND to_regprocedure('auth.uid()')`. Sin el
stub, las guardas son falsas, la migración pasa igual, y la base queda con **RLS
activo y cero políticas**: toda lectura devuelve vacío y los tests de
autorización pasan mintiendo.

Comprobado sobre una base nueva: **sin el stub, 0 políticas; con el stub, 2.**

### La auditoría de secretos no pasa en verde por no hacer nada

`npm run audit:bundle` busca el **valor** de las cinco variables sensibles en
`.next/static`. En el pipeline los valores son de mentira, así que no hay nada
real contra qué comparar, y el job de calidad lo declara explícitamente con
`AUDITAR_BUNDLE_SIN_SECRETOS: "1"`.

Sin esa marca el script **falla** diciendo qué no pudo verificar. Un script de
auditoría que pasa porque no encontró nada es peor que un script que no existe:
la diferencia entre "no hay secretos" y "no miré".

La auditoría que sí importa corre en el despliegue, con secretos de producción.

### `npm run audit:deps` no corta el pipeline

`npm audit` marca vulnerabilidades en dependencias transitivas que no se pueden
arreglar sin romper el lockfile. Un rojo permanente en ese paso entrena al
equipo a ignorar el job entero, así que está como paso informativo
(`continue-on-error`). La decisión de subir o no una dependencia es de una
persona, no de un semáforo.

## La suite completa, hoy

| Proyecto | Archivos | Tests |
|---|---|---|
| `unit` | 41 | 376 |
| `ui` | 18 | 77 |
| `integracion` | 4 | 34 |
| **Total** | **63** | **487** |

`npm run test:ci` corre los tres en unos treinta segundos en una máquina de
desarrollo (medido: 30 s), y el límite del documento son tres minutos. Si algún día se acerca al minuto, el sospechoso es el proyecto `ui`
(jsdom), no el de integración, que va serializado por diseño.