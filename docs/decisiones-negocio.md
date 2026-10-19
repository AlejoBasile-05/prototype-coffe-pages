# Decisiones de Negocio

> **Registro vivo** de las decisiones tomadas con el encargado. Cada decisión queda firme salvo que se indique lo contrario.
> **Última actualización:** 2026-09-28 · **Responsable:** [PENDIENTE]

> ## 🔴 Origen de los valores: MOCK
>
> **Ninguna decisión de este documento fue tomada con el encargado.** No hubo reunión: el proyecto arrancó sin datos reales y se decidió avanzar con valores simulados para poder desarrollar.
>
> | Tipo de decisión | Estado real |
> |---|---|
> | Decisiones **de proyecto** (D-02, D-07, D-11, D-13, D-14) | Decididas por nosotros, con criterio propio. Válidas sin el encargado |
> | Decisiones **con default de diseño** (D-01, D-03, D-05, D-10, D-12) | Adoptan el default de la Tarea 00 §9 y quedan a la espera de validación |
> | Decisiones **con valor simulado** (D-04, D-06, D-08, D-09) | El valor de negocio es MOCK. Ver `docs/menu-maestro.md` |
>
> **Ninguna de estas decisiones habilita el lanzamiento.** El estado `🟡 proposed` se mantiene, y los valores simulados están marcados uno por uno. La columna "Estado" de §1 y la nota 🔴 en cada decisión con valor mock son deliberadamente redundantes: una decisión de negocio leída sin contexto tiene que seguir mostrando que el dato es simulado.

## Cómo se usa este documento

| Elemento | Regla |
|---|---|
| **Qué se registra acá** | Decisiones de negocio: qué vende el local, cómo opera, qué se le pide al cliente, qué formato tiene el mensaje |
| **Qué NO se registra acá** | Decisiones técnicas. Esas van en el ADR log de `DESIGN.md` §18 |
| **Cómo se cierra** | Una decisión pasa de `🟡 proposed` a `✅ confirmed` cuando el encargado la valida por escrito (WhatsApp o mail) |
| **Cómo se revierte** | Se agrega una fila nueva que diga "revierte D-XX" con el motivo. No se edita la decisión original: el historial es el valor |

**Estados:** `🟡 proposed` (default del proyecto, esperando al encargado) · `✅ confirmed` (validado por el negocio) · `⛔ rejected`.

---

## 1. Resumen de decisiones

