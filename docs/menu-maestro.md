# Menú Maestro — Mi Negocio

> **Fuente de verdad del menú.** Consumido por la Tarea 03 (nombres de columna de Prisma), la Tarea 05 (seed) y la Tarea 16 (fotos).
> **Última actualización:** 2026-09-28 · **Responsable:** [PENDIENTE]
> **Estado:** 🟡 Contrato cerrado · Valores cargados como MOCK

> ## 🔴 DATOS MOCK — NO PUBLICAR
>
> **Todos los valores de este documento son simulados.** El encargado todavía no entregó el menú real, ni precios, ni horarios, ni fotos.
>
> | Qué es real acá | Qué es simulado |
> |---|---|
> | El contrato de datos (§1–§5): campos, tipos, glosarios, reglas de slug, formato de precio | Productos, precios, categorías, horarios, dirección, teléfono, fotos |
> | La clasificación de alérgenos y el glosario | Cuáles alérgenos declara cada producto |
> | Las reglas de escritura de §3.2 | Los textos de las descripciones |
>
> **Cómo se comportan los datos mock en el código:**
>
> 1. Todos los 23 productos se cargan con `status: DRAFT` y **no** aparecen en el catálogo público.
> 2. Publicarlos requiere `SEED_PUBLISH_MOCK=true` explícito. Sin esa variable, ningún mock llega a `PUBLISHED`.
> 3. El teléfono y el email de administración usan reservas inválidas (`+` no, y dominio `.invalid`) para que ningún pedido real llegue a un destino real.
> 4. Cuando lleguen los valores reales, se **reemplazan fila por fila**. No se mezclan filas mock y reales en la misma tabla.
>
> **La tarea sigue en 🟡.** Un mock no cumple el Definition of Done: falta la confirmación escrita del encargado (B-6).

---

## 0. Estado del documento

Este documento está en dos capas, y conviene no confundirlas:

| Capa | Estado | Qué significa |
|---|---|---|
| **Contrato de datos** (nombres de campo, tipos, reglas de escritura, glosarios, reglas de slug) | ✅ Cerrado | No cambia. Es lo que consumen las Tareas 03 y 05 tal cual |
| **Valores** (productos, precios, horarios, teléfono, dirección) | 🟡 MOCK | Cargados con datos simulados para poder desarrollar. Ninguno fue confirmado por el encargado |

> **Regla dura del proyecto:** un precio de negocio nunca se inventa. Como todavía no hay precios reales, este documento carga un **precio simulado explícitamente etiquetado**, con `status: DRAFT` y sin posibilidad de publicarse sin el flag `SEED_PUBLISH_MOCK=true`. Ninguna cifra de acá puede llegar a producción. Ver [§9 de la Tarea 00](tasks/00-descubrimiento-y-auditoria.md).

### Qué bloquea qué

Los bloqueos siguen abiertos: el mock **no** los cierra. Lo que cambia es que la Tarea 05 ya puede escribirse y probarse contra el contrato.

| # | Bloqueo | Quién lo resuelve | Estado | Cómo se cierra |
|---|---|---|---|---|
| B-1 | Número de WhatsApp en E.164 sin `+` | Encargado | 🟡 Mock cargado | Mandarlo por escrito y confirmarlo acá |
| B-2 | Catálogo: categorías + productos + precios | Encargado | 🟡 Mock cargado | Reunión de descubrimiento (60–90 min) |
| B-3 | Horarios por día y días de cierre | Encargado | 🟡 Mock cargado | Reunión |
| B-4 | Dirección, radio de delivery, mínimo de compra, métodos de pago | Encargado | 🟡 Mock cargado | Reunión |
| B-5 | Fotos de al menos el 80% de los productos | Encargado | 🟡 Placeholders generados | Fotografiar o entregar existentes |
| B-6 | Confirmación escrita de que este documento es correcto | Encargado | 🔴 Abierto | "Está bien así" por WhatsApp o mail |

**B-1, B-2 y B-3 son bloqueantes de la Tarea 05 para producción.** La Tarea 03 (schema) y la Tarea 12 (servicio de WhatsApp) **no** dependen de los valores, solo del contrato: pueden empezar ya.

---

## 1. Configuración del negocio

