# Tarea 22 — Soporte Post-Lanzamiento

| Campo | Valor |
|---|---|
| **ID** | 22 |
| **Fase (DESIGN.md §8.8)** | Fase 6 — Buffer y Soporte |
| **Depende de** | 21 |
| **Habilita** | — (cierra el proyecto) |
| **Tipo** | Transversal |
| **Esfuerzo est.** | Ongoing · primera semana completa, y después por reporte |

---

## 1. Objetivo de la tarea

Una sola cosa: usar la primera semana de tráfico real para decidir tres cosas que no se pueden decidir antes de tener pedidos de verdad — **qué formato de mensaje funciona, qué bugs se arreglan y cuáles no, y qué queda anotado para que el local pueda operar el panel solo**.

No es una tarea de agregar funcionalidad. Es la única fase del proyecto cuyo entregable no es código: es una decisión tomada con evidencia y escrita.

**Criterio de éxito verificable:** existe `docs/seguimiento-lanzamiento.md` con los siete días registrados, con al menos una conversación escrita con el encargado y una con un cliente; el formato del mensaje se decide con esos datos y la decisión queda en el commit que la aplica; el backlog final tiene cada entrada con un impacto y una decisión de sí o no; y `README.md` dice cómo agregar un producto, marcarlo agotado y cambiar el teléfono del local, sin nadie que lo explique.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 21 (producción, runbook, uptime check, backups). Sin el sitio deployed no hay semana 1 que mirar.

También usa lo que dejaron 12 (`DEFAULT_MESSAGE_VARIANT` y las tres variantes del mensaje), 19 (`logAdminAction` y los eventos de auditoría, que son la fuente de dos KPI), y 20 (el criterio para decidir si un bug entra como test).

### 2.1 Qué es "la primera semana" y por qué no es una fecha

Siete días **completos** desde el primer día que el local recibió un pedido real, no siete días desde el deploy. La diferencia importa: si el deploy es un jueves, la semana de jueves a jueves incluye un fin de semana con el local cerrado y dos días con cero datos. Con cero datos no se decide el formato del mensaje, que es la decisión más importante de esta fase.

Siete días completos es también el número que `DESIGN.md` §16 exige para la línea base de mensajes informativos, y por eso es el mismo período y no dos distintos.

### 2.2 El hueco de instrumentación que hay que reconocer

`DESIGN.md` §16 define siete KPI. Tres de ellos se miden con datos que el proyecto **no captura hoy**:

| KPI | Instrumento | ¿Existe? |
|---|---|---|
| Pedidos iniciados en la web | "Contador de clics en el botón de WhatsApp (endpoint propio)" | **No existe.** No hay endpoint de eventos en ninguna tarea |
| Tasa de finalización del checkout | Pedidos iniciados vs. enviados | **No existe.** Depende del anterior |
| Tiempo medio de armado del pedido | Primeiro `view` de menú vs. clic de envío | **No existe.** Mismo endpoint |
| Rotación de `isAvailable` | `logAdminAction("producto.disponibilidad", …)` | Sí, en los logs de Vercel |
| Mensajes informativos diarios | Conteo manual en el chat | Sí, a mano |
| Uptime | Uptime check externo (Tarea 21) | Sí |
| Errores de Server Action | Logs de Vercel | Sí |

Es decir: **cuatro de los siete KPI se miden, y tres no tienen instrumento.** No es un olvido de esta tarea: es que hasta la Tarea 20 nadie había decidido si esas tres métricas valían el costo de medirlas.

La decisión que esta tarea toma está en §2.3, y es la primera que hay que tomar porque cambia lo que se hace durante los siete días.

### 2.3 No se instrumenta. Se cuenta a mano, y sólo si hace falta se agrega

`DESIGN.md` §16 es explícito: *"no se instala ningún tracker de terceros. La analítica usa un evento propio y sin cookies si en el futuro hace falta medir conversión, o directamente las métricas del hosting."*

La condición es **"si hace falta"**, y esta tarea la evalúa con un criterio concreto en vez de suponiendo:

