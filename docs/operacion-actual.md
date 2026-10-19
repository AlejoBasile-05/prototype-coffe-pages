# Operación Actual — Línea Base

> **Propósito:** medir cómo funciona hoy el negocio para poder demostrar después que el sistema lo mejoró.
> **Estado:** 🟡 Línea base MOCK cargada · Medición real no realizada
> **Período previsto para la medición real:** 7 días naturales completos
> **Responsable del relevamiento:** [PENDIENTE]

> ## 🔴 DATOS MOCK — LA MEDICIÓN REAL SIGUE PENDIENTE
>
> La planilla de §3 está completa con **números inventados a propósito**, para que el resto del proyecto tenga una cifra de referencia contra la cual trabajar.
>
> | Qué sirve este mock | Qué no sirve |
> |---|---|
> | Dimensionar el formulario de relevamiento y la Tarea 21 | Demostrar el OB-1 |
> | Fijar la meta derivada a 30 días como criterio de aceptación | Comparar contra el mundo real |
> | Practicar el criterio de clasificación de §2 con quien va a medir | Sustituir la semana de relevamiento |
>
> **La línea base real sigue siendo obligatoria antes del lanzamiento.** Con estos números, cualquier resultado posterior también es una simulación. Ver `docs/tasks/00-descubrimiento-y-auditoria.md` (B-7).

Este documento responde una sola pregunta: **¿cuánto trabajo manual genera hoy el pedido manual por WhatsApp?** Sin esa respuesta medida, el objetivo OB-1 de `DESIGN.md` §2.1 —reducción ≥ 70% de mensajes informativos— es indemostrable. No es una formalidad de proceso: es el número con el que se define si el proyecto funcionó.

---

## 1. Por qué 7 días y no 3

`DESIGN.md` §16 pide 7 días completos; la Tarea 00 §6.1 pide 3 a 5. **Manda 7.** El negocio de sándwiches tiene un ciclo semanal muy marcado: el fin de semana no se parece a un martes, y medir solo de martes a viernes produce una línea base que después nadie se cree. Si por fuerza hay que recortar, el mínimo aceptable son **6 días, de los cuales al menos 2 son de fin de semana**.

---

## 2. Clasificación de mensajes (la parte que hay que aplicar bien)

Un mismo chat puede tener mensajes de los tres tipos. Se cuenta **por mensaje**, no por conversación.

| Tipo | Qué es | Ejemplo | Se elimina con la web |
|---|---|---|---|
| **Informativo** | Pregunta o respuesta de precio, disponibilidad, horario, dirección, métodos de pago, formas de pedir | *"¿Cuánto sale el de roast beef?"* · *"¿Hasta qué hora atienden?"* | ✅ Sí — es el objetivo del proyecto |
| **Pedido real** | Mensaje que termina en una venta | *"2 de jamón y queso y una coca"* + confirmación | ❌ No — la web no cobra, el chat sigue existiendo |
| **Otros** | Conversación no transaccional: consultas de otra cosa, spam, mensajes personales, clima, memes, consultas de otro local | *"¿Tenés delivery a Maipú?"* cuando no hay delivery | ❌ No — pero se puede reducir publicando horarios y dirección |

> **La distinción informativa / pedido es la única que importa para el OB-1.** Si la conversación mezcla las tres cosas, contar todo como "informativo" infla la línea base y después hace imposible demostrar la reducción. Cuando el encargado responda un precio dentro de un chat que termina en pedido, ese mensaje se cuenta como **pedido real**, no como informativo.

### Métricas a registrar por día

| Métrica | Cómo se mide | Por qué |
|---|---|---|
| Mensajes diarios totales | Conteo manual de todos los mensajes recibidos | Volumen bruto del canal |
| Mensajes informativos | Conteo manual con la clasificación de §2 | **Es la métrica del OB-1** |
| Mensajes que son pedidos reales | Conteo manual | Volumen y tamaño real del negocio |
| Tickets promedio | Mensajes de cliente + mensajes de encargado, divididos por pedidos | El trabajo real por pedido |
| Pedidos perdidos por rotura de stock | Estimación del encargado | Alimenta el OB-3 |
| Mensajes de un mismo cliente por día | Máximo y promedio | Detecta el cliente que más Molesta |

---

## 3. Planilla de registro

Una fila por día. 🔴 **Los valores de esta tabla son MOCK.** Cuando se mida de verdad, se reemplazan y la tabla vuelve a ser el registro de la semana real.

