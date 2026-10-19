/**
 * Registro de las acciones de escritura del panel (Tarea 19 §6.4).
 *
 * ⛔ Los campos son un UNION de tipos, no `Record<string, unknown>`: con un
 *    union, agregar un campo nuevo es un cambio que se ve en el diff del
 *    tipo; con un objeto libre es un cambio invisible. Y el motivo de fondo
 *    es que un `console.info` con el objeto `FormData` de una action
 *    termina en el agregador de logs con el email de un cliente, un
 *    teléfono o una firma de Cloudinary adentro (§2.10, §5.3).
 *
 * ⛔ El contrato es una lista de campos que se pueden nombrar uno por uno.
 *    Nunca el payload: ni completo, ni parcial con valores.
 */
import "server-only";

/**
 * Los nueve eventos de escritura del panel. `tabla.verbo` en pasado:
 * ordenable y filtrable por tabla sin parsear texto.
 */
export type AdminAuditEvent =
  | "producto.creado"
  | "producto.actualizado"
  | "producto.archivado"
  | "producto.disponibilidad"
  | "categoria.creada"
  | "categoria.actualizada"
  | "categoria.eliminada"
  | "categoria.visibilidad"
  | "ajustes.actualizados"
  | "pedido.estado";

/**
 * Quién hizo el gesto. ⛔ Sale de la sesión ya verificada
 * (`verifyAdminSession`), nunca del payload: el log de una escritura tiene
 * que decir quién la hizo, y eso no lo declara el cliente.
 */
export interface AuditActor {
  readonly actorId: string;
  /**
   * ⛔ Declarado y NO impreso. El identificador alcanza para auditar, y el
   *    email es un dato personal que no necesita estar en el destino de logs
   *    de terceros. Está en la interfaz porque el panel va a querer mostrar
   *    "cambios de Ana" sin cambiar el contrato (§6.4).
   */
  readonly actorEmail: string;
  readonly actorRole: "OWNER" | "STAFF";
}

/** Campos que puede tener cualquier evento. */
interface AuditCommon {
  readonly entity: string;
  readonly entityId?: string;
}

/**
 * ⛔ Tres formas porque las actions escriben cosas distintas:
 *
 *   - Alta (`producto.creado`, `categoria.creada`): el nombre y el slug,
 *     que son públicos y sirven para encontrar la fila.
 *   - Edición (`producto.actualizado`, `categoria.actualizada`,
 *     `ajustes.actualizados`): los NOMBRES de los campos que cambiaron y
 *     NUNCA sus valores. Un precio y una `imageUrl` son datos del
 *     negocio, y saber qué campos se tocaron alcanza para reconstruir qué
 *     pasó sin exponer qué había antes (§7.1).
 *   - Estado (`producto.archivado`, `producto.disponibilidad`,
 *     `categoria.visibilidad`, `categoria.eliminada`): sólo la entidad.
 */
export type AuditFields =
  | AuditCommon
  | (AuditCommon & {
      readonly camposEditados?: readonly string[];
      readonly nombre?: string;
      readonly slug?: string;
    });

/**
 * Un `console.info` con UN argumento estructurado, después de la etiqueta.
 * La interpolación de strings obligaría a parsear texto en el agregador;
 * con un objeto, el filtro por `evento` y por `actorId` es un click.
 *
 * ⚠️ `actorEmail` no se escribe: ver `AuditActor`.
 */
export const logAdminAction = (
  evento: AdminAuditEvent,
  actor: AuditActor,
  fields: AuditFields,
): void => {
  console.info("[admin]", {
    evento,
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    ...fields,
  });
};