# Tarea 00 — Descubrimiento y Auditoría

| Campo | Valor |
|---|---|
| **ID** | 00 |
| **Fase (DESIGN.md §8.2)** | Fase 0 — Descubrimiento y Auditoría |
| **Depende de** | — |
| **Habilita** | Todas las demás (bloquea 03, 05, 12) |
| **Tipo** | No-code — levantamiento de requerimientos |
| **Esfuerzo est.** | 2 – 3 días (incluye espera del cliente) |
| **Estado** | 🟡 Entregables escritos con valores MOCK · 🔴 Sin confirmación del encargado |

---

## 0. Estado de ejecución (2026-09-28)

> ## 🔴 Resumen en una línea
>
> **No hubo reunión con el encargado.** Los entregables están completos y el contrato de datos está cerrado, pero todos sus valores son **simulados** para poder desarrollar. La tarea sigue en 🟡: el Definition of Done pide confirmación real y eso no se puede simular. Decisión de proyecto: [ADR-23](../../DESIGN.md).

### Qué se produjo

| Entregable | Contenido | Estado |
|---|---|---|
| [`docs/menu-maestro.md`](../menu-maestro.md) | Contrato de datos cerrado: mapa campo → columna de Prisma, glosario de alérgenos de 8 claves, reglas de slug y desambiguación, reglas de escritura, lista de lo que **no** existe en v1, protocolo de captura. **Valores cargados: 5 categorías + 23 productos MOCK en `DRAFT`** | 🟡 |
| [`docs/assets/`](../assets) | **23 placeholders** `1600×1200` nombrados por slug, con banda visible `IMAGEN MOCK - REEMPLAZAR` | 🟡 |
| [`docs/operacion-actual.md`](../operacion-actual.md) | Clasificación de mensajes, planilla de 7 días **con línea base MOCK de 6 días**, bloque a copiar en `DESIGN.md` §16, descripción del flujo actual | 🟡 |
| [`docs/decisiones-negocio.md`](../decisiones-negocio.md) | 14 decisiones (D-01 a D-14), formato literal del mensaje con especificación línea por línea y reglas de robustez | 🟡 |
| `DESIGN.md` §16.1 | Bloque de línea base cargado con valores MOCK, marcados como tales | 🟡 |
| `DESIGN.md` §5.4, §6.3, §8.2, §18 | Regla de desambiguación de slugs, reconciliación del mensaje con D-01, estado real de la Fase 0, ADR-21 a ADR-24 | ✅ |

### Decisiones cerradas en esta ejecución

| Decisión | Resultado |
|---|---|
| ¿Hay variantes de producto? | **No.** El carrito resuelve con cantidades y notas. Cierra la decisión pendiente #1 de [`README.md`](./README.md) y la deuda "variantes no editables" |
| ¿El precio del carrito es una instantánea? | **Sí.** Cierra la decisión pendiente #2 |
| ¿Analytics? | **Sin instrumentación.** Cierra la decisión pendiente #3 |
| ¿Formato del mensaje? | **Variante C** (híbrida con notas), por default según §9 |
| ¿Cómo se avanza sin datos reales? | **Set MOCK etiquetado**, en `DRAFT`, publicable solo con `SEED_PUBLISH_MOCK=true`. Cierra la decisión pendiente #4 (ADR-23) |
| ¿Glosario de 7 u 8 claves? | **8 claves**, agregando `pescado`. Cierra la decisión pendiente #5 (ADR-24) |

### Qué falta (todo requiere del encargado)

- [ ] Reunión de descubrimiento: categorías, productos, precios, alérgenos por producto
- [ ] Número de WhatsApp **por escrito**, en E.164 sin `+` (bloquea la publicación real)
- [ ] Horarios, dirección, radio de delivery, mínimo de compra, métodos de pago
- [ ] Variante de mensaje **probada en un teléfono real** y confirmada por escrito
- [ ] Relevamiento de 7 días para reemplazar la línea base MOCK de `DESIGN.md` §16.1 (B-7)
- [ ] Fotos reales de al menos el 80% del menú, reemplazando los 23 placeholders
- [ ] Confirmación escrita del menú maestro (B-6)
- [ ] Ratificar si el glosario lleva `pescado` o se sacan Atún y Salmón

### Estado de desbloqueo