| Pregunta | Respuesta honesta para un local de barrio |
|---|---|
| ¿El local ya sabe cuántos pedidos le entraron? | Sí. Los ve en WhatsApp, que es donde el pedido ocurre |
| ¿Los tres KPI sin instrumento sirven para decidir algo de la Fase 6? | No. El formato del mensaje se decide preguntando al local y leyendo el chat, no contando clics |
| ¿Qué costo tienen de medirlos de verdad? | Un endpoint público sin sesión, una fila por evento, y una retención que hay que decidir |

**Decisión: la primera semana se cuenta a mano y no se agrega instrumentación.** La fuente primaria de "pedidos iniciados" es el propio chat del local, que es exactamente la línea base que `DESIGN.md` §16 ya exige contar.

El endpoint propio queda como opción para la semana 2, y la condición para agregarlo está escrita en §6.3: si después de siete días la única pregunta abierta es "¿cuánta gente se va antes de completar el checkout?" y el chat no la puede responder, entonces sí.

### 2.4 Lo que esta semana NO es

| No es | Por qué |
|---|---|
| Agregar features | Si aparece una feature, va al backlog con su impacto y se mira después de la semana. Un cambio de código en la semana 1 confunde los datos con el efecto del cambio |
| Un sprint de refactor | Ídem, más caro: un refactor en la semana 1 puede romper algo y el bug se atribuye al deploy |
| Rediseñar el menú | El contenido es del local. Se ajusta lo que el local pida, y se anota |
| Tocar el modelo de datos | Una migración en la semana 1 es una migración de emergencia, y la Tarea 21 §9 dice que el rollback de esquema es un procedimiento de tres pasos. Se anota para después |
| Instalar una herramienta de analítica | `DESIGN.md` §16 lo descarta, y el costo en privacidad no se paga por un KPI que el chat ya responde |

### 2.5 Lo único que sí cambia de verdad: el formato del mensaje

Es la decisión que `DESIGN.md` §8.8 pide explícitamente y la que justifica la fase entera. El mecanismo ya está construido:

- `MessageVariant` es `"detailed" | "minimal" | "hybrid"`.
- `DEFAULT_MESSAGE_VARIANT` es `"hybrid"` y vive en `src/lib/whatsapp/message-contract.ts`.
- Las tres plantillas viven en `src/lib/whatsapp/message-variants.ts`.
- `MESSAGE_VARIANT_LABELS` las nombra para la pantalla de QA: "Detallada", "Mínima", "Híbrida con notas".

Cambiar el formato por defecto **es cambiar una línea y mergear**. No se toca `whatsapp-message.service.ts`, no se toca el truncado, no se tocan los tests de la Tarea 12. La Tarea 12 lo dice en su propia §12: *"Cambiar `DEFAULT_MESSAGE_VARIANT` cambia producción sin tocar lógica."*

Eso es lo que hace esta fase posible: el ajuste que hace falta después de ver pedidos reales **no requiere una feature**.

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `docs/seguimiento-lanzamiento.md` | La semana completa: registro diario, respuestas escritas, backlog con impacto, decisiones con su commit |
| `README.md` | Cómo opera el panel el encargado: agregar producto, marcar agotado, cambiar el teléfono |

### 3.2 Modificar

| Ruta | Cambio | Cuándo |
|---|---|---|
| `src/lib/whatsapp/message-contract.ts` | `DEFAULT_MESSAGE_VARIANT`, si la decisión de §6.3 es cambiarlo | Sólo si se cambia. Un commit de una línea |
| `docs/tasks/README.md` | Marcar Tarea 22 | Al cerrar |

### 3.3 Eliminar

Ninguno.

### 3.4 Por qué un solo archivo y no cuatro

Un registro por día, un backlog y una lista de decisiones viven en un solo documento **a propósito**: las tres cosas se leen en el mismo orden que ocurrieron. Un bug del jueves que se prioriza el viernes tiene que poder leerse junto con lo que el cliente reportó ese mismo día. Cuatro archivos con fechas distintas en el nombre obligan a reconstruir esa relación a mano, y es el trabajo que nadie hace.

El archivo crece, y está bien que crezca. Al séptimo día tiene un largo de dos pantallas, no de un manual.

---

## 4. Estructura N-Capas

Igual que en la Tarea 21, el reparto es por momento de uso y no por capa de la app.

