"use client";

import { useId } from "react";
import type { ReactNode } from "react";

import { joinClasses } from "@/lib/ui/classes";

/**
 * Cableado compartido de accesibilidad de formularios.
 *
 * `useId` es un hook, así que este archivo es Client Component aunque lo
 * que devuelve sea markup estático. Es el precio de no repetir el
 * cableado label / control / error en tres archivos distintos.
 */
export function useFieldIds(name: string) {
  const id = useId();
  return {
    id: `${name}-${id}`,
    errorId: `${name}-${id}-error`,
    hintId: `${name}-${id}-hint`,
  };
}

export const CONTROL =
  "w-full rounded-control border bg-paper px-3.5 text-base text-ink " +
  "placeholder:text-ink-muted/70 transition-colors duration-150 " +
  "disabled:bg-cream disabled:text-ink-muted disabled:cursor-not-allowed";

/** Borde por defecto vs. error. El color no alcanza: va también el mensaje. */
export const controlClass = (hasError: boolean, className?: string): string =>
  joinClasses(CONTROL, hasError ? "border-clay" : "border-line-strong", className);

export function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: ReactNode;
  // `| undefined` explícito: con exactOptionalPropertyTypes los controles
  // pasan `required` sin convertirlo a booleano primero.
  required?: boolean | undefined;
}) {
  return (
    <label htmlFor={htmlFor} className="text-ink mb-1.5 block text-sm font-medium">
      {children}
      {required && (
        <span aria-hidden="true" className="text-clay-deep ml-0.5">
          *
        </span>
      )}
    </label>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  // role="alert": el mensaje aparece DESPUÉS de que el usuario ya envió
  // el formulario. Sin el rol, un lector de pantalla no lo anuncia.
  return (
    <p id={id} role="alert" className="text-clay-deep mt-1.5 text-sm">
      {children}
    </p>
  );
}

export function FieldHint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-ink-muted mt-1.5 text-sm">
      {children}
    </p>
  );
}