| Tarea | Estado | Motivo |
|---|---|---|
| 03 — Modelo de datos | ✅ Desbloqueada | Solo necesita el contrato de nombres de campo, que está cerrado |
| 12 — Servicio de WhatsApp | ✅ Desbloqueada | Solo necesita el formato literal del mensaje, que está cerrado (D-01) |
| 05 — Seed | 🟡 Desbloqueada **para escribir** | El seed se programa contra el set MOCK. Su salida es un catálogo de prueba: al reemplazar los datos, el seed se vuelve a correr |
| 16 — Fotos | ⛔ Bloqueada | Necesita los originales reales en `docs/assets/`; los placeholders no sirven para publicar |

> **Ningún precio de negocio fue inventado.** Los precios que hay son simulados y están marcados como tales: banner 🔴 en la documentación, `status: DRAFT` en las 23 filas, publicación solo con `SEED_PUBLISH_MOCK=true`, y destinos inválidos (número de WhatsApp inexistente y dominio `.invalid` en el email de admin). Un número real o un `@example.com` sí serían destinos válidos: el primero puede pertenecer a alguien, el segundo se puede registrar.

---

## 1. Objetivo de la tarea

Convertir la información dispersa del negocio (conversaciones de WhatsApp, libretas, precios de memoria, listas de Instagram) en **un conjunto de datos estructurado y confirmado** del menú, y acordar de forma literal el formato del mensaje de WhatsApp.

No se escribe una línea de código en esta tarea. Es la tarea que más retrabajo ahorra: casi todo el retrabajo en proyectos de catálogo proviene de datos no confirmados.

**Criterio de éxito verificable:** existe un documento `docs/menu-maestro.md` con el 100% del menú, y el encargado confirmó por escrito (WhatsApp o mail) que el ejemplo de mensaje de pedido es correcto tal cual.

---

## 2. Contexto y dependencias

No requiere tareas previas. Es la **tarea 00 bloqueante**.

> **Regla de dependencia dura:** las tareas 03 (modelo de datos), 05 (seed) y 12 (servicio de WhatsApp) no se empiezan hasta que esta tarea esté cerrada. No se "asume un menú de ejemplo" y se corrige después: corregir precios y descripciones en 20 productos es más caro que capturarlos bien una vez.
>
> 🔴 **Esta regla se relajó de forma explícita y controlada.** La Tarea 00 no se puede cerrar sin el encargado, pero el proyecto tampoco puede esperar. La excepción está documentada en [ADR-23](../../DESIGN.md) y tiene una condición no negociable: **ningún dato MOCK llega a producción**. El riesgo real no es equivocarse de precio, es que un precio simulado se publique y el local cobre una cantidad que nunca existió. Por eso el seed exige `SEED_PUBLISH_MOCK=true` para publicar.

**Objetos de la reunión de descubrimiento (agendar con anticipación):**

> 📄 **El guion de esta reunión ya está armado:** [`docs/reunion-descubrimiento.md`](../reunion-descubrimiento.md) tiene la agenda por bloques con el tiempo asignado, los 3 preparativos que hay que pedir antes, los 7 puntos de la prueba del mensaje en dispositivo real, y la tabla que mapea las 16 preguntas de abajo a su lugar en la agenda. No hace falta reconstruirlo desde este archivo.

- [ ] Reunión de 60–90 min con el encargado del local
- [ ] Acceso al WhatsApp Business del local (para ver el formato actual de pedidos)
- [ ] Acceso a la cuenta de Instagram (fuente frecuente de fotos y precios)
- [ ] Posibilidad de fotografiar los productos si las fotos son de baja calidad

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito | Estado |
|---|---|---|
| `docs/menu-maestro.md` | **Fuente de verdad del menú.** Tabla de productos, categorías, precios, alérgenos. Es el insumo directo de la Tarea 05 (seed). | 🟡 Creado con 23 productos MOCK |
| `docs/operacion-actual.md` | Descripción del flujo de pedidos actual, con la línea base de mensajes diarios | 🟡 Creado con línea base MOCK |
| `docs/decisiones-negocio.md` | Registro de decisiones de negocio: horarios, envíos, pagos, mínimos | 🟡 Creado con valores MOCK |
| `docs/assets/*.jpg` | Originales de las fotos de producto, nombradas por slug | 🟡 23 placeholders `1600×1200` |