| Artefacto | Ubicación | Cuándo se abre |
|---|---|---|
| El registro de la semana | `docs/seguimiento-lanzamiento.md` | Todos los días, durante siete días |
| El backlog con impacto | idem, misma tabla | Cuando llega un reporte, y el domingo al ordenar |
| Las decisiones con su commit | idem, misma tabla | Cuando se decide algo |
| El formato del mensaje | `src/lib/whatsapp/message-contract.ts` | Una vez, al séptimo día |
| Cómo opera el panel el local | `README.md` | Una vez, cuando el local lo pide |
| Los KPI | `DESIGN.md` §16, más la línea base del seguimiento | El domingo, una vez |

**Lo que no se crea:** un tablero de tickets, una carpeta de capturas, un canal de soporte. Un local de barrio no reporta un bug en un tablero, lo dice por WhatsApp, y el lugar donde queda anotado es este archivo.

---

## 5. Convenciones de código (Clean Code + SOLID)

### 5.1 Un registro diario tiene fecha, no "hoy"

El archivo se escribe una vez por día y **cada día tiene su propio encabezado**, con la fecha explícita:

```markdown
### Jueves 12 de marzo

- **Pedidos que entraron:** 6 (el local los cuenta en el chat)
- **Mensajes informativos:** 4 de 10 consultas — el más repetido: "¿a qué hora abren?"
- **Incidencias reportadas:** 1
- **Errores en Vercel:** 0
- **Uptime:** 100% en el día
- **Cambio de código hoy:** ninguno
```

Un registro sin fecha no sirve para comparar el domingo con el jueves. Y **"Cambio de código hoy: ninguno"** es una línea que se escribe todos los días: si aparece un cambio, el resto de los números de ese día hay que leerlos con esa información (ver §9.5).

### 5.2 Un bug se anota con el impacto, no con la urgencia

| Se escribe así | No así |
|---|---|
| `A-3 · Un cliente no pudo pedir un clásico grande porque la variante no aparece · **Impacto: alto** — bloquea el pedido entero · Re Reportó el local, jueves` | `Arreglar la variante del clásico` |
| `B-1 · La imagen de un combo tarda en cargar en 3G · **Impacto: bajo** — molesta, no bloquea · Visto por el local, viernes` | `Optimizar imágenes` |

La razón es concreta: al séptimo día hay que elegir entre ocho y diez cosas, y sin un impacto escrito la elección la hace quien esté más aburrido, que no es la misma persona que la que más entiende del problema. **Alto** es "un cliente no pudo pedir algo o el local no pudo cambiar algo". Todo lo demás es bajo o medio.

### 5.3 Una decisión se anota con su commit, o no se anota

| Se escribe así | No así |
|---|---|
| `Formato del mensaje → "minimal". Commit 4f2a1b8. Motivo: el local leyó tres mensajes "híbridos" completos y en dos no vio la dirección.` | `Se cambió el formato del mensaje` |

Una decisión sin commit es una intención. Con commit, el jueves que alguien pregunte "por qué el mensaje dice así" hay una línea que responde y un diff que muestra qué cambió.

### 5.4 Un reporte que no se puede reproducir entra al backlog con esa etiqueta

No todo lo que dice el local es un bug, y no todo bug se puede arreglar:

| Tipo | Qué se hace |
|---|---|
| Se reproduce en local | Es un bug. Va al backlog con impacto |
| No se reproduce y no hay datos | Va al backlog como **"no reproducible"**, y se queda esperando un segundo reporte antes de invertir tiempo |
| Es una preferencia ("lo quiero más lindo") | Va al backlog como **"pedido"**, con la fecha. No es un bug y no compite con uno |
| Es una feature | Va al backlog como **"fuera de alcance"**, y no se debate esta semana |

La categoría "no reproducible" existe por una razón práctica: en la semana 1 el número de reportes es chico y cada uno parece importante. Gastar el esfuerzo de la semana en un bug que nadie puede ver es la forma más fácil de no arreglar los que sí se ven.

---

## 6. Pasos de implementación

### 6.1 El día cero: la línea base empieza antes del deploy

`DESIGN.md` §16 pone una condición que es fácil de saltear: *"línea base obligatoria en Fase 0: contar durante 7 días completos cuántos mensajes diarios son puramente informativos (precio, disponibilidad, horarios) y cuántos son pedidos reales."*