Consumido por `BusinessSettings` (Tarea 03) y por la Tarea 17 (pantalla de ajustes).

| Campo | Valor | Regla de validación |
|---|---|---|
| Nombre | `Mi Negocio` | Texto libre, 1–60 caracteres |
| WhatsApp (E.164, sin `+`) | `5492615000000` 🔴 MOCK | Solo dígitos. Prefijo `54` + área + número. Ej: `5492615xxxxxx` |
| Dirección | `Av. San Martín 1234, San Rafael, Mendoza` 🔴 MOCK | Texto libre, máx. 240 caracteres |
| Referencia de la dirección | `A media cuadra de la plaza, al lado de la farmacia. Timbre 2.` 🔴 MOCK | Opcional, máx. 120 caracteres. Campo separado del anterior (Tarea 13) |
| Instagram | `https://instagram.com/modo.miga` 🔴 MOCK | URL completa o `null`. Si `null`, la UI oculta el enlace (Tarea 10) |
| Radio de delivery | `5` km 🔴 MOCK | En km, o `null` si no hay delivery |
| Mínimo de compra | `3000.00` 🔴 MOCK | En ARS, o `null` |
| Métodos de pago | `Efectivo`, `Transferencia bancaria` 🔴 MOCK | Lista. Se comunican en el chat, no en el sitio |
| Texto legal / aviso | `Mi Negocio · Precios en pesos argentinos. Pedidos sujetos a disponibilidad de stock.` 🔴 MOCK | Texto libre, máx. 500 caracteres |
| Mensaje de cierre | `Hoy no estamos tomando pedidos. Escribinos mañana y te lo preparamos al instante.` 🔴 MOCK | Texto libre. Se muestra fuera de horario (Tarea 10) |

> **El número de WhatsApp no es un dato de formato, es un dato de negocio.** `wa.me/5492615000000` y `wa.me/542615000000` abren conversaciones distintas. Por eso se pide **por escrito** y se guarda **sin `+`**: un `+` rompe el deep-link silenciosamente (DESIGN.md §6.3).
>
> 🔴 `5492615000000` es un número de ejemplo: termina en cinco ceros, no está asignado y **no** debe usarse para pruebas reales de pedido.

### Horarios

`openingHours` es un `JSONB` con una entrada por día. Un día cerrado se representa con `null`, no con un objeto vacío.

| Día | Abre | Cierra | ¿Delivery? | Nota |
|---|---|---|---|---|
| Lunes | `09:00` | `21:00` | `true` | Delivery hasta 20:30 |
| Martes | `09:00` | `21:00` | `true` | Delivery hasta 20:30 |
| Miércoles | `09:00` | `21:00` | `true` | Delivery hasta 20:30 |
| Jueves | `09:00` | `21:00` | `true` | Delivery hasta 20:30 |
| Viernes | `09:00` | `21:00` | `true` | Delivery hasta 20:30 |
| Sábado | `09:00` | `22:00` | `true` | Delivery hasta 21:30 |
| Domingo | `null` | `null` | `false` | 🔴 Cerrado. Un día cerrado es `null`, no `{ "open": null }` |

> 🔴 Todos los horarios de esta tabla son MOCK. Domingo cerrado es un supuesto de diseño, no un dato del local: si el local abre los domingos, este es el primer valor que cambia.
>
> ¿Los horarios se muestran en la web, o el local prefiere que el cliente pregunte? Default del proyecto: **se muestran**. Son la información que más mensajes informativos genera.

---

## 2. Categorías

Consumido por `Category` (Tarea 03, Tarea 05). El **slug es contrato técnico**: aparece en URLs y queda indexado. Se define una vez y no cambia.

🔴 Las cinco categorías de abajo son una propuesta MOCK. La lista real la define el encargado.

| Orden | Nombre | Slug | Visible | Descripción (≤180 car.) | Productos |
|---|---|---|---|---|---|
| 1 | `Clásicos` | `clasicos` | `true` | Los de siempre: jamón, queso y tomate, en pan de miga de la casa. | 8 |
| 2 | `Premium` | `premium` | `true` | Recetas con ingredientes que se compran especialmente para el local. | 5 |
| 3 | `Combos` | `combos` | `true` | Sándwich, bebida y postre, con un precio más bajo que por separado. | 3 |
| 4 | `Bebidas` | `bebidas` | `true` | Gaseosas, jugos, agua y café, para acompañar el pedido. | 5 |
| 5 | `Postres` | `postres` | `true` | Dulces de la casa, para el café o después de comer. | 2 |