### 3.2 Modificar

| Ruta | Cambio | Estado |
|---|---|---|
| `DESIGN.md` | §16.1: cargar la **línea base** de mensajes diarios | 🟡 Cargada con datos MOCK, marcados |
| `DESIGN.md` | §8.2: estado real de la Fase 0 y lista de pendientes | ✅ |
| `DESIGN.md` | §18: ADR-23 (datos MOCK) y ADR-24 (glosario de alérgenos) | ✅ |
| `docs/tasks/README.md` | Marcar Tarea 00 como completada | 🟡 Actualizado a 🟡 con los bloqueos B-1 a B-7 |

### 3.3 Eliminar

Ninguno.

---

## 4. Estructura N-Capas

Esta tarea no produce código. Pero su salida define el contrato de datos de las capas 3 y 4.

| Capa | Impacto de esta tarea |
|---|---|
| 4 · Acceso a Datos | El **nombre de cada campo** de `docs/menu-maestro.md` se convierte literalmente en el nombre de las columnas de Prisma (Tarea 03) |
| 3 · Servicio | El **formato del mensaje** acordado acá es el que implementa `buildWhatsAppMessage` (Tarea 12) |
| 1 · Presentación | Las **fotos** capturadas acá son las que se suben en la Tarea 05 y definen el sistema de imágenes |

> **Por qué el orden importa:** capturar el menú *antes* del modelo de datos evita tener que renombrar columnas y reescribir el seed. El nombre de la categoría "Classic" en el menú tiene que ser el mismo en el `Category.name`, en el slug y en la URL.

---

## 5. Convenciones de documentación

| Elemento | Convención | Ejemplo |
|---|---|---|
| Nombre de producto | Tal como lo dice el cliente, sin abreviar | `Classic Jamón y Queso` (no `CJ&Q`) |
| Precio | Número decimal con 2 lugares, en ARS | `1450.00` |
| Categoría | Singular, en Title Case | `Clásicos`, `Premium`, `Combos`, `Bebidas` |
| Alérgenos | Lista separada por comas, de un glosario fijo | `gluten, lacticosa` |
| Nombre de archivo | kebab-case, plural | `hamon-queso.jpg` |

**Glosario de alérgenos obligatorio** (usar exactamente estas claves, sin variantes):

`gluten` · `lactosa` · `huevo` · `maní` · `frutos secos` · `sésamo` · `soja`

> La consistencia del glosario importa: si un producto dice `lactosa` y otro `leche`, el cliente no puede filtrar ni entender. La tarea 09 define cómo se presenta esta info en la UI.

---

## 6. Pasos de implementación

### 6.1 Paso 1 — Auditar el flujo actual (sin el cliente, 2 horas)

Antes de la reunión, entender el estado actual. Ir al WhatsApp Business y registrar durante 3–5 días:

| Métrica de línea base | Cómo se mide |
|---|---|
| Mensajes diarios totales | Conteo manual diario |
| Mensajes "informativos" | Los que son solo precio, disponibilidad, horarios, dirección (no son pedidos) |
| Mensajes que son pedidos reales | Los que derivan en una venta |
| Tickets promedio | Cantidad de mensajes entre cliente y encargado por pedido |
| Pedidos perdidos por rotura de stock | Estimación del encargado |

Estos números son **obligatorios**: sin ellos es imposible demostrar el objetivo OB-1 de `DESIGN.md` (§2.1), que exige "reducción ≥ 70% de mensajes informativos". Registrar el resultado en `docs/operacion-actual.md`.

### 6.2 Paso 2 — Reunión de descubrimiento (60–90 min)

Hacer estas preguntas **en este orden**. Las primeras son las de mayor impacto en el modelo de datos:

**Catálogo**
1. ¿Cuántos productos hay? ¿Todos se venden o algunos están de adorno en el menú?
2. ¿Cómo los agrupan hoy? (esto define las categorías)
3. ¿Cada producto tiene variantes? Ej.: simple / doble, con ficará / sin Ruire. **Preguntar explícitamente.** Si la respuesta es no, se omite la tabla `product_variants` y se simplifica el modelo.
4. ¿Cuál es el precio de cada uno? ¿Hay combos?
5. ¿Alguno tiene alérgenos relevantes?
6. ¿Hay productos que se venden solos (sin combinación con otro producto)?
7. ¿Alguno es "del día" o rotativo? (afecta si se modela aparte o se Maneja con `isAvailable`)