Si la Fase 0 no se hizo, **no hay con qué comparar** y el KPI de "reducción ≥ 70% de mensajes informativos" queda sin línea base en la semana 1. Se cuenta a mano durante siete días antes del deploy, y el número va arriba de `docs/seguimiento-lanzamiento.md`.

Si ya se tiene, se copia el número. Si no se tiene y el deploy ya está hecho, se cuenta desde el deploy y **se anota que la línea base arranca tarde**, porque un número de línea base tomado con el sitio ya publicado mezcla el efecto del formato nuevo con el estado anterior.

### 6.2 La conversación del jueves: la que define la fase

Quince minutos, por el canal que ya usan. Cuatro preguntas, y se anotan las respuestas textuales, no un resumen:

1. **"¿Qué le preguntan más por WhatsApp?"** — la respuesta es la línea base de mensajes informativos, medida por el local y no por un guess.
2. **"Cuando llega un pedido, ¿lo entiende de un vistazo o tiene que leer dos veces?"** — la respuesta decide el formato del mensaje.
3. **"¿Hubo algún momento en que quisiste cambiar algo y no pudiste?"** — el origen de la mayoría de los bugs de la semana.
4. **"¿Qué es lo que más teinteropola de usar el panel?"** — la pregunta que produce el `README.md` de §6.5.

La última se hace el domingo, con una semana de uso encima. Las tres primeras, el jueves, que es el día con más pedidos.

### 6.3 El domingo: formato del mensaje, con la evidencia de los siete días

Es la única decisión de código de la fase, y se toma con tres fuentes:

| Fuente | Qué aporta | Cómo se lee |
|---|---|---|
| Los mensajes que mandó el local | Si el mensaje se leyó completo o se recortó | `message.isTruncated` y `message.omittedItemCount` están en la respuesta de `buildWhatsAppOrder`; el local las ve en la pantalla de QA |
| Lo que dice el local | Si la información importante se entiende | La pregunta 2 de §6.2 |
| Los mensajes informativos de la semana | Qué campo sobra | El conteo del registro diario |

**El árbol de decisión, escrito para no discutirlo a las once de la noche:**

| Lo que muestra la evidencia | Decisión | Qué se toca |
|---|---|---|
| El local leyó todo y no cambiaron nada | Dejar `hybrid` | Nada |
| El local leyó todo pero pregunta siempre por la dirección | Dejar `hybrid`. El problema es la información del negocio en ajustes, no el formato | `business_settings`, si hace falta |
| El local se queja de que el mensaje es largo | Cambiar a `minimal` | Una línea en `message-contract.ts` |
| El local dice que no encuentra la dirección o los horarios | Cambiar a `detailed` | Una línea |
| El mensaje se recorta siempre y pierde el total | **Esto es un bug, no un formato.** Va al backlog | `message-truncation.ts` |

```ts
// src/lib/whatsapp/message-contract.ts
// ⛔ El ajuste de la Fase 6 es ESTA línea y ninguna más.
//
// `hybrid` es el default desde la Tarea 12. Si la semana 1 decide
// `minimal` o `detailed`, se cambia acá, se mergea, y el mensaje de
// producción cambia en el siguiente deploy.
//
// Lo que NO se toca: `whatsapp-message.service.ts` (arma y valida),
// `message-variants.ts` (las tres plantillas, que no cambian) ni los
// tests de la Tarea 12. Cambiar el default no cambia el formato de
// ninguna plantilla: cambia cuál de las tres se usa.
export const DEFAULT_MESSAGE_VARIANT: MessageVariant = "hybrid";
```

> ⛔ **El commit del cambio de formato va solo.** Un commit que cambia el formato y arregla un bug mezcla dos cosas, y el lunes nadie sabe cuál de las dos mejoró el resultado. Primero el bug, después el formato, cada uno con su commit y su línea en la tabla de decisiones.

### 6.4 El backlog: tres filas por entrada y una decisión

Al séptimo día, todas las entradas se ordenan y **cada una recibe una decisión**:

