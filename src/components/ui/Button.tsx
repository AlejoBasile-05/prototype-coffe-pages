import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { joinClasses } from "@/lib/ui/classes";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control font-medium " +
  "transition-colors duration-150 select-none whitespace-nowrap " +
  "disabled:pointer-events-none disabled:opacity-55";

// Variantes por objeto, no por condicionales encadenados: con
// Record<ButtonVariant, string> el compilador obliga a definir las
// cuatro. Con un condicional, olvidar `danger` es un error de runtime
// que solo aparece en la acción destructiva de un formulario.
const VARIANTS: Record<ButtonVariant, string> = {
  // crust-deep y no crust: el texto sobre crust tiene 4.2:1, no llega a
  // 4.5:1 (WCAG 1.4.3 para texto normal). crust-deep da 7.1:1.
  primary: "bg-crust-deep text-paper hover:bg-clay-deep active:bg-clay-deep",
  secondary: "border border-line-strong bg-paper text-ink hover:border-crust-deep hover:bg-cream",
  ghost: "bg-transparent text-ink hover:bg-ink/5",
  danger: "bg-clay text-paper hover:bg-clay-deep",
};

const SIZES: Record<ButtonSize, string> = {
  // min-h-11 = 44 px: objetivo táctil mínimo (WCAG 2.5.8).
  sm: "min-h-11 px-3 text-sm",
  md: "min-h-11 px-5 text-base",
  lg: "min-h-12 px-6 text-lg",
};

/**
 * Exportada como dato: permite que un `<a>` con href use los mismos
 * estilos que un `<Button>`. No hay prop `asChild` ni `cloneElement`: un
 * botón y un enlace no son intercambiables (navegación, Cmd+click, menú
 * contextual, lectores de pantalla los tratan distinto).
 */
export const buttonClassName = (
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
): string => joinClasses(BASE, VARIANTS[variant], SIZES[size]);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingLabel?: string;
};

/**
 * Sin `"use client"`: un `forwardRef` no necesita la directiva y este
 * componente llega al navegador sin JavaScript extra. Los modales y los
 * menús del Sheet sí necesitan la referencia real para poner el foco.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    isLoading = false,
    loadingLabel,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={joinClasses(buttonClassName(variant, size), className)}
      {...rest}
    >
      {isLoading && <Spinner aria-hidden="true" className="size-4 shrink-0" />}
      {/* truncate: con el spinner, el botón no puede encogerse ni dejar
          el texto en dos líneas a mitad del guardado. */}
      <span className={isLoading ? "truncate" : undefined}>
        {isLoading ? (loadingLabel ?? children) : children}
      </span>
    </button>
  );
});

function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={joinClasses(
        "size-4 rounded-full border-2 border-current border-r-transparent",
        // motion-safe: con prefers-reduced-motion la regla global mata la
        // animación, pero el borde se mantiene visible, así que sigue
        // comunicando "está trabajando".
        "motion-safe:animate-spin",
        className,
      )}
    />
  );
}