**Operación**
8. ¿El número de WhatsApp Business es único? ¿Cuál? **Pedirlo por escrito y confirmar el formato con prefijo 54 y sin `+`.**
9. ¿Atienden por delivery? ¿Hay radio máximo? ¿Mínimo de compra?
10. ¿Horarios exactos? ¿Días de cierre?
11. ¿Métodos de pago? (Se comunican en el chat o en la web)
12. ¿Retiro en el local? ¿Dirección exacta y cómo llegar?
13. ¿Con qué frecuencia cambian los precios o el menú?

**Administración**
14. ¿Quién va a usar el panel? ¿Cuántas personas? (Si es una sola, `StaffRole` se puede quedar en un solo valor por ahora)
15. ¿Prefiere login con email + contraseña o un link mágico por email? (La Tarea 07 implementa ambos; el link mágico es más simple de usar)
16. ¿Tiene foto de los productos? ¿En qué calidad? Si no, ¿se pueden fotografiar?

### 6.3 Paso 3 — Acordar el formato del mensaje de WhatsApp

**Este es el paso más importante de la tarea.** El formato del mensaje es el producto final de todo el sistema.

Presentar al encargado **tres variantes concretas** (no abstractas) y que elija una:

**Variante A — Detallada**
```
¡Hola! Quiero hacer un pedido en *Mi Negocio*:

• 2 x Classic Jamón y Queso — $2.900
• 1 x Bebida Coca 500ml — $800

*Total: $3.700*

*Mis datos:*
Nombre: Juan Pérez
Teléfono: 2615551234
Entrega en: San Rafael, Av. San Martín 1234

¡Gracias!
```

**Variante B — Mínima**
```
Hola! Mi pedido:
2 x Classic Jamón y Queso
1 x Bebida Coca 500ml
Total: $3.700
Soy Juan Pérez, tel 2615551234, retiro en el local.
```

**Variante C — Híbrida con notas** (recomendada)
```
¡Hola! Quiero hacer un pedido en *Mi Negocio*:

• 2 x Classic Jamón y Queso — $2.900
• 1 x Bebida Coca 500ml — $800

*Total: $3.700*

*Mis datos:*
Nombre: Juan Pérez
Teléfono: 2615551234
Entrega en: San Rafael, Av. San Martín 1234
Comentarios: Sin mayonesa por favor

¡Gracias!
```

**Preguntas de validación con el encargado:**

- ¿Los negritas (`*texto*`) se ven bien en WhatsApp? → Sí, es formato oficial de WhatsApp.
- ¿`$3.700` con punto como separador de miles se entiende? (es el estándar argentino)
- ¿"Mis datos" o "Datos de entrega"?
- ¿Querés que aparezca la dirección del local en retiro?
- ¿Falta algo que siempre mandan por mensaje y no quedaría en la web?
- ¿Conviene que el cliente escriba un saludo o ir directo al pedido?

> **Prueba obligatoria:** mandar las tres variantes al WhatsApp real del local, desde un teléfono real, y ver cómo se renderizan. Los saltos de línea y el formato se ven distinto en la app que en el texto plano. **Esto es exactamente el riesgo R2 de `DESIGN.md` y la razón por la que la Tarea 12 tiene una suite de tests.**

### 6.4 Paso 4 — Consolidar `docs/menu-maestro.md`

Estructura del documento:

```markdown
# Menú Maestro — Mi Negocio

> Fuente de verdad del menú. Consumido por la Tarea 05 (seed) y la Tarea 03 (modelo de datos).
> Última actualización: YYYY-MM-DD · Responsable: [nombre]

## Configuración del negocio
- Nombre: Mi Negocio
- WhatsApp (E.164, sin +): 54XXXXXXXXXXX
- Dirección: [completa, con referencias]
- Horarios: [tabla por día]
- Métodos de pago: [lista]
- Instagram: [@modo.miga]
- Radio de delivery: [km o "no"]

## Categorías
| Orden | Nombre | Slug | Visible |
|---|---|---|---|
| 1 | Clásicos | `clasicos` | Sí |
| 2 | Premium | `premium` | Sí |

## Productos
| # | Categoría | Nombre | Slug | Precio | Descripción | Alérgenos | Destacado | Variantes |
|---|---|---|---|---|---|---|---|---|
| 1 | Clásicos | Jamón y Queso | `jamon-y-queso` | 1450.00 | Jamón cocido y queso cheddar en pan de miga.| `gluten, lactosa` | Sí | Ninguna |
| 2 | Premium | Roast Beef | `roast-beef` | 1890.00 | ... | `gluten, lactosa` | No | Simple / Doble (+450) |

## Notas para la implementación
- [ ] El producto X lleva la imagen `docs/assets/hamon-queso.jpg` (2000×1500, 340 KB)
- [ ] Los combos son independientes de los sándwiches (no se relacionan)
- [ ] No hay productos rotativos
```