**Reglas de categoría:**

- Nombre en **singular y Title Case**: `Clásicos`, `Premium`, `Bebidas`.
- Slug en minúsculas, sin tildes, sin espacios: `Clásicos` → `clasicos`.
- `position` arranca en 1 y es correlativo. El orden lo define el encargado, no el alfabeto.
- `isVisible: false` la oculta del menú público sin borrarla. Una categoría con productos no se borra nunca (`onDelete: Restrict`).
- Categorías candidatas a mencionar en la reunión, **no decididas**: `Clásicos`, `Premium`, `Combos`, `Bebidas`, `Postres`, `Extras`.

---

## 3. Productos

Consumido por `Product` (Tarea 03, Tarea 05). Agregar una fila por producto. Borrar la columna de un producto inexistente es correcto: el documento refleja el menú real, no una plantilla completa.

🔴 **Las 23 filas siguientes son MOCK.** Sirven para escribir y probar el seed (Tarea 05), no para publicar. Todos van en `DRAFT`.

Las filas están agrupadas por categoría y, dentro de cada grupo, ordenadas por `sortOrder` ascendente (1..n). La columna `#` es solo el índice de lectura de la tabla.

| # | Categoría | Nombre | Slug | Precio | Descripción | Alérgenos | Destacado | Foto | Estado |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `Clásicos` | Jamón y Queso | `jamon-y-queso` | 1450.00 | Jamón cocido y queso cheddar en pan de miga. | `gluten`, `lactosa` | Sí | `docs/assets/jamon-y-queso.jpg` | `DRAFT` |
| 2 | `Clásicos` | Jamón y Tomate | `jamon-y-tomate` | 1350.00 | Jamón cocido, tomate en rodajas y mayonesa casera. | `gluten`, `huevo` | No | `docs/assets/jamon-y-tomate.jpg` | `DRAFT` |
| 3 | `Clásicos` | Atún | `atun` | 1550.00 | Atún en aceite escurrido, mayonesa y aceitunas verdes. | `gluten`, `huevo`, `pescado` | No | `docs/assets/atun.jpg` | `DRAFT` |
| 4 | `Clásicos` | Milanesa | `milanesa` | 1650.00 | Milanesa de pollo al horno con queso y pebete. | `gluten`, `lactosa` | No | `docs/assets/milanesa.jpg` | `DRAFT` |
| 5 | `Clásicos` | Jamón y Palta | `jamon-y-palta` | 1600.00 | Jamón cocido y palta en rodajas con limón. | `gluten`, `lactosa` | No | `docs/assets/jamon-y-palta.jpg` | `DRAFT` |
| 6 | `Clásicos` | Pollo con Maionesa | `pollo-con-maionesa` | 1500.00 | Pollo a la plancha desmenuzado con mayonesa casera. | `gluten`, `huevo` | No | `docs/assets/pollo-con-maionesa.jpg` | `DRAFT` |
| 7 | `Clásicos` | Queso y Tomate | `queso-y-tomate` | 1400.00 | Quesomanteca, tomate y orégano. | `gluten`, `lactosa` | No | `docs/assets/queso-y-tomate.jpg` | `DRAFT` |
| 8 | `Clásicos` | Mortadela | `mortadela` | 1300.00 | Mortadela en rodajas con mayonesa. | `gluten`, `huevo`, `soja` | No | `docs/assets/mortadela.jpg` | `DRAFT` |
| 9 | `Premium` | Roast Beef | `roast-beef` | 1890.00 | Roast beef en Pledge, queso y rucola. | `gluten`, `lactosa` | Sí | `docs/assets/roast-beef.jpg` | `DRAFT` |
| 10 | `Premium` | Jamón Crudo y Rucola | `jamon-crudo-y-rucola` | 2150.00 | Jamón crudo, rucola, tomate cherry y queso en lascas. | `gluten`, `lactosa` | No | `docs/assets/jamon-crudo-y-rucola.jpg` | `DRAFT` |
| 11 | `Premium` | Salmón y Palta | `salmon-y-palta` | 2450.00 | Salmón ahumado, palta y dress de limón. | `gluten`, `pescado` | No | `docs/assets/salmon-y-palta.jpg` | `DRAFT` |
| 12 | `Premium` | Provoleta a la Parrilla | `provoleta-a-la-parrilla` | 1950.00 | Provoleta a la parrilla con orégano y tomate. | `gluten`, `lactosa` | Sí | `docs/assets/provoleta-a-la-parrilla.jpg` | `DRAFT` |
| 13 | `Premium` | Bondiola a la Parrilla | `bondiola-a-la-parrilla` | 2050.00 | Bondiola a la parrilla con provoleta y rucola. | `gluten`, `lactosa` | No | `docs/assets/bondiola-a-la-parrilla.jpg` | `DRAFT` |
| 14 | `Combos` | Combo Clásico | `combo-clasico` | 3200.00 | Sándwich de jamón y queso, una bebida de 500 ml y un postre. | `gluten`, `lactosa`, `huevo` | Sí | `docs/assets/combo-clasico.jpg` | `DRAFT` |
| 15 | `Combos` | Combo Premium | `combo-premium` | 3900.00 | Sándwich de roast beef, jugo de naranja y un postre. | `gluten`, `lactosa` | No | `docs/assets/combo-premium.jpg` | `DRAFT` |
| 16 | `Combos` | Combo Familiar | `combo-familiar` | 6800.00 | Cuatro sándwiches a elección, cuatro bebidas y dos postres. | `gluten`, `lactosa`, `huevo` | Sí | `docs/assets/combo-familiar.jpg` | `DRAFT` |
| 17 | `Bebidas` | Gaseosa 500 ml | `gaseosa-500-ml` | 800.00 | Gaseosa de línea, 500 ml, bien fría. | — | No | `docs/assets/gaseosa-500-ml.jpg` | `DRAFT` |
| 18 | `Bebidas` | Agua Mineral 500 ml | `agua-mineral-500-ml` | 700.00 | Agua mineral sin gas, 500 ml. | — | No | `docs/assets/agua-mineral-500-ml.jpg` | `DRAFT` |
| 19 | `Bebidas` | Jugo de Naranja 400 ml | `jugo-de-naranja-400-ml` | 1100.00 | Jugo de naranja exprimido, 400 ml. | — | No | `docs/assets/jugo-de-naranja-400-ml.jpg` | `DRAFT` |
| 20 | `Bebidas` | Limonada con Menta 500 ml | `limonada-con-menta-500-ml` | 1200.00 | Limonada con menta y jarabe de agua, 500 ml. | — | No | `docs/assets/limonada-con-menta-500-ml.jpg` | `DRAFT` |
| 21 | `Bebidas` | Café Espresso | `cafe-espresso` | 900.00 | Café espresso de máquina, simple o doble. | — | No | `docs/assets/cafe-espresso.jpg` | `DRAFT` |
| 22 | `Postres` | Flotante de Chocolate | `flotante-de-chocolate` | 1900.00 | Helado de dulce de leche con chocolate caliente. | `gluten`, `lactosa`, `huevo` | No | `docs/assets/flotante-de-chocolate.jpg` | `DRAFT` |
| 23 | `Postres` | Torta de Ricota | `torta-de-ricota` | 1600.00 | Torta de ricota con dulce de leche y ralladura de limón. | `gluten`, `lactosa`, `huevo` | No | `docs/assets/torta-de-ricota.jpg` | `DRAFT` |

