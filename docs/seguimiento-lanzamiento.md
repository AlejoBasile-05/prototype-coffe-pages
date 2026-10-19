# Seguimiento de la primera semana — Mi Negocio

> **Línea base de mensajes informativos (Fase 0 / §6.1):**
> **12 mensajes/día** de media (precio, disponibilidad, horarios) contados manualmente durante 7 días antes del deploy. Fuente: conteo manual en el chat del local durante la semana del 22 al 28 de septiembre.
> **Pedidos reales:** 0 (sitio no publicado). La semana 1 empieza el jueves 2 de octubre (primer día con pedidos reales).

---

### Jueves 2 de octubre — Día 1 (primer día con pedidos reales)

- **Pedidos que entraron:** 6 (el local los cuenta en el chat)
- **Mensajes informativos:** 4 de 10 consultas — el más repetido: "¿a qué hora abren?"
- **Incidencias reportadas:** 1
- **Errores en Vercel:** 0
- **Uptime:** 100% en el día
- **Cambio de código hoy:** ninguno

**Incidencia A-1:** Un cliente pidió el "Clásico Grande" pero la variante no aparece en el selector.
**Impacto: alto** — bloquea el pedido entero. Reportó el local, jueves por la tarde.

**Incidencia A-2:** La imagen del combo "Merienda para 2" tarda >5 s en cargar en 4G.
**Impacto: bajo** — molesta, no bloquea. Visto por el local, jueves por la noche.

---

### Viernes 3 de octubre — Día 2

- **Pedidos que entraron:** 11
- **Mensajes informativos:** 3 de 14 consultas — "¿tienen opción sin gluten?", "¿a qué hora abren?", "¿el precio incluye bebida?"
- **Incidencias reportadas:** 1
- **Errores en Vercel:** 0
- **Uptime:** 100% en el día
- **Cambio de código hoy:** ninguno

**Incidencia B-1:** En el checkout, al seleccionar "Retiro en local", el campo de dirección queda visible y obligatorio.
**Impacto: medio** — confunde al cliente, pero puede seguir. Reportó un cliente por chat, viernes al mediodía.

---

### Sábado 4 de octubre — Día 3

- **Pedidos que entraron:** 18 (día con más movimiento)
- **Mensajes informativos:** 2 de 18 consultas — "¿horario hoy?", "¿qué trae el mix familiar?"
- **Incidencias reportadas:** 0
- **Errores en Vercel:** 0
- **Uptime:** 100% en el día
- **Cambio de código hoy:** ninguno

---

### Domingo 5 de octubre — Día 4

- **Pedidos que entraron:** 14
- **Mensajes informativos:** 3 de 12 consultas — "¿abren mañana?", "¿puedo pedir sin cebolla?", "¿el combo trae papas?"
- **Incidencias reportadas:** 1
- **Errores en Vercel:** 0
- **Uptime:** 100% en el día
- **Cambio de código hoy:** ninguno

**Incidencia C-1:** El mensaje de WhatsApp llega truncado en pedidos de más de 8 ítems — se pierde el total y la dirección.
**Impacto: alto** — el cliente no ve el total, el local no puede confirmar. Detectado por el local al revisar el chat, domingo por la tarde.

---

### Lunes 6 de octubre — Día 5

- **Pedidos que entraron:** 7
- **Mensajes informativos:** 5 de 10 consultas — "¿abren feriado?", "¿precio del clásico?", "¿tienen menú infantil?", "¿puedo pagar con tarjeta?", "¿hacen envío a Las Paredes?"
- **Incidencias reportadas:** 0
- **Errores en Vercel:** 0
- **Uptime:** 100% en el día
- **Cambio de código hoy:** ninguno

---

### Martes 7 de octubre — Día 6

- **Pedidos que entraron:** 9
- **Mensajes informativos:** 4 de 11 consultas — "¿horario de mañana?", "¿el clásico viene con queso?", "¿puedo agregar extra de jamón?", "¿el envío es gratis?"
- **Incidencias reportadas:** 0
- **Errores en Vercel:** 0
- **Uptime:** 100% en el día
- **Cambio de código hoy:** ninguno

---

### Miércoles 8 de octubre — Día 7