| # | Decisión | Estado | Impacto principal |
|---|---|---|---|
| [D-01](#d-01--formato-del-mensaje-de-whatsapp) | Formato del mensaje de WhatsApp (Variante C) | 🟡 proposed | **Tarea 12** — especificación literal |
| [D-02](#d-02--sin-variantes-de-producto) | Sin variantes de producto | ✅ confirmed | **Tarea 03** — `product_variants` no se usa en v1 |
| [D-03](#d-03--sin-relaciones-ni-composiciones-entre-productos) | Sin relaciones entre productos | ✅ confirmed | **Tarea 03, 05** — un combo es un producto |
| [D-04](#d-04--una-sola-línea-de-whatsapp) | Una sola línea de WhatsApp | 🟡 proposed 🔴 | **Tarea 03, 17** — `BusinessSettings.whatsappPhone` |
| [D-05](#d-05--los-horarios-se-publican-en-el-sitio) | Los horarios se publican en el sitio | 🟡 proposed 🔴 | **Tarea 10** |
| [D-06](#d-06--política-de-envío) | Política de envío: radio y mínimo | 🟡 proposed 🔴 | **Tarea 13** |
| [D-07](#d-07--los-métodos-de-pago-se-coordinan-por-chat) | Métodos de pago por chat | ✅ confirmed | ADR-3 |
| [D-08](#d-08--retiro-en-el-local) | Retiro en el local | 🟡 proposed | **Tarea 13** |
| [D-09](#d-09--un-solo-administrador) | Un solo administrador | 🟡 proposed 🔴 | **Tarea 03, 07** — un registro en `staff_members` |
| [D-10](#d-10--login-por-enlace-mágico) | Login por enlace mágico | 🟡 proposed | **Tarea 07** |
| [D-11](#d-11--no-se-piden-datos-que-el-sistema-no-usa) | No se piden datos que el sistema no usa | ✅ confirmed | **Tarea 13** — minimización de datos |
| [D-12](#d-12--frecuencia-de-cambio-de-precios) | Frecuencia de cambio de precios | ✅ confirmed | **Tarea 08** — ventana de caché |
| [D-13](#d-13--el-precio-del-carrito-es-una-instantánea) | El precio del carrito es una instantánea | ✅ confirmed | **Tarea 11, 13** — resuelve decisión pendiente #2 |
| [D-14](#d-14--sin-instrumentación-de-analytics) | Sin instrumentación de analytics | ✅ confirmed | **Tarea 22** — resuelve decisión pendiente #3 |

🔴 = la decisión tiene un valor de negocio simulado pendiente de confirmación.

---

## 2. Decisiones tomadas con el negocio

### D-01 · Formato del mensaje de WhatsApp

**Estado:** 🟡 proposed — adoptada por default según la Tarea 00 §9 ("si el encargado no puede decidir, se decide la Variante C y se confirma en producción durante la primera semana").
**Implementación:** Variante C corresponde a `DEFAULT_MESSAGE_VARIANT = "hybrid"` en `src/lib/whatsapp/message-contract.ts` (Tarea 12). Cambiar el formato es cambiar esa constante; agregar una variante solo toca `MessageVariant`, `MESSAGE_VARIANT_LABELS` y `RENDERERS` en `message-variants.ts`.
**Resuelve:** el paso más importante de la Tarea 00. Es la especificación literal de `buildWhatsAppMessage` (Tarea 12).

#### Las tres variantes que se presentaron

> 🔴 Los datos de los ejemplos (productos, precios, teléfono, dirección) son MOCK y coinciden con `docs/menu-maestro.md` §3 para que la Tarea 12 pueda probarlos de punta a punta. Lo que no es MOCK es el **formato**.

**Variante A — Detallada**

```
¡Hola! Quiero hacer un pedido en *Mi Negocio*:

• 2 x Jamón y Queso — $2.900
• 1 x Gaseosa 500 ml — $800

*Total: $3.700*

*Mis datos:*
Nombre: Juan Pérez
Teléfono: 2615000000
Entrega en: San Rafael, Av. San Martín 1234

¡Gracias!
```

**Variante B — Mínima**

```
Hola! Mi pedido:
2 x Jamón y Queso
1 x Gaseosa 500 ml
Total: $3.700
Soy Juan Pérez, tel 2615000000, retiro en el local.
```

**Variante C — Híbrida con notas (elegida)**

```
¡Hola! Quiero hacer un pedido en *Mi Negocio*:

• 2 x Jamón y Queso — $2.900
• 1 x Gaseosa 500 ml — $800

*Total: $3.700*

*Mis datos:*
Nombre: Juan Pérez
Teléfono: 2615000000
Entrega en: San Rafael, Av. San Martín 1234
Comentarios: Sin mayonesa por favor

¡Gracias!
```

#### Por qué C

| Criterio | A | B | C |
|---|---|---|---|
| El total se ve de un vistazo | ✅ | ❌ Enterrado en prosa | ✅ |
| El chat es reenviable / comparable | ❌ | ❌ | ✅ Una línea por producto, escaneable |
| Admite comentarios ("sin mayonesa") | ❌ | ❌ | ✅ |
| Largo de leer | Medio | Corto | Medio |
| Negritas de WhatsApp se usan | 2 | 0 | 2 |
| Riesgo de que el cliente no envíe | Bajo | **Alto** (se pierde la separación) | Bajo |

B es la que más rápido se lee pero la que peor se procesa: si el encargado reenvía el pedido a cocina o al delivery, no hay forma de parsear "2 x Jamón y Queso" y el total de un vistazo sin partirlo. C mantiene la estructura de A y agrega el campo que en la práctica más falta.

#### Especificación línea por línea (esto es lo que implementa la Tarea 12)

| # | Línea | Regla exacta |
|---|---|---|
| 1 | `¡Hola! Quiero hacer un pedido en *<nombre del negocio>*:` | Texto fijo. El nombre sale de `BusinessSettings.name` |
| 2 | *(vacía)* | Separador |
| 3 | `• <cantidad> x <nombre del producto> — <precio de la línea>` | Separador de cantidad: `" x "` con espacios. El precio es el **subtotal de la línea**, no el precio unitario |
| 4 | *(vacía)* | Separador, **solo si hay más de una línea de producto** |
| 5 | `*Total: <ARS>*` | En negrita de WhatsApp. Suma de las líneas |
| 6 | *(vacía)* | Separador |
| 7 | `*Mis datos:*` | En negrita. Literal fijo |
| 8 | `Nombre: <nombre completo>` | Tal cual lo tipeó el cliente |
| 9 | `Teléfono: <teléfono>` | **Como lo tipeó el cliente**, en formato legible local. El E.164 normalizado es solo para el deep-link |
| 10 | `Entrega en: <dirección>` | Solo si `fulfillment = delivery` |
| 10' | `Retiro en el local` | Solo si `fulfillment = pickup` |
| 11 | `Comentarios: <notas>` | Solo si el cliente escribió notas. Sin línea en blanco antes |
| 12 | *(vacía)* | Separador |
| 13 | `¡Gracias!` | Cierre fijo |

> **Convención de etiquetas:** `Entrega en:`, `Teléfono:`, `Comentarios:` empiezan con mayúscula salvo `Comentarios`, que va en minúscula porque es un añadido opcional al bloque de datos. Es la única excepción y se mantiene por coherencia con la Variante C aprobada.

#### Reglas de robustez (obligatorias, no negociables)

| Regla | Detalle | Por qué |
|---|---|---|
| **Presupuesto de longitud** | 1800 caracteres. Si se excede, se recorta **el bloque de comentarios** y se agrega `…` | WhatsApp trunca en silencio y se pierde el pedido. Ver DESIGN.md §6.3 |
| **Límite de notas** | 240 caracteres en el campo de notas del checkout | Protege el presupuesto de longitud desde el origen, en vez de recortar arriba |
| **Asteriscos del usuario** | Se eliminan de nombre, dirección y notas | El cliente escribe `*ayer*` y WhatsApp lo renderiza en negrita: el pedido llega con formato roto. El texto del cliente no debe poder inyectar formato |
| **Caracteres de control** | Se eliminan de nombre, dirección y notas (`\n`, `\t`, `\r` en esos campos) | Saldrán líneas falsas en el mensaje |
| **Notas con saltos de línea** | Se **conservan** (test case 5 de `DESIGN.md` §13.3) | "Sin mayonesa" y "sin sal" en dos líneas es información real |
| **Formato de moneda** | `Intl.NumberFormat("es-AR", { currency: "ARS", minimumFractionDigits: 0 })` | `$3.700` con punto de miles es el estándar argentino. El cliente lo entiende sin explicación |
| **Encoding** | `encodeURIComponent` sobre el mensaje entero; `\n` → `%0A` | Un `&` en la dirección trunca el query string del deep-link |
| **Teléfono en la URL** | Solo dígitos, E.164 **sin `+`** | Un `+`, un espacio o un guion rompen el enlace |
| **Carrito vacío** | Devuelve un error controlado, no un string vacío | Mensaje vacío = deep-link a un chat en blanco |
| **Orden de las líneas** | En el mismo orden en que se agregaron al carrito | El pedido se lee como lo pensó el cliente |
| **Flag de datos mock** | El seed publica productos solo si `process.env.SEED_PUBLISH_MOCK === "true"`. Sin el flag, todo mock queda en `DRAFT` | Un `if (!process.env.SEED_PUBLISH_MOCK) return` en el seed: sin la variable, no se publica nada. Ningún mock llega a producción por descuido |

#### Preguntas de validación para el encargado

- [ ] ¿`*texto*` se ve en negrita en tu WhatsApp? *(sí, es formato oficial)*
- [ ] ¿`$3.700` con punto de miles se entiende?
- [ ] ¿"Mis datos" o preferís "Datos de entrega"?
- [ ] ¿Querés que aparezca la dirección del local cuando el cliente retira?
- [ ] ¿Falta algo que siempre te mandan por mensaje y no quedaría en la web?
- [ ] ¿Conviene que el cliente escriba un saludo o que vaya directo al pedido?

#### Prueba obligatoria en dispositivo real

- [ ] Las tres variantes enviadas **desde un teléfono real** al WhatsApp del local
- [ ] Render verificado en WhatsApp Android
- [ ] Render verificado en WhatsApp iPhone
- [ ] Verificado que los acentos y las negritas se ven correctos
- [ ] Variante elegida confirmada por escrito por el encargado

> Esto es exactamente el riesgo **R2** de `DESIGN.md` §17. La diferencia entre el texto plano y la app es la causa más común de "se ve rarísimo el mensaje". Por eso la Tarea 12 tiene una suite de tests: la prueba manual valida el formato, los tests validan la función.

---

### D-02 · Sin variantes de producto

**Estado:** ✅ confirmed
**Resuelve:** decisión pendiente #1 de `docs/tasks/README.md`.

El carrito resuelve con **cantidades y notas**. No hay simple/doble, ni con Ruire/sin Ruire, ni modificadores de ningún tipo.

**Consecuencias directas:**

| Consecuencia | Detalle |
|---|---|
| Modelo | `ProductVariant` **no se usa en v1**. Puede quedar en el schema (ya está definido) o eliminarse. Si queda, documentar que está sin uso para que nadie lo consume por error |
| Repositorio | La Tarea 04 **no** necesita `createVariant` / `updateVariant` / `deleteVariant` |
| Panel | La Tarea 16 no muestra gestión de variantes. Cierra la deuda técnica "variantes no editables desde el panel" |
| Carrito | La cantidad es un entero simple, con límites 1–20 por producto |
| UI | Todo lo que no sea cantidad entra en el campo de notas |

**Alternativa si el encargado se contradice después:** el modelo ya soporta variantes; agregarlas cuesta un CRUD en el panel, no una migración. Es exactamente el motivo por el que la tabla está en el schema aunque no se use.

---

### D-03 · Sin relaciones ni composiciones entre productos

**Estado:** ✅ confirmed — decisión de proyecto. No requiere al encargado: es la forma más simple de modelar un combo, y el schema ya la soporta.
**Regla:** un combo es un **producto propio**, con nombre, precio, descripción, alérgenos y foto propios. No hay relación entre el combo y sus componentes.

**Por qué:** una tabla de relaciones obliga a resolver precio, disponibilidad y alérgenos de un combo como operaciones derivadas. Con la regla actual, "Combo Familiar" es un producto más y el carrito lo maneja sin código extra. Si mañana el combo deja de estar disponible, se apaga con el switch, igual que cualquier otro.

**Aplicado en el set MOCK:** `Combo Clásico`, `Combo Premium` y `Combo Familiar` son tres filas de `Product` más, sin tabla de relaciones. Sus alérgenos (`gluten`, `lactosa`, `huevo`) están declarados a mano en cada combo, no derivados de los componentes: es la consecuencia directa de esta decisión, y hay que acordarse de actualizarlos cuando cambie un sándwich.

> ⚠️ **Lo que sigue sin saberse:** si el local vende combos, y cuáles. La existencia de combos en `docs/menu-maestro.md` §3 es una suposición de diseño, no un dato. Si el local no tiene combos, las tres filas se borran y no cambia nada del modelo.

---

### D-04 · Una sola línea de WhatsApp

**Estado:** 🟡 proposed 🔴 — el valor cargado es MOCK
**Regla:** un único número E.164 **sin `+`**, con prefijo 54. `BusinessSettings.whatsappPhone` es singular y único.

**Valor cargado:** `5492615000000` 🔴

**Por qué importa técnicamente:** `wa.me/5492615000000` y `wa.me/542615000000` abren conversaciones distintas. Un dígito de más y todos los pedidos caen en un número que no existe, sin ningún error visible para el cliente: el chat abre vacío.

> 🔴 El valor cargado es un número inexistente, elegido para que ningún pedido de prueba llegue a una persona real. **No es un número "de prueba, da igual": es un placeholder y hay que reemplazarlo antes del lanzamiento.** Al reemplazarlo, probar el deep-link desde un teléfono real.

---

### D-05 · Los horarios se publican en el sitio

**Estado:** 🟡 proposed 🔴 — los horarios cargados son MOCK
**Regla:** el menú público muestra el horario de cada día y el estado abierto/cerrado en el momento actual.

**Por qué:** *"¿están abiertos?"* y *"¿hasta qué hora atienden?"* son las dos preguntas informativas más repetidas de un local con delivery. Publicarlas en el sitio es la corrección más barata del OB-1. Fuera de horario se muestra `closingMessage`.

> 🔴 Los horarios de `docs/menu-maestro.md` §1 son una simulación. El caso de **domingo cerrado** es el supuesto más caro del set: define qué muestra la web el domingo y en los feriados, que se calculan con la misma lógica. Si el local abre los domingos, hay que corregirlo antes de publicar, no después.

---

### D-06 · Política de envío

**Estado:** 🟡 proposed 🔴 — los valores cargados son MOCK

| Campo | Valor | Comportamiento si no hay delivery |
|---|---|---|
| Radio máximo | `5` km 🔴 | El checkout no ofrece envío, solo retiro |
| Mínimo de compra | `3000.00` ARS 🔴 | Sin mínimo: el carrito no bloquea por monto |
| Horario de corte | 20:30 L–V · 21:30 Sáb 🔴 | Sin corte: el pedido llega al chat y el encargado lo coordina |

**Default si el local no tiene delivery:** `fulfillment` se reduce a `"pickup"` en el checkout y `Entrega en:` nunca se imprime en el mensaje. El modelo ya soporta ambos casos, así que agregar delivery después es cambiar la UI, no el modelo.

> **El mínimo es el único valor del proyecto capaz de provocar una conversación incómoda.** Si el carrito no llega al mínimo y el checkout no lo avisa, el cliente arma un pedido completo y se lo rechaza al final: es la forma más rápida de perder la confianza que el sitio construye. Si el local no tiene mínimo real, se deja en `null`. Preferible no tener la función antes que tenerla mal.

---

### D-07 · Los métodos de pago se coordinan por chat

**Estado:** ✅ confirmed
**Regla:** efectivo, transferencia, y lo que se agregue. Se publican como texto informativo en el sitio y se confirman en el chat.

**Por qué:** es una decisión de negocio explícita, y sostiene el ADR-3 (sin pagos online). El sitio no maneja datos de pago: **no hay campos de tarjeta, ni billetera, ni ningún dato que roza un flujo de cobro**. Eso también elimina de raíz una clase entera de requisitos de seguridad (PCI).

> 🔴 Los métodos cargados en el menú maestro (`Efectivo`, `Transferencia bancaria`) son MOCK, pero **la decisión de fondo no lo es**: sin importar cuáles sean, el sitio nunca cobra.

---

### D-08 · Retiro en el local

**Estado:** 🟡 proposed
**Regla:** el retiro siempre está disponible, sin horario de reserva en v1 (ADR-20). El mensaje imprime `Retiro en el local`; la dirección vive en el sitio, no en el mensaje.

**Pregunta abierta para la reunión:** ¿el local tiene problemas con clientes que retiran y no aparecen? Si sí, el motivo es de confianza y no lo resuelve el sistema: se resuelve con la nota del chat.

---

### D-09 · Un solo administrador

**Estado:** 🟡 proposed 🔴 — el email cargado es MOCK
**Regla:** un único usuario del equipo por ahora. `staff_members` tiene **un** registro, con `role: OWNER`. El enum `StaffRole` se mantiene completo (`OWNER` / `STAFF`) para no romper el schema si aparece un segundo usuario.

**Cuenta cargada:** `dueno@modo-miga.invalid` 🔴

> 🔴 **El dominio `.invalid` está elegido a propósito** (RFC 2606): no resuelve en DNS, así que ningún correo de recuperación de contraseña puede llegar a una casilla real ni a un servicio de terceros. Es lo contrario de un `@example.com` mal elegido, que sí se puede registrar. Cuando se cargue el email real, se actualiza **también** la documentación del despliegue, que hoy asume que ese correo no existe.

**Por qué:** el modelo soporta N usuarios desde v1 sin esfuerzo extra (DESIGN.md §9). Agregar un segundo encargado después es una fila en la tabla, no una migración.

---

### D-10 · Login por enlace mágico

**Estado:** 🟡 proposed
**Regla:** el admin entra con un enlace mágico por email. Sin contraseñas que recordar ni que resetear. El email de la cuenta va en `staff_members.email`.

**Requisitos de seguridad asociados (no negociables):**

| Requisito | Detalle |
|---|---|
| Email verificado | El enlace mágico solo llega a la dirección registrada. Es la verificación de identidad |
| 2FA en la cuenta | Requisito de `DESIGN.md` §8.7 y mitigación de T8. Mail + 2FA en el mismo dispositivo, aceptable para un panel de un usuario |
| Mensajes de error genéricos | Un login que dice "ese email no existe" habilita enumeración de cuentas (T9) |
| Logout real | Invalidación de sesión, no solo borrar la cookie del cliente |
| Rate limiting | El login es público en `/login`. Sin límite de intentos es fuerza bruta pura |

> Si el encargado prefiere email + contraseña, la Tarea 07 ya lo implementa. El enlace mágico es el default **porque es más simple de usar**, y OB-5 (independencia operativa) pesa más que la familiaridad.

---

### D-11 · No se piden datos que el sistema no usa

**Estado:** ✅ confirmed
**Regla:** el checkout pide **exactamente** tres cosas: nombre, teléfono y dirección (solo si es envío). Más un campo opcional de notas.

**No se pide:** email, DNI, fecha de nacimiento, teléfono alternativo, documentación, ni información de pago.

**Por qué:** el pedido no se persiste en ninguna parte (ADR-4). El nombre y el teléfono existen en el mensaje de WhatsApp mientras el cliente lo mira, y en ningún otro lado. Pedirle un email a alguien para armar un sándwich es fricción sin destino, y más datos de contacto es más superficie de exposición si el proyecto alguna vez crece.

**Consecuencia técnica:** ningún dato de cliente llega al servidor. El checkout arma el mensaje **en el cliente** y navega a `wa.me`. El backend nunca ve el nombre, el teléfono ni la dirección. Es la mejor minimización de datos posible, y sale gratis de la arquitectura de handoff.

> **Por qué esta decisión no depende del encargado:** no existe motivo de negocio para volver atrás, y es la más difícil de revertir una vez que el sitio acumuló contactos. Por eso queda `confirmed` sin esperar a la reunión.

---

### D-12 · Frecuencia de cambio de precios

**Estado:** ✅ confirmed — decisión de proyecto
**Regla:** el menú cambia **cada 2 o 3 meses** como máximo. Los productos de temporada no cuentan como cambio: se apagan con `isAvailable`, no se editan.

**Impacto:** la ventana de revalidación de caché de la Tarea 08 puede ser de **1 día**. Con un cambio cada 2 o 3 meses, una ventana larga no aporta nada y una corta no cuesta caro. Publicar desde el panel dispara la revalidación, así que el precio se ve al instante de cambiarlo.

> **El panel resuelve la frecuencia, no la caché.** La ventana de caché protege contra cambios hechos **fuera** del panel, y en este proyecto no hay ninguno. La frecuencia importa para dimensionar la ventana, no al revés. Por eso 1 día alcanza y no hace falta optimizarla más.

---

### D-13 · El precio del carrito es una instantánea

**Estado:** ✅ confirmed
**Resuelve:** decisión pendiente #2 de `docs/tasks/README.md`.

**Regla:** el checkout **no** revalida precios contra el servidor. Muestra el total que el cliente armó y lo manda. Si el encargado cambió un precio entre que el cliente armó el carrito y presionó "enviar", el mensaje llega con el precio anterior y el encargado lo corrige en el chat.

**Por qué:** revalidar contra el servidor requiere un endpoint público extra y una capa de invalidación de líneas, y no resuelve el problema real. El cliente no va a notar un precio desactualizado en el mensaje; lo que va a notar es que la web le cobre una cantidad y el local cobre otra. La conversación de WhatsApp sigue siendo el lugar donde se acuerda el precio.

**Mitigación parcial, barata:** el precio de cada línea viene del catálogo cacheado, que se revalida al publicar. El caso de divergencia real es un cambio de precio en la misma hora del pedido.

---

### D-14 · Sin instrumentación de analytics

**Estado:** ✅ confirmed
**Resuelve:** decisión pendiente #3 de `docs/tasks/README.md`.

**Regla:** no se instala ningún tracker de terceros ni se agrega un endpoint de conteo de clics. La medición es manual, con la línea base de `docs/operacion-actual.md` y las métricas del hosting.

**Por qué:** el volumen no justifica un tracker, y un tercero en un sitio que manda gente a WhatsApp es un costo de privacidad desproporcionado. Un evento propio para contar clics en el botón de WhatsApp es exactamente la clase de feature mínima que no se justifica: el dato real de pedidos está en el chat, que ya existe.

**Consecuencia asumida:** dos de los siete KPI de `DESIGN.md` §16 (tiempo medio de armado del pedido, productos con mayor rotación) no se van a medir. Se acepta explícitamente en lugar de agregar tracking para después no mirar.

---

## 3. Lo que quedó sin decidir

Ninguna de estas cuestiones se resolvió: se cargó un valor MOCK para poder desarrollar, y el valor MOCK **no** la cierra.

| Cuestión | Cómo quedó cargada (MOCK) | Por qué no se decidió | Cuándo se decide |
|---|---|---|---|
| Precio de cada producto | 23 precios en `docs/menu-maestro.md` §3 | Requiere al encargado | Reunión de descubrimiento |
| Horarios por día | L–V 09–21, Sáb 09–22, Dom cerrado | Requiere al encargado | Reunión |
| Radio de delivery y mínimo | `5` km · `3000.00` | Requiere al encargado | Reunión |
| Número de WhatsApp | `5492615000000` (inexistente) | Requiere al encargado, por escrito | Antes de la Tarea 21 |
| ¿Hay combos? | Sí, 3 combos como productos propios (D-03) | Requiere al encargado | Reunión |
| ¿Hay productos rotativos del día? | No. Default `isAvailable` (D-12) | Requiere al encargado | Reunión |
| Alérgenos de cada producto | 18 productos declarados, 5 sin alérgenos | Requiere al encargado. **Es el dato de mayor riesgo del set** | Reunión |
| Trazas / cocina compartida | Nota global "cocina compartida" | Requiere al encargado | Reunión |
| Dominio propio | Sin definir. Impacta `NEXT_PUBLIC_SITE_URL` y la Tarea 18 | Requiere al encargado | Antes de la Tarea 21 |
| Nombre del responsable | `[PENDIENTE]` | Se completa al confirmar la tarea | — |

---

## 4. Checklist de cierre de la Fase 0

Nada de esto se puede marcar con los datos actuales. El checklist documenta qué falta, no lo que se hizo.

- [ ] Todas las decisiones con estado `proposed` confirmadas o reemplazadas por escrito
- [ ] `docs/menu-maestro.md` completo y confirmado por el encargado, **sin el banner 🔴**
- [ ] Formato del mensaje elegido y **probado en un teléfono real**
- [ ] `docs/operacion-actual.md` con la línea base **medida**, no la MOCK
- [ ] Fotos reales de al menos el 80% del menú reemplazando los placeholders
- [ ] `SEED_PUBLISH_MOCK` ausente del entorno de producción
- [ ] `DESIGN.md` §16 con la línea base real cargada
- [ ] `docs/tasks/README.md` con la Tarea 00 en ✅

---

## 5. Datos MOCK y el seed

La Tarea 05 escribe el seed contra los valores de este documento. Para que el mock sea seguro por construcción y no por disciplina:

| Regla | Dónde vive |
|---|---|
| Todos los productos mock se crean con `status: DRAFT` | Seed de la Tarea 05 |
| Publicar un mock exige `SEED_PUBLISH_MOCK === "true"` | Regla obligatoria de D-01 |
| Sin esa variable, el seed **no publica nada** | early return en el seed |
| El teléfono y el email mock apuntan a destinos inválidos | Menú maestro §1, D-04, D-09 |
| El banner 🔴 viaja con los datos: ningún documento los da por buenos | Encabezado de los tres documentos de `docs/` |

> **Por qué "inválido" y no "de ejemplo".** Un número real o un `@example.com` son destinations válidas: el primero puede pertenecer a alguien, el segundo se puede registrar. Un número inexistente y un dominio `.invalid` fallan de forma ruidosa y segura, que es lo que se quiere de un dato placeholder.