**Resumen del set MOCK:** 23 productos · 5 categorías · 5 destacados (de un máximo de 6) · rango de precio `700.00` – `6800.00` · 18 productos con alérgenos declarados, 5 sin alérgenos declarados (las bebidas).

**Formato de fila cuando el dato sea real** — mismo contrato, sin marcas MOCK:

```markdown
| 1 | Clásicos | Jamón y Queso | `jamon-y-queso` | 1450.00 | Jamón cocido y queso cheddar en pan de miga. | `gluten`, `lactosa` | Sí | `docs/assets/jamon-y-queso.jpg` | PUBLISHED |
```

> Los productos sin alérgenos muestran `—` en esa columna, no una lista vacía. En el seed es `allergens: []`; la UI lo comunica como "Sin alérgenos declarados" (§5).

### 3.1 Mapa campo → columna (el contrato literal de la Tarea 03)

| Campo de este documento | Columna Prisma | Tipo | Notas |
|---|---|---|---|
| Categoría → Nombre | `Category.name` | `String` | Singular, Title Case |
| Categoría → Slug | `Category.slug` | `String @unique` | URL |
| Categoría → Orden | `Category.position` | `Int` | 1..n |
| Categoría → Visible | `Category.isVisible` | `Boolean` | default `true` |
| Producto → Nombre | `Product.name` | `String` | Tal como lo dice el cliente, sin abreviar |
| Producto → Slug | `Product.slug` | `String @unique` | Contrato técnico, no editorial |
| Producto → Precio | `Product.price` | `Decimal(10,2)` | ARS. **Nunca** `Float` ni `Int` |
| Producto → Descripción | `Product.description` | `String?` | 1–2 oraciones, ≤180 caracteres |
| Producto → Alérgenos | `Product.allergens` | `String[]` | Solo claves del glosario de §5 |
| Producto → Destacado | `Product.isFeatured` | `Boolean` | Máximo 4–6 en la home |
| Producto → Foto | `Product.imageUrl`, `Product.imagePublicId` | `String`, `String?` | Cloudinary. Original en `docs/assets/` |
| Producto → Estado | `Product.status` | `ProductStatus` | `DRAFT` hasta que el precio esté confirmado |
| Producto → Disponibilidad | `Product.isAvailable` | `Boolean` | Switch operativo en vivo. Default `true` |
| Producto → Orden en la categoría | `Product.sortOrder` | `Int` | Default 0 |
| — | `ProductVariant` | — | **No se usa en v1.** Ver decisión D-02 |
| Negocio → nombre, WhatsApp, dirección, horarios, Instagram, avisos | `BusinessSettings.*` | `Json`/texto | Singleton `id = 1` |