| Columna | Qué es |
|---|---|
| **ID** | `A-1`, `A-2`… por día de llegada, para poder referring al reporte original |
| **Qué pasa** | Una frase, en palabras del local si vino de él |
| **Impacto** | Alto, medio o bajo, con el criterio de §5.2 |
| **Estado** | `arreglado`, `entra al backlog`, `no reproducible`, `pedido`, `fuera de alcance` |
| **Commit** | Si está arreglado, el hash |

Y después de la tabla, tres números que son el resultado de la fase:

- **Cuántos se arreglaron** y cuáles, con su commit.
- **Cuántos quedan abiertos** y por qué: falta de tiempo, no reproducible, o fuera de alcance.
- **Cuántos de los abiertos son bugs de verdad**: la métrica que dice si la semana valió.

> La última es la que importa. Una semana con diez entradas, cuatro arregladas y seis "no reproducible" no es mejor que una con dos entradas y dos arreglos: es peor, porque seis personas esperaron.

### 6.5 El `README.md`: cómo opera el panel el local

`DESIGN.md` §8.8 lo pide y es el entregable que sobrevive a esta tarea. Ocho líneas, con capturas si hay lugar, sin una sola palabra de jerga:

```markdown
# Mi Negocio

## Para el local

- **Agregar un producto:** Productos → Nuevo → nombre, precio, foto,Guardar.
- **Marcar que no hay:** en la lista, el interruptor de la primera columna.
  Aparece al instante en la web, sin recargar.
- **Cambiar el teléfono de WhatsApp:** Ajustes → el primer campo. Cambia
  en todos los pedidos siguientes.
- **Cambiar un precio:** Productos → editar → precio → Guardar.
- **Sacar un producto:** archivar. Deja de aparecer, no se borra.

## Para desarrollo

- [el bloque técnico que ya vive en el repositorio]
```

Cinco tareas, no diez. Las cinco que el local hizo durante la capacitación de §6.12 de la Tarea 21, porque esas son las que se le van a pedir. Una sección de ocho pasos donde cinco no se usan nunca es un documento que nadie vuelve a abrir.

### 6.6 El cierre: qué queda escrito y dónde

Al séptimo día, `docs/seguimiento-lanzamiento.md` tiene que poder responder, sin preguntarle a nadie, estas cinco preguntas:

| Pregunta | Dónde está |
|---|---|
| ¿Cuántos pedidos entraron? | El registro diario, y la línea base de §6.1 |
| ¿Qué formato de mensaje quedó? | La tabla de decisiones, con el commit |
| ¿Qué bugs se arreglaron y cuáles no? | El backlog de §6.4 |
| ¿Qué pidió el local que no se hizo? | La columna "pedido" y "fuera de alcance" |
| ¿El local puede operar solo? | La respuesta a la pregunta 4 de §6.2 y el `README.md` de §6.5 |

---

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `DEFAULT_MESSAGE_VARIANT: MessageVariant` | `src/lib/whatsapp/message-contract.ts` (Tarea 12 §6.2) | La decisión de §6.3. Cambiarlo cambia producción sin tocar lógica |
| `MESSAGE_VARIANT_LABELS` | idem | La pantalla de QA, para que el local diga "híbrida" y no "variante 2" |
| `producto.disponibilidad` (evento de auditoría) | `AdminAuditEvent` (Tarea 19 §6.4) | El KPI de rotación de `isAvailable`, filtrando los logs de Vercel |
| `isTruncated`, `omittedItemCount` | `WhatsAppOrderMessage` (Tarea 12 §6.2) | La evidencia de §6.3 sobre si el mensaje entra completo |
| Uptime ≥ 99.5% | Uptime check externo (Tarea 21 §6.8) | El KPI de disponibilidad, leído el domingo |

**Contratos que esta tarea consume y no toca:** todos. **Lo único que esta tarea cambia en el código es una constante de un archivo**, y sólo si la evidencia de §6.3 dice que hay que cambiarla. Esa es una restricción deliberada y es lo que hace que la semana 1 sea segura.

### 7.1 Lo que el log de auditoría puede y no puede decir

`logAdminAction` escribe con `console.info` en los logs de Vercel, y el evento `producto.disponibilidad` existe desde la Tarea 19. Con eso se puede responder la pregunta "¿qué producto se agota más?" filtrando los logs por evento y contando por `entityId`.