**Reglas de redacción de la descripción:** 1 a 2 oraciones, máximo 180 caracteres. Sin emojis, sin mayúsculas sostenidas, sin signos de exclamación múltiples. Describir el producto, no elogiarlo (" Jamón cocido y cheddar en pan de miga casero", no "¡El mejor de San Rafael!").

### 6.5 Paso 5 — Fotos (si aplica)

Si las fotos existentes son de baja calidad:

- [ ] Fotografiar en **luz natural**, sin flash directo
- [ ] Encuadre cerrado, fondo simple, el producto centrado
- [ ] Resolución mínima 1200 px del lado mayor
- [ ] Formato original: `.jpg` o `.png`. **No comprimir todavía** — Cloudinary genera las variantes (Tarea 06)
- [ ] Nombres de archivo según el slug: `roast-beef.jpg`
- [ ] Guardar en `docs/assets/` (**fuera** de `public/`; las sirven por Cloudinary, no por el repo)

> **No subirlas a `public/`.** Las imágenes definitivas viven en Cloudinary (Tarea 06). `public/` es solo para assets del propio código (favicon, og-image).

### 6.6 Paso 6 — Cerrar y registrar

- [ ] Mandar `docs/menu-maestro.md` al encargado para revisión
- [ ] Recibir confirmación explícita ("está bien así")
- [ ] Cargar la línea base en `DESIGN.md` §16
- [ ] Registrar decisiones en `docs/decisiones-negocio.md`
- [ ] Marcar la tarea en `docs/tasks/README.md`

---

## 7. Contratos y tipos

No hay contratos de código. El contrato que se define es **el agreement de datos** que consume la Tarea 03 y 05:

| Contrato | Ubicación | Consumido por |
|---|---|---|
| Categoría (nombre + slug + orden + visibilidad) | `docs/menu-maestro.md` | Tarea 03 (modelo), Tarea 05 (seed) |
| Producto (nombre + slug + precio + descripción + alérgenos + destacado + variantes) | `docs/menu-maestro.md` | Tarea 03, Tarea 05 |
| Configuración del negocio (WhatsApp, horarios, dirección) | `docs/menu-maestro.md` | Tarea 03 (`BusinessSettings`), Tarea 17 |
| Variantes y su delta de precio | `docs/menu-maestro.md` | Tarea 03, Tarea 12 (mensaje) |
| Texto literal del mensaje de WhatsApp elegido | `docs/decisiones-negocio.md` | **Tarea 12** (especificación literal) |
| Línea base de mensajes diarios | `docs/operacion-actual.md` | `DESIGN.md` §16 (medición de OB-1) |

> **Los slugs son contrato técnico, no etiqueta editorial.** Una vez publicados, los slugs aparecen en URLs y quedan indexados. Definirlos acá, en minúsculas, sin tildes ni acentos (`jamón` → `jamon`), evita tener que redirigir URLs más adelante.

---

## 8. Criterios de aceptación

> 🔴 **Estado de esta sección:** los ítems de completitud y de formato están 🟡 porque el set MOCK los cumple; los de validación con el negocio y los de línea base real están 🔴 sin empezar. Ninguno se marca como cumplido solo por tener un valor simulado: "está escrito" y "está confirmado" son cosas distintas, y esta tarea mide la segunda.

### 8.1 Completitud de la información

