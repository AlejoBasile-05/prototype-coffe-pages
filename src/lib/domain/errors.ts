/**
 * Errores de dominio.
 *
 * Son parte de la CAPA 0 y no dependen de nada externo: ni de Next,
 * ni de Prisma, ni de Supabase. Esto permite que los servicios lancen
 * errores tipados y que las capas superiores decidan cómo presentarlos.
 *
 * Convención: un error de dominio transporta un `code` ESTABLE para ser
 * comparado por código, y un `message` de contexto para logging.
 * El texto que ve el usuario final se define en la capa de presentación.
 */

export type DomainErrorCode =
  | "VALIDATION_ERROR"
  | "RESOURCE_NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "EXTERNAL_SERVICE_ERROR";

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  protected constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.details = Object.freeze({ ...details });
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends DomainError {
  override readonly code = "VALIDATION_ERROR" as const;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(fieldErrors: Record<string, readonly string[]>, message = "Datos inválidos") {
    super(message, { fieldErrors });
    this.fieldErrors = Object.freeze({ ...fieldErrors });
  }
}

export class ResourceNotFoundError extends DomainError {
  override readonly code = "RESOURCE_NOT_FOUND" as const;

  constructor(resource: string, identifier: string) {
    super(`${resource} no encontrado: ${identifier}`, { resource, identifier });
  }
}

export class UnauthorizedError extends DomainError {
  override readonly code = "UNAUTHORIZED" as const;

  constructor(message = "Se requiere autenticación") {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  override readonly code = "FORBIDDEN" as const;

  constructor(message = "No tenés permisos para realizar esta acción") {
    super(message);
  }
}

export class ConflictError extends DomainError {
  override readonly code = "CONFLICT" as const;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

/**
 * Falla de un proveedor externo (Cloudinary, Supabase, la API de WhatsApp).
 *
 * `details` registra únicamente el nombre del servicio y el TIPO de la causa.
 * No se guarda `String(cause)` a propósito: los errores de conexión de los
 * drivers incluyen credenciales y hosts internos, y `details` es lo que acaba
 * en los logs. El detalle técnico se conserva en la causa original del log
 * del servidor, nunca en el error de dominio.
 */
export class ExternalServiceError extends DomainError {
  override readonly code = "EXTERNAL_SERVICE_ERROR" as const;
  readonly service: string;

  constructor(service: string, cause: unknown) {
    super(`Fallo la integración con ${service}`, {
      service,
      causeName: cause instanceof Error ? cause.name : typeof cause,
    });
    this.service = service;
  }
}

/** Reduce un error desconocido a un mensaje presentable, sin filtrar detalles internos. */
export function toSafeErrorMessage(error: unknown): string {
  if (error instanceof DomainError) {
    switch (error.code) {
      case "VALIDATION_ERROR":
      case "RESOURCE_NOT_FOUND":
      case "CONFLICT":
        return error.message;
      default:
        return "Ocurrió un problema. Intentá de nuevo.";
    }
  }
  return "Ocurrió un problema inesperado. Intentá de nuevo.";
}