Dos límites, y conviene saberlos antes de prometer el número:

| Límite | Consecuencia |
|---|---|
| Los logs de Vercel tienen retención limitada | El KPI de rotación se puede mirar el domingo, no dentro de un mes. Si se quiere histórico, hay que exportarlo el domingo |
| Un toggle desde el panel y uno desde una corrección de stock se ven iguales | El log dice que cambió, no por qué. La distinción la hace el local, y por eso la pregunta 3 de §6.2 importa |

Por eso el KPI de rotación se registra **el domingo y con el dato congelado en el archivo**, no como algo que se consulta cuando alguien se acuerda.

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [ ] `docs/seguimiento-lanzamiento.md` tiene los siete días, cada uno con fecha y con las seis líneas de §5.1
- [ ] La línea base de mensajes informativos de §6.1 está escrita arriba del registro, con la fuente anotada
- [ ] Hay al menos una conversación escrita con el encargado, con las cuatro preguntas de §6.2 y las **respuestas textuales**, no un resumen
- [ ] Hay al menos un reporte de cliente anotado, con la fecha
- [ ] El formato del mensaje se decidió con la evidencia del árbol de §6.3, y la decisión tiene commit
- [ ] El backlog tiene una fila por entrada, con impacto y con estado
- [ ] `README.md` tiene la sección de cinco tareas para el local

### 8.2 Calidad

- [ ] La primera semana no tuvo commits de feature: sólo, como máximo, el commit del formato y los de bugs
- [ ] Cada commit de la semana tiene su línea en la tabla de decisiones, con el hash
- [ ] El commit del cambio de formato está solo, sin otro cambio adentro
- [ ] Ningún cambio de la semana tocó `prisma/schema.prisma` ni aplicó una migración
- [ ] Los tests de la Tarea 20 pasaron en cada commit de la semana
- [ ] `npm run verify` en verde en el commit del formato

### 8.3 Arquitectura — verificación obligatoria

- [ ] `src/lib/whatsapp/message-contract.ts` es el **único** archivo que cambió para el formato
- [ ] `whatsapp-message.service.ts`, `message-variants.ts` y `message-truncation.ts` no se tocaron
- [ ] Los tests de la Tarea 12 siguen pasando sin modificación
- [ ] Si se cambió el default, `MESSAGE_VARIANT_LABELS` sigue cubriendo las tres variantes
- [ ] No se agregó ningún endpoint de eventos, ningún tracker y ninguna cookie de analítica
- [ ] No se agregó ninguna dependencia al `package.json`
- [ ] Si hubo un bug de disponibilidad, su test está en la zona C o D de la Tarea 20 §2.1, no en otro lado

### 8.4 Pruebas

- [ ] El smoke test de la Tarea 21 §6.5 se repitió el domingo y pasó
- [ ] El uptime check externo de la Tarea 21 no tuvo ninguna caída, o la caída está anotada con su causa
- [ ] Los errores de Server Action de la semana están contados y la tendencia está escrita
- [ ] Al menos un bug de la semana tiene un test que falla con el código viejo
- [ ] Los tres KPI que sí tienen instrumento (rotación, uptime, errores) están leídos y anotados con su número
- [ ] Los tres KPI sin instrumento están marcados como **no medidos**, con el motivo de §2.3

### 8.5 Seguridad y documentación