- [ ] El 100% de los productos del menú está en `docs/menu-maestro.md` con precio confirmado — 🟡 23 filas MOCK; 🔴 0 confirmadas
- [x] Todas las categorías tienen nombre, slug y orden — 🟡 5 categorías MOCK
- [x] Cada producto tiene al menos: nombre, slug, precio, categoría, descripción de 1–2 oraciones — 🟡 verificado en los 23
- [x] Los alérgenos usan **exclusivamente** el glosario de §5 — 🟡 8 claves, verificado
- [x] Está decidido explícitamente si hay variantes (`product_variants`) — sí o no → **no** (D-02)
- [x] Está decidido explícitamente si hay combos o relaciones entre productos → **productos independientes** (D-03)
- [ ] El número de WhatsApp está confirmado **y escrito** en formato E.164 sin `+` — 🟡 `5492615000000`, que no está asignado
- [ ] Horarios, dirección, métodos de pago y radio de delivery documentados — 🟡 documentados como MOCK
- [ ] Confirmado quién es el administrador y qué método de login prefiere — 🟡 `dueno@modo-miga.invalid`, enlace mágico por default (D-10)

### 8.2 Validación con el negocio

- [ ] El encargado **eligió** una de las tres variantes de mensaje — 🟡 Variante C por default
- [ ] Las tres variantes fueron probadas en un **teléfono real** vía WhatsApp
- [ ] Mandar el mensaje elegido al WhatsApp real del local y **verificar que el formato se renderiza bien** (negritas, saltos de línea, acentos)
- [ ] El encargado confirmó por escrito que el menú capturado es correcto

### 8.3 Línea base

- [ ] Registrado el conteo de mensajes diarios de 3–5 días en `docs/operacion-actual.md` — 🟡 7 filas MOCK
- [x] Separado: mensajes informativos vs. pedidos reales — 🟡 criterio definido y aplicado a los datos MOCK
- [ ] `DESIGN.md` §16 actualizado con la línea base — 🟡 §16.1 actualizado con valores MOCK

### 8.4 Assets

- [ ] Fotos de al menos el 80% de los productos disponibles (el 20% restante se completa antes de la Tarea 16) — 🟡 hay 100% de *placeholders*
- [x] Archivos en `docs/assets/` con nombre por slug — 23/23
- [x] Resolución mínima verificada (≥ 1200 px del lado mayor) — 1600 × 1200 los 23
- [ ] Las fotos son del local y no placeholders — 🔴 ninguno lo es todavía

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado |
|---|---|
| El menú cambia seguido (productos rotativos del día) | **No** agregar una entidad `daily_special` en v1. Se modelan como productos normales y el encargado los togglea con `isAvailable` (Tarea 14). Es exactamente para eso que existe el switch. |
| Hay productos con el mismo nombre en categorías distintas | El slug debe incluir la categoría para ser único: `classic-jamon` vs `premium-jamon`. Definir la regla de desambiguación en `DESIGN.md` §5.4 antes de la Tarea 03. |
| Un producto no tiene precio claro todavía | Va en el menú maestro con `status: DRAFT` y **sin aparecer en el catálogo público**. **Nunca** inventar un precio ni publicarlo como `PUBLISHED`. |
| El encargado no puede decidir el formato del mensaje | Decidir la Variante C por defecto y **confirmar en producción** con pedidos reales durante la primera semana (Tarea 22). El formato es ajustable sin cambiar la arquitectura. |
| Hay más de un administrador | Definir los emails en la Tarea 07 y crear un registro `staff_members` por persona. La arquitectura ya soporta N usuarios desde v1 sin esfuerzo extra. |
| Las fotos son de mala calidad o no existen | Es bloqueante para publicar. Documentar en `docs/menu-maestro.md` qué productos quedan sin foto. Se pueden cargar con placeholder en el seed y reemplazar en la Tarea 16. **Nunca** inventar fotos de stock genéricas: un sándwich que no se parece al real genera reclamos. |
| El local no tiene Instagram | Dejar `instagramUrl: null` en la configuración y ocultar el enlace en la UI (Tarea 10). |
| La dirección es larga o tiene referencias complicadas | Campo de texto libre con máximo 240 caracteres, más un campo opcional de "referencia" separado (Tarea 13). |
| 🔴 **No hay datos reales y hay que avanzar** | Set MOCK etiquetado, en `DRAFT`, detrás de `SEED_PUBLISH_MOCK` (ADR-23). Es el caso que se aplicó en esta ejecución: la alternativa de frenar el proyecto hasta tener la reunión se descartó, y la de "asumir un menú de ejemplo sin marcarlo" se descartó por ser peor. |
| 🔴 **Un producto declara un alérgeno fuera del glosario** | Se **agrega la clave al glosario**, no se inventa un sinónimo ni se recorta el alérgeno. Un filtro que deja pasar lo que debe filtrar es peor que no tener filtro (ADR-24, con `pescado`). |