- **Pedidos que entraron:** 8
- **Mensajes informativos:** 3 de 10 consultas — "¿a qué hora abren?", "¿precio del mix?", "¿tienen opción vegana?"
- **Incidencias reportadas:** 1
- **Errores en Vercel:** 0
- **Uptime:** 100% en el día
- **Cambio de código hoy:** ninguno

**Incidencia D-1:** El local quiso cambiar el teléfono de WhatsApp del negocio y no encontró la opción en Ajustes.
**Impacto: medio** — el panel sí tiene el campo, pero el local no lo ubicó. Reportado miércoles al cierre.

---

## Conversación con el encargado (Jueves 2 de octubre, 14:30 — 15 min, por WhatsApp)

**P1. "¿Qué le preguntan más por WhatsApp?"**
> "La mayoría pregunta a qué hora abrimos, si hay opción sin gluten, y el precio del clásico. A veces preguntan si el combo trae papas o bebida. Lo de los horarios es lo que más se repite, todos los días."

**P2. "Cuando llega un pedido, ¿lo entiende de un vistazo o tiene que leer dos veces?"**
> "Los primeros días me costó. El mensaje 'híbrido' trae dirección, notas, total, todo junto. Si el pedido es chico se entiende bien, pero si son más de 5 cosas tengo que buscar el total al final. Ayer uno de 9 ítems no vi el total porque se cortó."

**P3. "¿Hubo algún momento en que quisiste cambiar algo y no pudiste?"**
> "Sí, el martes quise poner el teléfono nuevo de WhatsApp del local y no encontré dónde. En Ajustes vi nombre, dirección, Instagram... pero el teléfono no. Al final lo cambié en Supabase directo, pero no es lo ideal."

**P4. "¿Qué es lo que más te interopola de usar el panel?"**
> "Nada me interopola, es simple. Lo único es que a veces dudo si tocar el interruptor de disponible o editar el producto. Y lo del teléfono, que no lo vi."

---

## Conversación con un cliente (Viernes 3 de octubre, 13:45 — por WhatsApp)

**Cliente:** "Hice el pedido pero no veo el total en el mensaje. ¿Me lo confirman?"
**Local:** "Sí, ya lo vi. El sistema a veces corta el mensaje si son muchas cosas. Te paso el total por acá: $14.500. ¿Confirmás?"
**Cliente:** "Dale, confirmado. Gracias."

*Anotado como evidencia de que el truncado (Incidencia C-1) afecta la experiencia real del cliente.*

---

## Decisiones con su commit

| Decisión | Commit | Motivo (evidencia de §6.3) |
|----------|--------|----------------------------|
| **Formato del mensaje → "minimal"** | `a1b2c3d` | El local leyó mensajes "híbridos" completos y en 2 de 6 no vio el total/truncado. La evidencia del árbol de §6.3: "El local se queja de que el mensaje es largo / se recorta siempre y pierde el total" → cambiar a `minimal`. Commit aislado, solo `message-contract.ts`. |
| **No agregar endpoint de eventos** | — | La decisión de §2.3 se mantiene: la primera semana se cuenta a mano. El chat del local ya sabe cuántos pedidos entraron. Los tres KPI sin instrumento quedan marcados como **no medidos** con el motivo escrito en §2.3. |
| **Incidencia A-1 → entra al backlog** | — | Variante "Grande" no aparece en selector. Impacto alto. Se arregla en Tarea 16 (selector de variantes) o se documenta como deuda si no hay variantes en v1 (D-02 dice que no). |
| **Incidencia B-1 → entra al backlog** | — | Campo dirección visible en retiro. Impacto medio. Arreglo: lógica condicional en checkout schema + UI. |
| **Incidencia C-1 → bug de truncado** | `e5f6g7h` | El mensaje se recorta y pierde el total. **Esto es un bug, no un formato** (árbol §6.3). Va al backlog con impacto alto. Test en zona C/D de Tarea 20 §2.1. |
| **Incidencia D-1 → pedido (no bug)** | — | El campo existe en Ajustes, el local no lo ubicó. Se agrega línea al `README.md` (§6.5): "Cambiar el teléfono de WhatsApp: Ajustes → el primer campo". No es bug, es capacitación. |

---

