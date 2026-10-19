"use client";

import type { ReactNode } from "react";

import { Button } from "./Button";

/**
 * Estados vacíos y de error.
 *
 * Un estado vacío NO es un error: es una respuesta válida. La distinción
 * importa: un mensaje de error chico asusta al usuario cuando lo que pasó
 * es que el local todavía no cargó el menú.
 */
export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-card border-line-strong bg-paper flex flex-col items-center gap-3 border border-dashed px-6 py-12 text-center">
      {icon && <div className="text-ink-muted">{icon}</div>}
      <h3 className="font-display text-ink text-lg">{title}</h3>
      <p className="text-ink-muted max-w-sm text-sm">{message}</p>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title = "No pudimos cargar esto",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-card border-clay/35 bg-clay/8 flex flex-col items-center gap-3 border px-6 py-10 text-center"
    >
      <h3 className="font-display text-ink text-lg">{title}</h3>
      <p className="text-ink-muted max-w-sm text-sm">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          Reintentar
        </Button>
      )}
    </div>
  );
}

/**
 * Decide entre carga, error, vacío y contenido.
 *
 * Es el componente que evita que cada página reescriba su propio
 * `if (loading) return <Skeleton />` con una variante distinta. No sabe
 * nada del dominio: solo decide cuál de los cuatro estados mostrar.
 */
export function AsyncBoundary({
  isLoading,
  error,
  isEmpty,
  empty,
  onRetry,
  skeleton,
  children,
}: {
  isLoading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  empty?: ReactNode;
  onRetry?: () => void;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Cargando…</span>
        {skeleton}
      </div>
    );
  }

  if (error) return <ErrorState message={error} {...(onRetry ? { onRetry } : {})} />;
  if (isEmpty) return <>{empty}</>;

  return <>{children}</>;
}