- [ ] La CSP sigue en `Report-Only` salvo que la semana haya ajustado la decisión de §8.5 de la Tarea 21 con un commit propio
- [ ] El 2FA de los dos `OWNER` sigue activo y nadie reporta haber quedado afuera
- [ ] `docs/seguimiento-lanzamiento.md` no contiene datos personales de clientes: ni teléfono, ni nombre completo
- [ ] Los backups automáticos siguen corriendo y el último restaurado es de esta semana
- [ ] `docs/tasks/README.md` marca la Tarea 22
- [ ] Los tres números de §6.4 están escritos, y el de "bugs abiertos que son bugs de verdad" también

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado | Por qué |
|---|---|---|
| **No entran pedidos en toda la semana** | La semana cuenta igual: el registro diario dice cero, y el formato **no** se cambia | Sin pedidos no hay evidencia. Cambiar el formato a ciegas es la forma de cambiar algo que funcionaba |
| **Entran pedidos pero el local no responde nada** | Se registra la día igual. El seguimiento lo hace el que esté, y la falta de respuestas es un dato: el local no está usando el panel | Es el hallazgo más importante posible y llega en forma de silencio |
| **El local pide un cambio de precio de un producto** | Es contenido, no bug. Se lo hace en el panel, que es para eso, y no entra al backlog | El panel existe para esto. Que el local tenga que pedir un precio por otro canal es un bug de la capacitación, no del producto |
| **Un cliente reporta un bug en el chat del local** | El local no puede dérivarlo. Se le explica que reporte por el canal del proyecto, y se anota igual lo que dijo, con su fecha | El volumen es de uno por semana. El proceso tiene que ser más barato que el bug |
| **Aparece un bug que no se puede reproducir en local** | Va al backlog como "no reproducible" y **no se arregla** hasta el segundo reporte | Gastar la semana en un bug invisible es la forma más fácil de no arreglar los que sí se ven |
| **Un commit de la semana rompe producción** | Se vuelve atrás con el procedimiento de la Tarea 21 §6, se anota en el registro, y el resto del día se lee con esa información | Un deploy fallido en la semana 1 no es una catástrofe: es el smoke test de §8.4 haciendo su trabajo |
| **El local pide una feature nueva** | Anotada como "fuera de alcance" con la fecha, y se le contesta. No se implementa esta semana | La fase es de observación. Una feature agrega una variable al experimento que ya está corriendo |
| **Aparece una migración que hay que aplicar** | Se postponea. Si es urgente, se aplica siguiendo la Tarea 21 §6.4 y se anota como excepción, con el motivo | Una migración en la semana 1 es una migración de emergencia, y el rollback de esquema no es un comando |
| **Los logs de Vercel ya no muestran los toggles del lunes** | El KPI de rotación se cuenta con lo que hay y se anota la retención como límite | Es lo que pasó de verdad, y anotarlo vale más que un número que parece completo y no lo es |
| **El domingo nadie tiene tiempo de escribir el backlog** | Se escribe igual, aunque sea con cinco filas. El documento incompleto con siete días de datos es recuperable; el documento ausente no | El registro diario es lo caro y ya está. El backlog es orden, y ordenar tarde no pierde información |
| **El local sigue preguntando lo mismo después del domingo** | Eso no era un bug, era un `README.md` incompleto. Se agrega la línea y se anota | La mejor señal de que al `README.md` le falta algo es que alguien lo pregunte dos veces |

---

## 10. Pruebas

| Verificación | Qué prueba | Automático |
|---|---|---|
| `npm run verify` | Que el commit del formato no rompió nada | Sí, el pipeline |
| Los tests de la Tarea 12 sin modificar | Que cambiar el default no cambió el formato de las plantillas | Sí, el pipeline |
| El smoke test de la Tarea 21 | Que el sitio sigue sirviendo después del cambio | No, una vez |
| El log de `producto.disponibilidad` | Que la rotación de disponibilidad se puede leer | No, el domingo |
| El conteo manual del chat | Que la línea base de mensajes informativos es real | No, todos los días |
| El uptime check externo | Que la semana no tuvo caída | No, automático, se lee el domingo |
| La conversación con el local | Que el formato se decidió con lo que dijo el local y no con una suposición | No, con una persona |

**El criterio que decide si esta fase salió bien:** el domingo, alguien que no participó en la semana puede leer `docs/seguimiento-lanzamiento.md` y responder las cinco preguntas de §6.6 sin preguntarle nada. Si puede, la fase hizo su trabajo.

---

## 11. Definición de "Hecho" (Definition of Done)

- [ ] Todos los criterios de §8 marcados, cada uno verificado y no de memoria
- [ ] Los siete días registrados con fecha, con pedidos, mensajes informativos, incidencias, errores y uptime
- [ ] La línea base de §6.1 escrita, con su fuente
- [ ] Las cuatro preguntas de §6.2 hechas y las respuestas textuales en el archivo
- [ ] El formato del mensaje decidido, aplicado si hizo falta, y con su commit aislado
- [ ] El backlog completo, con impacto y con estado en cada fila, y los tres números de §6.4
- [ ] `README.md` con las cinco tareas del local
- [ ] El smoke test de la Tarea 21 repetido el domingo, en verde
- [ ] Los tres KPI con instrumento leídos y anotados; los tres sin instrumento marcados como no medidos
- [ ] `docs/tasks/README.md` actualizado
- [ ] Commit: `docs(22): cierre de la primera semana, formato del mensaje y backlog priorizado`

