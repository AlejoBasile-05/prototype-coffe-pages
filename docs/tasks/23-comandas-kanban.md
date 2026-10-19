# Tarea 23 — Tablero de comandas (Kanban de cocina)

> Retrofit autorizado por DESIGN.md §3.3: la tabla `Order` pasa a existir
> con un consumidor real (el tablero). La decisión quedó revertida con
> fecha 2026-10-07; el chat de WhatsApp sigue siendo la confirmación
> humana del pedido.

## Objetivo

Que la cocina vea entrar los pedidos de la web sin tocar F5 y los haga
avanzar por tres estados: **Pendientes → En preparación → Listos**, más
**Cancelado** (terminal, sin columna).

## Decisiones

1. **Registro en el submit del checkout**, no en el clic del `wa.me` de
   la pantalla de éxito: es el único momento donde el pedido está
   validado y el usuario todavía no se fue. La action se ejecuta antes
   de navegar; su resultado nunca bloquea el handoff.
2. **`orderNumber` autoincremental** separado del `id` (cuid): el
   encargado lo dice por teléfono (#0045); el cuid no se puede deletrear.
3. **Snapshot en `order_items`**, sin FK a `products`: un cambio de
   precio no reescribe comandas cerradas. `productId` queda como
   referencia débil nullable para analítica futura.
4. **Botones de transición explícitos, no drag & drop**: el contexto es
   una tablet/celu en cocina; un arrastre fallido en táctil mueve la
   comanda al estado equivocado. Mínimo 48px de alto por botón.
5. **Confirmación solo en los cierres** (`READY`, `CANCELLED`): son las
   irreversibles del turno. `PREPARING` entra directo.
6. **Realtime como señal, no como datos**: el evento de
   `postgres_changes` sobre `orders` no trae `order_items`, así que el
   hook lo usa para disparar un `router.refresh()` con anti-rebote de
   400 ms. El Server Component vuelve a traer el tablero completo, que es
   la única fuente de verdad. Fallback: polling de 10 s si Realtime no
   está configurado o el canal falla (indicado en pantalla).

## Seguridad

- `registerOrderAction` es **la única escritura pública** del sistema.
  Defensas en orden: honeypot invisible (`company`, con respuesta-cebo
  `ok: true` para no confirmarle al bot que fue detectado) → rate limit
  por IP (5 comandas / 10 min, ver limitación serverless en
  `src/server/infra/rate-limit.ts`) → Zod con el MISMO schema del
  checkout → revalidación contra catálogo y **cotización server-side**
  (el cliente nunca manda un precio, CWE-840).
- La transición exige `verifyAdminSession()` y la máquina de estados de
  `@/lib/domain/order` se aplica dos veces: en el servicio y como
  chequeo atómico de origen en el `UPDATE` (dos encargados no se pisan).
- RLS: `orders` y `order_items` habilitadas; `authenticated` con rol de
  staff lee vía `public.es_usuario_del_staff()`; `anon` sin privilegios.
  Sin `FORCE RLS` (igual que el resto: el service role conserva bypass).
- Auditoría: `pedido.estado` en el log de acciones de admin.

## Archivos

| Pieza | Archivo |
|---|---|
| Modelo | `prisma/schema.prisma` (`Order`, `OrderItem`, `OrderStatus`) |
| Migración | `prisma/migrations/20261007200407_comandas_pedidos/` |
| Dominio (máquina de estados) | `src/lib/domain/order.ts` |
| Schema público | `src/lib/validation/pedido.schema.ts` |
| Rate limit | `src/server/infra/rate-limit.ts` |
| Repositorio + mapper | `src/server/repositories/order.repository.ts` |
| Servicios | `src/server/services/order.service.ts`, `order-admin.service.ts` |
| Actions | `src/server/actions/pedidos.ts` (pública), `comandas.ts` (admin) |
| Handoff | `CheckoutForm.tsx` (registro + honeypot), `handoff-snapshot.ts`, `CheckoutSuccess.tsx` |
| Tablero | `src/app/admin/comandas/`, `src/components/admin/orders/` |
| Realtime | `src/hooks/use-orders-realtime.ts` |
| Tests | `tests/unit/order-status.test.ts`, `pedido.schema.test.ts`, `register-checkout-order.test.ts`, `tests/integration/order.repository.test.ts`, `OrderCard.component.test.tsx` |
