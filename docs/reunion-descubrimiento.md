# Reunión de Descubrimiento — Guion de trabajo

> **Propósito:** convertir una conversación con el encargado en los datos que cierran los bloqueos B-1 a B-6 de la [`Tarea 00`](./tasks/00-descubrimiento-y-auditoria.md).
> **Duración:** 60–90 minutos. **Preparativos:** 15 minutos previos (§1).
> **Origen de los datos actuales:** [`docs/menu-maestro.md`](./menu-maestro.md) 🔴 tiene 23 productos MOCK. Esta reunión existe para reemplazarlos.

Este documento no define datos. Es un guion para **sacar** datos: qué preguntar, en qué orden, qué anotar y cómo cerrar. El formato del mensaje de WhatsApp, que es lo más delicado, no se reescribe acá: su fuente de verdad es [D-01](./decisiones-negocio.md#d-01--formato-del-mensaje-de-whatsapp).

---

## 0. Antes de empezar: qué se juega esta reunión

| Sin la reunión | Con la reunión |
|---|---|
| El sitio publica 23 productos, 23 precios y 1 número de WhatsApp que **no existen** | El sitio publica el menú real |
| La Tarea 00 no se puede cerrar y arrastra el riesgo de datos a producción | B-1 a B-6 cerrados y Tarea 00 en ✅ |
| Los alérgenos del set MOCK son suposiciones | Cada alérgeno está confirmado por producto |
| La Tarea 16 no tiene fotos reales | Hay material para subir |

**El peor resultado posible** no es "no salir con nada". Es que la reunión parezca exitosa, se marque la tarea como cerrada, y el set MOCK termine en producción con el banner 🔴 como única defensa. Por eso el cierre escrito de §7 no es opcional.

**Si solo se llega a la mitad:** con las 5 preguntas marcadas 🔴 **bloqueantes** de §2, §3 y §4 se alcanza para desbloquear el seed. El resto se completa por WhatsApp con el mismo guion. La reunión parcial sirve; la reunión sin cierre escrito no.

---

## 1. Preparativos — 15 minutos, antes de sentarse

Tres pedidos que save hora de reunión si se hacen con antelación. Los tres por escrito, por WhatsApp o mail, para que quede registro.

| # | Pedido | Por qué antes y no durante | Si no se puede |
|---|---|---|---|
| 1.1 | **Foto o escaneo del menú físico actual**, tal como está | Es la fuente de precios más rápida. Aunque esté desactualizado, sirve de contraste: las diferencias con el menú real son en general productos que ya no se venden | Se recorre el local y se anotan los precios a mano, con el riesgo de errar un dígito |
| 1.2 | **El número de WhatsApp Business, escrito** | Es la pregunta 8 y bloquea la Tarea 05 entera. Además se necesita para el deep-link, así que sin él no se puede hacer ni la prueba de §6 | Se sigue con la reunión y queda pendiente una sola pregunta por chat |
| 1.3 | **Fotos de los productos**, aunque sean de celular y con flash | La Tarea 16 necesita originales. Descubrir al final que no hay ninguna foto cambia el alcance | Se planifica la sesión de fotos: 20 minutos, luz natural, sin flash |

> **El número de WhatsApp va sin `+`.** `wa.me/5492615000000` y `wa.me/542615000000` abren conversaciones distintas, y un `+`, un espacio o un guion rompen el enlace sin error visible: el chat abre vacío (D-04). Se pide el número **en E.164 y confirmarlo por escrito**.

---

## 2. Agenda — Catálogo (25 minutos)

Es el bloque de mayor impacto: de acá sale la forma de las tablas de Prisma (Tarea 03) y la semilla (Tarea 05).

| # | Prioridad | Pregunta | Qué anotar |
|---|---|---|---|
| 2.1 | 🔴 | ¿Cuántos productos hay? ¿Todos se venden o alguno está en el menú pero no se prepara? | Recuento total, y lista aparte de los que no se venden |
| 2.2 | 🔴 | ¿Cómo los agrupan hoy? | Los grupos que diga, con sus nombres exactos. Eso define las categorías y su orden |
| 2.3 | 🔴 | ¿Cuál es el precio de cada uno? | Un precio por producto. **Repetir en voz alta antes de escribir** |
| 2.4 | 🔴 | Alérgenos, **producto por producto** | Ver §2.5. Es el dato de mayor riesgo de todo el proyecto |
| 2.5 | | ¿Hay combos? | Si hay: nombre, precio, y qué incluye. **No** preguntar cómo se modelan: ya está decidido (D-03) |
| 2.6 | | ¿Alguno se vende solo, sin combinar con otro? | Lista. Define qué se puede pedir de a uno |
| 2.7 | | ¿Alguno es "del día" o rotativo? | Si hay producto del día, se apaga con `isAvailable`. No se modela aparte |

### 2.4 · Alérgenos: cómo preguntar

La pregunta original de la Tarea 00 era *"¿alguno tiene alérgenos relevantes?"*. Es demasiado débil: el set MOCK declara alérgenos en 18 de 23 productos, y una respuesta general no alcanza para ninguno. Se pregunta en tres partes.

| Parte | Pregunta | Por qué importa |
|---|---|---|
| **a · Por producto** | Por cada producto, qué ingredientes tienen gluten, lactosa, huevo, soya, sésamo, maní, frutos secos o **pescado** | Un filtro de alérgenos que deja pasar lo que debe filtrar es peor que no tener filtro (ADR-24) |
| **b · Cocina compartida** | ¿La freidora es compartida? ¿Se prepara gluten en la misma superficie que los sándwiches? | Si comparte, el sitio muestra una **nota global única** en lugar de repetir "puede contener trazas" en cada producto. Hoy el set MOCK asume que sí |
| **c · Excepción real** | ¿Hay algún producto que **no** lleve un alérgeno que se esperaría? (ej.: mayonesa casera → huevo) | El silencio en la ficha no significa ausencia. Una inferencia equivocada en la dirección de "declarar de más" molesta; en la de "declarar de menos" es un problema de salud |

> **El glosario tiene 8 claves**, no las 7 de la Tarea 00: se agregó `pescado` (ADR-24). Si el encargado prefiere el glosario corto, la alternativa acordada es **quitar** `Atún` y `Salmón y Palta` del menú, nunca dejar el alérgeno sin declarar.

### 2.8 · Control de precios

Al terminar la lista, **sumar tres productos a mano** y comparar contra los valores anotados. Es el control más barato que existe: los errores de precio de un dígito son los más difíciles de detectar después.

---

## 3. Agenda — Operación (20 minutos)

| # | Prioridad | Pregunta | Qué anotar |
|---|---|---|---|
| 3.1 | 🔴 | ¿El número de WhatsApp Business es único? ¿Cuál, en E.164 sin `+`? | **Por escrito.** Bloquea la Tarea 05 y la prueba de §6 |
| 3.2 | 🔴 | ¿Horarios exactos por día? ¿Qué días cierra? | Un par abre/cierra por día. Un día cerrado es `null`, no un horario vacío |
| 3.3 | | ¿Atienden por delivery? ¿Radio máximo? ¿Mínimo de compra? | Radio en km, mínimo en ARS. Si no hay delivery, `fulfillment` se reduce a `"pickup"` |
| 3.4 | | ¿Hay horario de corte para delivery? | Distinto del cierre del local si lo hay |
| 3.5 | | ¿Métodos de pago? | Se comunican en el chat, no se cobran en el sitio (D-07) |
| 3.6 | | ¿Retiro en el local? ¿Dirección exacta y cómo llegar? | Dirección ≤240 car., más una referencia aparte ≤120 car. |
| 3.7 | | ¿Con qué frecuencia cambian los precios o el menú? | Alimenta la ventana de caché de la Tarea 08. Hoy el supuesto es 2 o 3 meses (D-12) |
| 3.8 | | ¿Hay Instagram? ¿Cuál? | Si no hay, `instagramUrl: null` y la UI oculta el enlace. El MOCK usa un perfil ficticio |

> 🔴 **El mínimo de compra (3.3) es la única pregunta capaz de provocar una conversación incómoda.** Si el carrito no llega al mínimo y el checkout no lo avisa, el cliente arma un pedido completo y se lo rechaza al final. Si el local no tiene mínimo real, se deja en `null`: es preferible no tener la función antes que tenerla mal.

---

## 4. Agenda — Administración y contenido (10 minutos)

| # | Prioridad | Pregunta | Qué anotar |
|---|---|---|---|
| 4.1 | | ¿Quién va a usar el panel? ¿Cuántas personas? | Hoy el modelo asume **un** administrador con `role: OWNER` (D-09) |
| 4.2 | | ¿Prefiere entrar con email y contraseña, o con un enlace mágico al mail? | El enlace mágico es el default porque es más simple de usar (D-10). Confirmar o cambiar |
| 4.3 | 🔴 | ¿Tiene fotos de los productos? ¿En qué calidad? | Si no, sesión de fotos: 20 min, luz natural, sin flash, 1200 px del lado mayor |
| 4.4 | | ¿Tiene dominio propio? ¿O usamos un subdominio? | Impacta `NEXT_PUBLIC_SITE_URL` y la Tarea 18. **Decidir antes de la Tarea 21** |
| 4.5 | | ¿Tiene CUIT o datos fiscales para el pie de página? | Solo para el aviso legal. No es bloqueante |

---

## 5. Lo que ya está decidido: no preguntar

Estas cinco quedaron cerradas en la Tarea 00 con criterio propio. Volver a abrirlas consume minutos de reunión que hacen falta para los precios y los alérgenos.

| Tema | Decisión | Por qué no se reabre |
|---|---|---|
| ¿Variantes de producto? | **No.** El carrito resuelve con cantidades y notas (D-02) | La tabla `ProductVariant` queda en el schema sin uso. Agregarlas después es un CRUD en el panel, no una migración |
| ¿Analytics o tracking? | **Ninguno.** La medición es manual (D-14) | El volumen no lo justifica, y un tercero en un sitio que manda gente a WhatsApp es un costo de privacidad desproporcionado |
| ¿El precio del carrito se revalida? | **No.** Es una instantánea del cliente (D-13) | El precio se acuerda en el chat, que es el canal real. Revalidar cuesta un endpoint público extra |
| ¿Cómo se modela un combo? | **Producto independiente**, sin relación con sus componentes (D-03) | Si hay combos, son productos más: tienen su precio, su foto y su switch de disponibilidad |
| ¿Qué formato de mensaje? | **Variante C** (híbrida con notas), por default (D-01) | Es la que el encargado no puede decidir. **No está cerrada**: se valida en §6, que es otra cosa |

> La última fila es la trampa de esta sección. **Elegir el formato por default no es lo mismo que haberlo acordado.** Por eso §6 y §7 existen, y por eso el formato sí aparece en la prueba de dispositivo aunque la decisión no vuelva a preguntarse.

---

## 6. Prueba del mensaje en dispositivo real (20 minutos)

**Este es el paso más importante de la tarea** ([Tarea 00 §6.3](./tasks/00-descubrimiento-y-auditoria.md)). El formato del mensaje es el producto final de todo el sistema, y los saltos de línea y el formato se ven distinto en la app que en el texto plano. Es el riesgo R2 de [`DESIGN.md`](../DESIGN.md).

> 🔴 **Requiere el número de WhatsApp real.** No se puede hacer con el MOCK: el deep-link abriría una conversación de un número inexistente. Si el número real no llegó (§1.2), esta prueba se corre en la primera semana y se anota como tal.

### 6.1 · Procedimiento

1. Armar **tres mensajes** con el mismo pedido de ejemplo, con la estructura de la Variante A, B y C. Texto literal en [D-01](./decisiones-negocio.md#d-01--formato-del-mensaje-de-whatsapp).
2. Generar el **deep-link** de cada uno: `https://wa.me/<número>?text=<mensaje codificado>`. Solo dígitos en el número, sin `+`.
3. Enviar los tres **desde un teléfono real**, no desde el escritorio. Enviarlos a otro contacto que responda, para ver el render del lado del cliente también.
4. Repetir en **Android e iPhone**. Los clientes se reparten entre las dos plataformas y el fallback de texto plano no se ve en ninguna.
5. Verificar los 7 puntos de §6.2 y la prueba de robustez de §6.3.
6. Preguntar las 4 preguntas de formato de §6.4.

### 6.2 · Los 7 puntos a mirar

Cada uno sale de una fila de la especificación línea por línea de [D-01](./decisiones-negocio.md#d-01--formato-del-mensaje-de-whatsapp).

| # | Qué verificar | Si falla |
|---|---|---|
| 1 | Las negritas de WhatsApp se ven **en negrita real**: `*Mi Negocio*`, `*Total:*` y `*Mis datos:*` | Los asteriscos no se estáncapeando en el paso de encoding |
| 2 | Los **saltos de línea** se respetan. Nada se junta en un bloque ni se parte a la mitad | Se está perdiendo un `\n` en la codificación: hay que enviar `%0A` |
| 3 | Los **acentos** intactos: `¡Hola!`, `Av. San Martín`, `Jamón` | Doble encoding, o el cliente pegó el mensaje en un campo que no acepta UTF-8 |
| 4 | El **formato de moneda** es `$3.700`, con punto de miles y sin decimales | `Intl.NumberFormat("es-AR", { currency: "ARS", minimumFractionDigits: 0 })` no se está aplicando |
| 5 | El deep-link abre la **conversación con el mensaje ya pegado**, no en blanco | El `text=` no viaja: revisar `encodeURIComponent` sobre el mensaje entero |
| 6 | La **URL del enlace** tiene solo dígitos, sin `+`, sin espacios, sin guiones | Un `+` rompe el enlace en silencio. Es la causa más frecuente de "no me abre" |
| 7 | Las **líneas condicionales** aparecen solo cuando corresponde: con retiro no debe imprimirse `Entrega en:`, y sin notas no debe imprimirse `Comentarios:` | La plantilla no está condicionando por `fulfillment` ni por notas |

### 6.3 · Prueba de robustez

Una sola prueba extra, y es la que más información da por segundo: escribir en el campo de notas algo con asteriscos —`sin mayonesa, *por favor*`— y mandar.

**Lo esperado:** el texto llega con los asteriscos como caracteres, **sin** convertirse en negrita. El texto del cliente no debe poder inyectar formato en el pedido. Si se pone en negrita, la sanitización de D-01 no está funcionando y hay que arreglarlo antes de seguir.

### 6.4 · Preguntas de formato

Son las que el encargado contesta en el momento, mirando el mensaje renderizado. No son abstractas: se responden mirando la pantalla.

- [ ] ¿`*texto*` se ve en negrita en tu WhatsApp? *(sí, es formato oficial)*
- [ ] ¿`$3.700` con punto de miles se entiende?
- [ ] ¿"Mis datos" o preferís "Datos de entrega"?
- [ ] ¿Querés que aparezca la dirección del local cuando el cliente retira?
- [ ] ¿Falta algo que siempre te mandan por mensaje y no quedaría en la web?
- [ ] ¿Conviene que el cliente escriba un saludo o que vaya directo al pedido?

---

## 7. El cierre: el "está bien así"

Sin este paso, la reunión **no cuenta**. Es lo que separa una tarea cerrada de un menú supuesto.

### 7.1 · Qué se pide

1. Mandar [`docs/menu-maestro.md`](./menu-maestro.md) ya sin el banner 🔴, y **el resumen de los alérgenos por producto** en un mensaje aparte.
2. Pedir una respuesta explícita a cada uno:

| # | Pedido | Por qué separado |
|---|---|---|
| 7.1 | Confirmación escrita del **menú**: productos, precios, categorías, horarios, delivery | Es la confirmación de B-6 |
| 7.2 | Confirmación escrita de los **alérgenos por producto** y de la cocina compartida | ⚠️ **No alcanza con el "está bien así" del menú.** Si los alérgenos fueron inferidos a partir de los ingredientes, el encargado puede dar por obvio lo que no está en la ficha, y un cliente con una restricción se apoya justamente en eso. Es una confirmación distinta y tiene que pedirse como tal |
| 7.3 | **Variante de mensaje** elegida, después de la prueba de §6 | D-01 pasa de `proposed` a `confirmed` |
| 7.4 | Quién es el **administrador** y su email real | Reemplaza `dueno@modo-miga.invalid` |

### 7.2 · Después de recibir la confirmación

| Paso | Acción |
|---|---|
| 1 | Quitar el banner 🔴 del encabezado de [`docs/menu-maestro.md`](./menu-maestro.md) |
| 2 | Reemplazar las filas MOCK por el menú real, con la checklist de `docs/menu-maestro.md` §7. **No mezclar**: lo que no exista en el menú real se borra, no conserva el precio simulado |
| 3 | Cambiar `status: DRAFT` a `PUBLISHED` solo en los productos con precio y foto confirmados |
| 4 | Reemplazar el contenido de los 23 `.jpg` conservando el nombre de archivo |
| 5 | Reemplazar teléfono, dirección, horarios, delivery y métodos de pago |
| 6 | Correr la Tarea 05: el seed vuelve a cargar el catálogo real |
| 7 | Cerrar B-1 a B-6 en la tabla de la §0 del menú maestro |

---

## 8. Lo que esta reunión **no** puede cerrar

| Bloqueo | Por qué no se cierra acá | Cuándo |
|---|---|---|
| **B-7 · Línea base real** | Necesita 7 días de conteo de mensajes reales del chat, no una reunión | Semana posterior. La línea base MOCK de [`docs/operacion-actual.md`](./operacion-actual.md) sirve de referencia, no de reemplazo |
| **Medición del OB-1** | Depende de la línea base real y de tener el sitio en producción | Tarea 22, primera semana post-lanzamiento |
| **Línea base de OB-2** (pedidos incompletos) | Requiere ver conversaciones reales | En la misma semana de relevamiento, sin costo adicional |

> La Tarea 00 **no puede pasar a ✅ con la línea base MOCK.** Es el único ítem del Definition of Done que no se resuelve en esta reunión, y por eso la Tarea 00 se divide en dos: datos capturados (se cierra acá) y medición (se cierra en la semana de relevamiento).

---

## 9. Cobertura de la Tarea 00 §6.2

Las 16 preguntas del guion original, para que la lista de la tarea y esta agenda no divergan.

| Pregunta de §6.2 | Dónde está en este documento |
|---|---|
| 1 · ¿Cuántos productos hay? | §2.1 |
| 2 · ¿Cómo los agrupan? | §2.2 |
| 3 · ¿Cada producto tiene variantes? | §5 — **decidido: no** (D-02) |
| 4 · ¿Precio de cada uno? ¿Hay combos? | §2.3 y §2.5 |
| 5 · ¿Alérgenos relevantes? | §2.4, reemplazada por 3 preguntas |
| 6 · ¿Se venden solos? | §2.6 |
| 7 · ¿Producto del día o rotativo? | §2.7 |
| 8 · ¿Número de WhatsApp? | §1.2 y §3.1 — 🔴 bloqueante |
| 9 · ¿Delivery, radio, mínimo? | §3.3 |
| 10 · ¿Horarios y días de cierre? | §3.2 — 🔴 bloqueante |
| 11 · ¿Métodos de pago? | §3.5 |
| 12 · ¿Retiro y dirección? | §3.6 |
| 13 · ¿Frecuencia de cambios? | §3.7 |
| 14 · ¿Quién usa el panel? | §4.1 |
| 15 · ¿Login preferido? | §4.2 |
| 16 · ¿Fotos? | §1.3 y §4.3 — 🔴 bloqueante para la Tarea 16 |