> **Sobre la línea de arriba:** es un commit de documentación y no debería haber código adentro. Si lo hay, es que algo de §2.4 se hizo durante la semana, y eso se anota en el registro antes de mergear, no después.

---

## 12. Dependencias y bloqueos

### 12.1 Depende de

| Tarea | Qué aporta | Qué pasa si falta |
|---|---|---|
| **21** | Producción, runbook, uptime check, backups, la grabación de la capacitación | No hay semana 1 que observar. Y el `README.md` de §6.5 repite la capacitación sin tener de dónde sacarla |
| **12** | `DEFAULT_MESSAGE_VARIANT`, las tres variantes y la pantalla de QA | El ajuste de formato, que es la razón de esta fase, no tiene dónde aplicarse |
| **19** | `logAdminAction` y el evento `producto.disponibilidad` | El KPI de rotación de disponibilidad no tiene fuente |
| **20** | El criterio de dónde va un test nuevo y el pipeline que lo corre | Un bug arreglado sin test vuelve en dos semanas |
| **00** | La línea base de mensajes informativos de la Fase 0, si se contó | El KPI de "reducción ≥ 70%" queda sin contra qué comparar |

### 12.2 Habilita a

Ninguna. **La Tarea 22 es la última del plan**, y su entregable es el que permite que el proyecto siga sin nadie de desarrollo encima: un `README.md` que el local entiende, un backlog con lo que queda, y un formato de mensaje que se decidió con pedidos de verdad.

### 12.3 Bloqueos de esta tarea

| Bloqueo | Por qué | Cómo se resuelve |
|---|---|---|
| Que el local responda las preguntas | El seguimiento depende de alguien que use el panel | Se hace en el canal que ya usan, y se limita a quince minutos. Si no hay respuestas, eso se anota como hallazgo |
| Que pasen siete días completos | Es el número de `DESIGN.md` §16 para la línea base | No se acorta. Una semana con cuatro días de datos no decide un formato de mensaje |
| La línea base de la Fase 0 | Sin ella, un KPI no se puede evaluar | Si no existe, se cuenta desde el deploy y se anota que arrancó tarde, en §6.1 |

### 12.4 Decisiones que esta tarea deja establecidas

1. **La primera semana se cuenta a mano y no se instrumenta.** `DESIGN.md` §16 lo dice con la condición de "si hace falta", y esta fase demuestra que no hacía falta: el chat del local ya sabe cuántos pedidos entraron.
2. **Los tres KPI sin instrumento quedan marcados como no medidos**, con el motivo. Un KPI que se reporta como cero cuando en realidad no se midió es peor que un KPI ausente.
3. **El formato del mensaje se cambia en una línea**, en `message-contract.ts`, y en un commit solo. Ninguna función del servicio se toca.
4. **Un bug que no se reproduce no se arregla** hasta el segundo reporte. La semana tiene ocho días de trabajo, no cuarenta.
5. **Un bug entra al backlog con impacto, no con urgencia.** Alguien tiene que elegir al domingo, y sin un número escrito elige el que conoce mejor al que tomó la decisión.
6. **La semana 1 no tiene features ni refactors.** Un cambio de código durante la observación confunde los datos con su propio efecto.
7. **Un registro diario sin fecha no sirve.** Y la línea "cambio de código hoy" se escribe todos los días, incluso cuando dice ninguno.
8. **El `README.md` del local tiene cinco tareas, no diez.** Son las cinco que hizo en la capacitación.
9. **El seguimiento es un archivo, no un tablero.** Un local de barrio reporta por WhatsApp, y el lugar donde queda anotado es un documento que se lee en orden.
10. **Al séptimo día el proyecto queda operable sin nadie de desarrollo encima.** Ese es el criterio de éxito de la fase, y no se mide en cantidad de bugs cerrados.