| # | Fecha | Día de la semana | Recibidos | ↳ Informativos | ↳ Pedidos | ↳ Otros | Enviados | Tickets promedio | Pedidos perdidos por stock | Observación |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `2026-09-14` | Lunes | 31 | 19 | 8 | 4 | 21 | 6.5 | 0 | Día tipo. Mayoría de consultas de precio |
| 2 | `2026-09-15` | Martes | 34 | 21 | 9 | 4 | 23 | 6.3 | 0 | Día tipo |
| 3 | `2026-09-16` | Miércoles | 29 | 17 | 8 | 4 | 21 | 6.2 | 0 | Día más bajo de la semana |
| 4 | `2026-09-17` | Jueves | 36 | 22 | 9 | 5 | 24 | 6.7 | 0 | Subida hacia el fin de semana |
| 5 | `2026-09-18` | Viernes | 48 | 29 | 13 | 6 | 34 | 6.3 | 1 | Pico de la semana. Un pedido perdido por falta de roast beef |
| 6 | `2026-09-19` | Sábado | 61 | 39 | 15 | 7 | 41 | 6.8 | 1 | Pico absoluto. Horario extendido hasta las 22:00 |
| 7 | `2026-09-20` | Domingo | 0 | 0 | 0 | 0 | 0 | — | 0 | **Cerrado.** 0 es un dato, no una línea vacía |

**Por qué hay una columna de mensajes enviados:** el ticket promedio que importa para el OB-4 es el trabajo que hace el encargado, y ese trabajo está en lo que **responde**, no en lo que recibe. Un ticket calculado solo con mensajes recibidos (3.9 en esta semana) subestima el esfuerzo real a menos de la mitad. Por eso la planilla separa enviados de recibidos, y el ticket se calcula sobre la suma de ambos.

**Por qué el promedio se calcula sobre 6 días y no sobre 7:** el domingo el local está cerrado (menú maestro §1, 🔴 MOCK). Promediar sobre una línea con 0 baja artificialmente todas las métricas y exagera el OB-1: la web no puede reducir el trabajo de un día en que no se trabaja. Los promedios de §4 excluyen el domingo, y la línea del domingo se conserva en la tabla como registro del cierre.

**Método de registro (para que los números sean comparables):**

1. Un solo responsable cuenta. El criterio de clasificación no puede cambiar a mitad de semana.
2. Conteo manual a fin de jornada, no en vivo. Contar en vivo distrae al encargado de vender.
3. Se cuenta el día **completo**: el trabajo empieza antes de abrir (preparación) y termina después de cerrar (pedidos del día que se coordinan el otro día).
4. Guardar capturas del chat para los días de mayor volumen. Son la evidencia de que los números son reales.
5. Registrar también los **días cerrados**: un domingo con 0 mensajes es un dato, no una línea vacía.

---

## 4. Línea base consolidada (para `DESIGN.md` §16)

🔴 Valores calculados sobre la planilla MOCK de §3. Se muestran los números y también la cuenta, para que se vea de dónde salen y sea trivial reemplazarlos cuando la medición sea real.

| Métrica de línea base | Valor | Cálculo | Período |
|---|---|---|---|
| Mensajes diarios totales (promedio) | `39.8` | 239 ÷ 6 días de atención | 14 – 19 sep 2026 🔴 MOCK |
| **Mensajes informativos diarios (promedio)** | `24.5` | 147 ÷ 6 | 14 – 19 sep 2026 🔴 MOCK |
| **Mensajes informativos semanales** | `147` | 19+21+17+22+29+39 | 14 – 19 sep 2026 🔴 MOCK |
| Pedidos reales diarios (promedio) | `10.3` | 62 ÷ 6 | 14 – 19 sep 2026 🔴 MOCK |
| Porcentaje de mensajes informativos | `61.5%` | 147 ÷ 239 | 14 – 19 sep 2026 🔴 MOCK |
| Tickets promedio (mensajes por pedido) | `6.5` | (239 recibidos + 164 enviados) ÷ 62 pedidos | 14 – 19 sep 2026 🔴 MOCK |
| Pedidos perdidos por rotura de stock | `2` | viernes y sábado, uno por día | 14 – 19 sep 2026 🔴 MOCK |
| **Meta derivada a 30 días (informativos, −70%)** | `≤ 7.4` | 24.5 × 0.30, redondeado hacia arriba | proyección |

> **El ticket promedio cuenta los mensajes de los dos lados.** Es el trabajo real que ve el encargado: si solo se contaran los del cliente, el indicador de OB-4 quedaría artificialmente bajo y la mejora parecería mayor de lo que es.

### Bloque a copiar en `DESIGN.md` §16

```markdown
**Línea base medida (Fase 0, Task 00):** período 14 – 19 de septiembre de 2026, 6 días de
atención (el domingo 20/09 el local estaba cerrado y se excluye del promedio).
Promedio de 39.8 mensajes diarios totales, de los cuales **24.5 son informativos** (61.5%) y
10.3 son pedidos reales. Tickets promedio: 6.5 mensajes por pedido. Pedidos perdidos por
rotura de stock: 2 en la semana.
**Meta a 30 días post-lanzamiento: ≤ 7.4 mensajes informativos diarios** (OB-1).
```

