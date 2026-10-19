/**
 * CENTINELA DE ARQUITECTURA — no es código de negocio.
 *
 * El paquete `server-only` hace que el build de Next.js FALLE si algún
 * archivo del bundle del navegador importa este módulo o cualquier módulo
 * que lo re-exporte. Es la garantía dura de que la capa de servidor
 * nunca viaja al cliente.
 *
 * No borrar este archivo. Es la red de seguridad de la arquitectura N-capas.
 */
import "server-only";

export const SERVER_BOUNDARY = Symbol.for("prototype.server-boundary");