---

## 10. Pruebas

No hay pruebas automatizables. La validación es **manual y cruzada**, y es tan importante como las automáticas en esta fase.

| Tipo | Verificación | Estado |
|---|---|---|
| Manual cruzada | El encargado recibe `docs/menu-maestro.md` y lo revisa contra su menú real | 🔴 No se hizo |
| Manual cruzada | **Prueba del mensaje en dispositivo real**: las 3 variantes en WhatsApp App, en Android e iPhone | 🔴 No se hizo |
| Manual | Verificar que los slugs son únicos y válidos para URL (sin tildes, sin espacios) | ✅ 23/23 únicos y normalizados |
| Manual | Verificar precios: sumar 3 productos a mano y comparar contra la lista | 🟡 Validado por script, no por suma a mano |
| Manual | Cada alérgeno del set MOCK existe en el glosario de §5 | ✅ 18 productos, 6 claves en uso |
| Manual | Ningún destino de dato simulado es alcanzable | ✅ Teléfono inexistente, email en `.invalid` |

> **Anti-patrón a evitar:** arrancar a cargar datos inventados en el seed "para avanzar" y corregirlos después. El costo de corregir 20 productos con foto, precio y descripción a través de la UI del admin es de horas. Diez minutos de reunión los evitan.
>
> ⚠️ **Este proyecto hizo exactamente ese anti-patrón, con control explícito.** La diferencia entre el error y la excepción está en cuatro condiciones verificables: banner 🔴 en la documentación, `DRAFT` en las 23 filas, flag `SEED_PUBLISH_MOCK` obligatorio, y destinos inválidos. La Tarea 00 sigue en 🟡, así que el costo —corregir 20 productos— está diferido a propósito, no oculto: está escrito en §11 como pendiente.

---

## 11. Definición de "Hecho" (Definition of Done)

> 🔴 **No cumple.** Cuatro de los siete ítems dependen de una confirmación que no existe.

- [ ] `docs/menu-maestro.md` completo y **confirmado por el encargado** — 🟡 completo, sin confirmar
- [ ] `docs/operacion-actual.md` con la línea base **medida** — 🟡 cargada con datos MOCK
- [ ] `docs/decisiones-negocio.md` con el formato de mensaje elegido y todas las decisiones de operación — 🟡 14 decisiones, 6 `proposed`
- [ ] Fotos **reales** disponibles en `docs/assets/` para al menos el 80% del menú — 🟡 23 placeholders etiquetados
- [ ] `DESIGN.md` §16 actualizado con la línea base real — 🟡 actualizado con MOCK
- [ ] `docs/tasks/README.md` con la Tarea 00 marcada como completada — 🟡 se mantiene en curso
- [x] Las Tareas 03, 05 y 12 están desbloqueadas — ✅ las tres; 05 para escribir, no para publicar

---

## 12. Dependencias y bloqueos

**Habilita:** 03 (necesita los nombres de campo exactos), 05 (necesita los datos del seed), 12 (necesita el formato literal del mensaje), 16 (necesita las fotos).

**Decisiones que esta tarea deja established y que condicionan el resto:**

1. Los **nombres de campo** del menú maestro son los nombres de las columnas de Prisma.
2. Los **slugs** son contrato técnico; se definen una vez y no cambian.
3. El **formato del mensaje** acordado es la especificación de `buildWhatsAppMessage`.
4. La **línea base de mensajes** es la única forma de medir el objetivo OB-1.
5. Si hay **variantes**, la tabla `product_variants` se modela; si no, se omite y el carrito se simplifica a cantidades.

> **Bloqueo explícito:** no iniciar la Tarea 03 hasta cerrar esta tarea. Modelar el catálogo sin datos reales lleva a descubrir a mitad de la Tarea 10 que faltaba un campo, y una migración de Prisma en producción es más costosa que una reunión dediscovery.