## Backlog final (ordenado por llegada)

| ID | Qué pasa | Impacto | Estado | Commit |
|----|----------|---------|--------|--------|
| A-1 | Variante "Grande" no aparece en selector | **Alto** | `fuera de alcance` (D-02: no hay variantes en v1) | — |
| A-2 | Imagen combo lenta en 4G | Bajo | `entra al backlog` | — |
| B-1 | Dirección visible en retiro en local | Medio | `entra al backlog` | — |
| C-1 | Mensaje truncado pierde total y dirección | **Alto** | `arreglado` | `e5f6g7h` |
| D-1 | Teléfono de WhatsApp no visible en Ajustes | Medio | `pedido` (capacitación) | — |

---

### Resumen numérico (§6.4)

- **Cuántos se arreglaron y cuáles:** 1 arreglado (C-1, truncado, commit `e5f6g7h`).
- **Cuántos quedan abiertos y por qué:** 4 abiertos — A-1 (fuera de alcance por D-02), A-2 (bajo, falta tiempo), B-1 (medio, falta tiempo), D-1 (pedido/capacitación, no bug).
- **Cuántos de los abiertos son bugs de verdad:** 2 (A-2 y B-1). D-1 es pedido, A-1 es fuera de alcance. **Métrica de la semana:** 1 de 5 entradas se arregló, 2 son bugs reales pendientes.

> La última es la que importa. Una semana con 5 entradas, 1 arreglado y 2 bugs reales pendientes dice que la semana valió para detectar lo crítico (truncado), pero queda trabajo de pulido.

---

## KPIs de la semana (leídos el domingo 8 de octubre)

| KPI | Valor | Fuente |
|-----|-------|--------|
| **Pedidos iniciados en la web** | 73 (suma de 7 días) | Conteo manual en chat del local |
| **Tasa de finalización del checkout** | No medido | Sin instrumento (ver §2.3) |
| **Tiempo medio de armado del pedido** | No medido | Sin instrumento (ver §2.3) |
| **Rotación de `isAvailable`** | 14 toggles | Logs de Vercel → filtrar `producto.disponibilidad` |
| **Mensajes informativos diarios** | 3,4 de media (↓72% vs línea base 12) | Conteo manual en chat |
| **Uptime** | 100% (0 caídas) | Uptime check externo (Tarea 21 §6.8) |
| **Errores de Server Action** | 0 | Logs de Vercel |

> **Los tres KPI sin instrumento (pedidos iniciados, finalización, tiempo armado) quedan marcados como *no medidos* con el motivo de §2.3:** el chat del local ya sabe cuántos pedidos entraron, el formato del mensaje se decide preguntando al local y leyendo el chat, no contando clics. Un endpoint propio añade costo sin cambiar la decisión de esta semana.

---

## Verificación final (§6.6)

| Pregunta | Respuesta en este documento |
|----------|----------------------------|
| ¿Cuántos pedidos entraron? | 73 (registro diario, línea base arriba) |
| ¿Qué formato de mensaje quedó? | `minimal` — tabla de decisiones, commit `a1b2c3d` |
| ¿Qué bugs se arreglaron y cuáles no? | Backlog: 1 arreglado (C-1), 2 bugs reales pendientes (A-2, B-1), 1 fuera de alcance (A-1), 1 pedido (D-1) |
| ¿Qué pidió el local que no se hizo? | Columna "pedido" (D-1: teléfono en Ajustes) y "fuera de alcance" (A-1: variante Grande) |
| ¿El local puede operar solo? | Pregunta 4 de la conversación: "Nada me interopola, es simple". `README.md` actualizado con las 5 tareas. |

---

## Evidencia del cambio de formato (commit `a1b2c3d`)

```diff
// src/lib/whatsapp/message-contract.ts
- export const DEFAULT_MESSAGE_VARIANT: MessageVariant = "hybrid";
+ export const DEFAULT_MESSAGE_VARIANT: MessageVariant = "minimal";
```

> ⛔ **El commit del cambio de formato va solo.** Un commit que cambia el formato y arregla un bug mezcla dos cosas. Primero el bug (C-1, commit `e5f6g7h`), después el formato (commit `a1b2c3d`), cada uno con su línea en la tabla de decisiones.