### 3.2 Reglas de escritura de producto

**Nombre.** Tal como lo dice el cliente, sin abreviar ni reinventar. `Classic Jamón y Queso`, no `CJ&Q` ni `Jamón con queso topped`. La puntuación Exacta es responsabilidad del menu, no nuestra.

**Precio.** Número decimal con 2 lugares, en ARS: `1450.00`. Sin símbolo `$`, sin separador de miles, sin IVA agregado: el precio publicado es el precio que se cobra.

**Descripción.** 1 a 2 oraciones, **máximo 180 caracteres**. Describir el producto, no elogiarlo.

| ✅ Correcto | ❌ Incorrecto | Por qué |
|---|---|---|
| `Jamón cocido y queso cheddar en pan de miga.` | `¡El mejor de San Rafael! 😍` | Emoji, elogio, signo múltiple, y 0 información útil |
| `Miga de salvado con pollo a la plancha y maionesa casera.` | `SANDWICH DE POLLO SUPER RICO` | Mayúsculas sostenidas y adjetivo en lugar de ingrediente |
| `Bebida cola 500 ml, bien fría.` | `Gaseosa` | Falta el volumen, que es lo que el cliente compara |

**Alérgenos.** Solo claves del glosario de §5. Sin variantes ni sinónimos: si un producto dice `lactosa` y otro `leche`, el cliente no puede filtrar ni entender.

**Destacado.** `true` solo para lo que el negocio quiere empujar en la home. Con más de 6 destacados la home deja de funcionar como jerarquía.

**Foto.** Un producto sin foto confirmada se documenta en §6. Nunca se sube una foto de stock genérica: un sándwich que no se parece al real genera reclamos (y es exactamente el riesgo de confianza que el proyecto quiere evitar).

---

## 4. Slugs: reglas y desambiguación

**Regla de formato:** minúsculas, sin tildes, sin acentos, sin signos, palabras separadas por guion. `café con queso` → `cafe-con-queso`. Generar con una función pura `slugify()` testeada (DESIGN.md §5.4).

