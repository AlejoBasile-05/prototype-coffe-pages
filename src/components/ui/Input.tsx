"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { controlClass, FieldError, FieldHint, FieldLabel, useFieldIds } from "./field";
import { joinClasses } from "@/lib/ui/classes";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  name: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  containerClassName?: string | undefined;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { name, label, error, hint, required, containerClassName, className, ...rest },
  ref,
) {
  const { id, errorId, hintId } = useFieldIds(name);

  return (
    <div className={containerClassName}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <input
        ref={ref}
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        // Solo se referencia el hint si existe: un aria-describedby que
        // apunta a un id inexistente se anuncia como vacío.
        aria-describedby={joinIds(error ? errorId : undefined, hint ? hintId : undefined)}
        className={controlClass(Boolean(error), joinClasses("min-h-11", className))}
        {...rest}
      />
      {hint && !error && <FieldHint id={hintId}>{hint}</FieldHint>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
});

const joinIds = (...ids: Array<string | undefined>): string | undefined => {
  const list = ids.filter(Boolean).join(" ");
  return list.length > 0 ? list : undefined;
};