> 🔴 **Este bloque está cargado con datos MOCK.** Cuando exista la medición real, se reemplaza en bloque. El texto no se reescribe "un poco": o es la línea base medida, o es una simulación, y tiene que decir cuál.

---

## 5. Descripción del flujo actual

Después de hablar con el encargado, describir **cómo se hace hoy**, con sus palabras. Esto alimenta la Tarea 13 (checkout) y la Tarea 21 (capacitación), y es lo que permite detectar los mensajes que la web no va a eliminar.

| Paso | Qué hace hoy el cliente | Qué responde hoy el encargado | ¿Lo resuelve la web? |
|---|---|---|---|
| 1. Descubrir precio | Escribe "¿cuánto sale X?" | Precio de memoria | ✅ Sí |
| 2. Ver si hay | Escribe "¿tenés X?" | Sí / no, según el día | ✅ Sí (switch `isAvailable`) |
| 3. Saber horarios y dirección | Escribe "¿hasta qué hora?" / "¿dónde están?" | Horario y dirección | ✅ Sí |
| 4. Armar el pedido | Escribe los productos de a uno, a veces mal | Reconstruye el pedido | ⚠️ Parcialmente: acota a productos publicados, pero la elección sigue siendo del cliente |
| 5. Enviar datos | Escribe nombre, teléfono, dirección, uno por mensaje | Anota a mano | ✅ Sí (checkout) |
| 6. Confirmar precio total | Pregunta "¿cuánto sale todo?" | Suma | ✅ Sí (total en el mensaje) |
| 7. Pagar y coordinar | Se coordina por chat | Se coordina | ❌ Fuera de alcance por decisión ADR-3 |
| 8. Consultar métodos de pago | Escribe "¿aceptás transferencia?" | Responde | ✅ Sí (se publica en el sitio) |

> **El paso 4 es el que más se va a demorar.** La web acota el pedido a productos publicados y calcula el total sola, pero no puede adivinar qué quiere el cliente. Ese es un límite real del sistema y conviene decirlo explícitamente en la reunión, para no prometerlo.

### Fricciones observadas

🔴 Estas fricciones se **derivaron de los números MOCK** de §3, no de una conversación con el encargado. Sirven como hipótesis a verificar durante la medición real.

| Fricción | Dónde | Impacto |
|---|---|---|
| Casi dos de cada tres mensajes son consultas de precio | Chat de WhatsApp | Es el volumen que el OB-1 propone eliminar. 24.5 de 39.8 mensajes diarios |
| El pico del sábado concentra casi un cuarto de los pedidos de la semana | Sábado de 9 a 22 | 15 de 62 pedidos (24.2%). El sábado es el día de mayor carga y el de horario extendido. Un fallo de la web un sábado pega el doble |
| Se pierden pedidos por falta de stock | Viernes y sábado mock | 2 en la semana. Justifica el switch `isAvailable` (OB-3) |
| El cliente arma el pedido de a uno y a veces mal | Paso 4 del flujo | El encargado tiene que reconstruirlo. El ticket promedio de 6.5 mensajes por pedido es el costo de esa reconstrucción |

---

## 6. Relación con los objetivos de negocio

| Objetivo | Línea base necesaria | Estado | Valor MOCK |
|---|---|---|---|
| OB-1 · Reducción ≥ 70% de mensajes informativos | Mensajes informativos diarios | 🟡 MOCK | `24.5` → meta `≤ 7.4` |
| OB-2 · ≥ 90% de pedidos completos | Tasa actual de pedidos incompletos (faltan datos) | 🔴 No medido | — |
| OB-3 · 0 ventas perdidas por stock | Pedidos perdidos por rotura de stock | 🟡 MOCK | `2` por semana |
| OB-4 · ≤ 20 s de trabajo por pedido | Tickets promedio | 🟡 MOCK | `6.5` mensajes por pedido |
| OB-5 · Independencia operativa | No es un KPI medible | — | — |

> **OB-2 y OB-4 también necesitan línea base.** El sistema nuevo promete reducir el trabajo por pedido, pero sin el dato de hoy no hay forma de mostrar que lo redujo. Aprovechar la misma semana de medición para contar cuántos pedidos llegan incompletos evita tener que abrir una segunda ventana de relevamiento.

> **OB-2 sigue sin número MOCK.** No se lo inventó a propósito: para estimar cuántos pedidos llegan incompletos hace falta ver conversations reales, y una estimación inventada no aportaría nada. Se mide en la misma semana, sin costo adicional.

---

## 7. Qué falta para cerrar la línea base

- [ ] Reemplazar los 7 días MOCK de §3 por una semana real de relevamiento
- [ ] Capturas del chat de los días de mayor volumen, como evidencia
- [ ] Contar pedidos incompletos para tener la línea base de OB-2
- [ ] Pegar la línea base consolidada real en `DESIGN.md` §16.1, reemplazando el bloque MOCK
- [ ] Cerrar B-7 en la Tarea 00