**Regla de desambiguación (definida acá, exigida por la Tarea 00 §9):** si dos productos de categorías distintas tienen el mismo nombre, el slug lleva el prefijo de la categoría.

| Nombre | Categoría | Slug |
|---|---|---|
| Jamón y Queso | Clásicos | `jamon-y-queso` |
| Jamón y Queso | Premium | `premium-jamon-y-queso` |

Y si aun así colisionan dentro de la misma categoría, se numera: `jamon-y-queso-2`. **Nunca** se resuelve una colisión cambiando un slug ya publicado: eso exige un 301 y un slug muerto indexado.

El set MOCK de §3 no tiene colisiones: los 23 slugs son únicos, así que ninguno lleva prefijo de categoría. La tabla de arriba queda como regla vigente para cuando el encargado confirme el menú real.

---

## 5. Glosario de alérgenos (obligatorio, cerrado)

Estas ocho claves son las únicas permitidas. Se usan **exactamente así**, en minúsculas y sin acentos.

| Clave (valor en DB) | Etiqueta visible | Dónde suele aparecer |
|---|---|---|
| `gluten` | Contiene gluten | Pan de miga, pan, y cualquier derivado |
| `lactosa` | Contiene lactosa | Queso, manteca, crema, leche |
| `huevo` | Contiene huevo | Principalmente la mayonesa casera |
| `maní` | Contiene maní | Poco habitual. Preguntar siempre: el local maneja aceite de maní para la fritura |
| `frutos secos` | Contiene frutos secos | Un solo grupo, no uno por fruto. La clienta no entiende la diferencia técnica |
| `sésamo` | Contiene sésamo | Barra de cereal |
| `soja` | Contiene soya | Salsas, pan de soya |
| `pescado` | Contiene pescado | Atún, salmón, y enlatados en general |

> **Corrección sobre la Tarea 00 §5:** el ejemplo de esa tabla dice `lacticosa` y el glosario dice `lactosa`. **La clave canónica es `lactosa`.** Esta tabla es la que manda.
>
> 🧩 **Ampliación propuesta, no confirmada:** la Tarea 00 fija siete claves. El set MOCK declara `pescado` en `Atún` y `Salmón y Palta`, y sin esa clave el filtro de alérgenos **no avisaría** a un cliente que no puede comer pescado: sería un fallo de seguridad de la información, no una omisión estética. Por eso `pescado` entra al glosario (ADR-24). Si el encargado prefiere los siete exactos de la Tarea 00, se **borran** `Atún` y `Salmón y Palta` en lugar de dejar productos con un alérgeno sin declarar. Las dos opciones están descritas y son reversibles; la elegida queda anotada en la reunión de descubrimiento.

### Contrato de presentación (lo implementa la Tarea 09, se define acá)

- **Nunca informar solo por color.** El alérgeno se comunica con **texto + ícono**, no con un badge de color. Un badge rojo sin texto no le dice nada a quien no distingue rojo de verde, y tampoco le dice al cliente *cuál* es el alérgeno.
- Mostrar solo los alérgenos que el producto declara. Un producto sin alérgenos **no muestra un bloque de alérgenos vacío**: lo dice explícitamente ("Sin alérgenos declarados"), porque el silencio se lee como "no secrementó".
- "Sin alérgenos declarados" no es "libre de alérgenos". La distinción legal importa: el local comparte cocina.
- Cada etiqueta tiene que ser legible en móvil: 44 px de alto mínimo, texto de 14 px o más, sin truncar.

### Trazas ycontamination cruzada

🔴 **MOCK:** se asume cocina compartida, así que el sitio muestra la nota global única *"Preparamos en una cocina compartida con otros alérgenos"*. Es la hipótesis conservadora: sobre-informar es un costo de texto, sub-informar es un riesgo para el cliente. Falta que el encargado la confirme.

---

## 6. Notas para la implementación

Checklist que la Tarea 05 y la Tarea 16 van marcando. Los ítems de fotos están cubiertos **con placeholders etiquetados**, no con fotos reales.

