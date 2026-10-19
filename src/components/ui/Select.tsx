"use client";

import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";

import { controlClass, FieldError, FieldLabel, useFieldIds } from "./field";
import { joinClasses } from "@/lib/ui/classes";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> & {
  name: string;
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string;
  containerClassName?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { name, label, options, placeholder, error, required, containerClassName, className, ...rest },
  ref,
) {
  const { id, errorId } = useFieldIds(name);

  return (
    <div className={containerClassName}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          name={name}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={controlClass(
            Boolean(error),
            joinClasses("min-h-11 appearance-none pr-10", className),
          )}
          {...rest}
        >
          {/* El placeholder es la opción vacía deshabilitada, no un texto
              flotante: si no se elige nada, `required` lo bloquea y el
              valor enviado es "" en lugar de una string mentirosa. */}
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {/* Chevron propio: el del navegador no se puede estilizar. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="text-ink-muted pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        >
          <path
            d="M6 8l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
});
