"use client";

import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

import { controlClass, FieldError, FieldHint, FieldLabel, useFieldIds } from "./field";
import { joinClasses } from "@/lib/ui/classes";

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  name: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  rows?: number;
  containerClassName?: string | undefined;
};

const joinIds = (...ids: Array<string | undefined>): string | undefined => {
  const joined = ids.filter(Boolean).join(" ");
  return joined === "" ? undefined : joined;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { name, label, error, hint, required, rows = 4, containerClassName, className, ...rest },
  ref,
) {
  const { id, errorId, hintId } = useFieldIds(name);

  return (
    <div className={containerClassName}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <textarea
        ref={ref}
        id={id}
        name={name}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={joinIds(error ? errorId : undefined, hint ? hintId : undefined)}
        // resize-y y no `resize: none`: prohibirlo rompería el contenido
        // largo sin escape, y el campo de una sola línea ya es el Input.
        className={controlClass(
          Boolean(error),
          joinClasses("resize-y py-2.5 leading-relaxed", className),
        )}
        {...rest}
      />
      {hint && !error && <FieldHint id={hintId}>{hint}</FieldHint>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
});