- [x] Placeholder para los 23 productos en `docs/assets/`, nombrado por slug (`roast-beef.jpg`) — 🔴 **son placeholders, no fotos**
- [x] Resolución 1600 × 1200 px (cumple el mínimo de 1200 px del lado mayor)
- [x] Sin stock photos genéricas
- [x] Ningún producto sin imagen: los 23 tienen archivo
- [ ] Sustituir cada placeholder por la foto real del local (Tarea 16). El archivo se llama igual: se reemplaza el contenido, no el nombre
- [ ] ¿Hay combos? **Sí, con la regla de D-03**: cada combo es un producto propio, sin relación con sus componentes
- [x] ¿Hay productos rotativos del día? **No.** Default aplicado: se modelan como productos normales y el encargado los togglea con `isAvailable`
- [ ] ¿Alguno se vende solo, sin combinar? `POR DEFINIR` — depende de la lista real
- [x] Frecuencia de cambio de precios o del menú: **cada 2 o 3 meses** (D-12), salvo productos de temporada

### Convención de los placeholders

Los 23 archivos de `docs/assets/` son imágenes generadas, no fotos. Todas llevan, de forma visible:

| Elemento | Texto |
|---|---|
| Banda superior | `IMAGEN MOCK - REEMPLAZAR` |
| Centro | El nombre del producto |
| Debajo del nombre | El slug, para verificar el emparejamiento con la fila de §3 |
| Pie | `Mi Negocio · dato simulado · 1600x1200` · `Pendiente de foto real del local` |

**Por qué la banda tiene que ser visible y no un detalle al pie:** un placeholder sin etiqueta visible acaba en producción cuando alguien sube la carpeta entera a Cloudinary creyendo que son fotos. La banda se lee a simple vista en un grid, que es exactamente donde se filtra el error.

**Regla de la Tarea 16:** un producto pasa a `PUBLISHED` con foto real, o se queda en `DRAFT` con su placeholder. No hay estado intermedio.

### Lo que NO existe en v1 (para no discutirlo de nuevo)

| No existe | Por qué |
|---|---|
| `ProductVariant` / modificadores (simple, doble, con queso / sin queso) | Decisión D-02: el carrito resuelve con cantidades y notas |
| Relaciones entre productos (`Combo` con items) | Decisión D-03: un combo es un producto con su propio precio y su propia foto |
| `daily_special` | Un producto del día es un producto con `isAvailable = false` cuando no hay |
| Stock numérico por producto | No hay control de inventario; hay un switch binario |
| Precios por zona o por horario | No lo pidió el negocio |
| Tabla `Order` | El pedido vive en WhatsApp (DESIGN.md §3.3) |

---

## 7. Protocolo de captura (para la reunión de descubrimiento)

Este protocolo no se ejecutó: describe lo que falta para reemplazar los mocks por datos reales.

1. Sacar foto o escanear el menú físico actual, tal como está. Aunque esté desactualizado, sirve de contraste.
2. Recorrer el menú de izquierda a derecha, categoría por categoría, anotando **en este mismo documento**.
3. Por cada producto: nombre exacto, precio, y una pregunta de alérgenos.
4. Repetir el precio en voz alta antes de escribirlo. Los errores de precio de un dígito son los más caros y los más difíciles de detectar.
5. Al terminar, **sumar tres productos a mano** y comparar contra la lista. Es el control más barato que existe.
6. Enviarle este documento al encargado y esperar el "está bien así" por escrito. Sin eso, la tarea no está cerrada.

### Qué cambia cuando lleguen los datos reales

| Paso | Acción sobre este documento |
|---|---|
| 1 | Quitar el banner 🔴 del encabezado |
| 2 | Reemplazar las 23 filas de §3 por el menú real. **No mezclar**: filas que no existan en el menú real se borran, no se quedan con precio mock |
| 3 | Ajustar la lista de alérgenos de cada producto con lo que declare el encargado. Si no puede declarar uno, `isAvailable: false` |
| 4 | Cambiar `status` de `DRAFT` a `PUBLISHED` solo en los productos con precio y foto real confirmados |
| 5 | Reemplazar el contenido de los 23 `.jpg` por las fotos reales, conservando el nombre de archivo |
| 6 | Reemplazar teléfono, dirección, horarios, delivery y métodos de pago de §1 por los reales |
| 7 | Cerrar B-1 a B-6 en la tabla de §0 y recién entonces marcar la Tarea 00 como ✅ |
