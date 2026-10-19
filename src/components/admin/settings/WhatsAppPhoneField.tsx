"use client";

/**
 * Input del teléfono con previsualización del número ya normalizado
 * (Tarea 17 §5.6).
 *
 * ⛔ `normalizeArgentinePhone` tira `ValidationError` mientras el
 *    usuario escribe, así que el preview se calcula con `try/catch` y
 *    el error se muestra **debajo** del campo. En `onChange` el número
 *    puede estar a medio hacer y la función lo va a rechajar: se avisa
 *    como texto, no como error de campo, porque un error de campo es
 *    rojo sosbreado y esto aún no es un error.
 */
import { useState } from "react";

import { ValidationError } from "@/lib/domain";
import { normalizeArgentinePhone } from "@/lib/validation/ajustes";

interface WhatsAppPhoneFieldProps {
  readonly label: string;
  readonly name: string;
  readonly defaultValue: string;
  readonly disabled?: boolean;
}

export function WhatsAppPhoneField({
  label,
  name,
  defaultValue,
  disabled = false,
}: WhatsAppPhoneFieldProps) {
  const [valor, setValor] = useState(defaultValue);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div>
      <label htmlFor={name} className="text-ink text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        value={valor}
        disabled={disabled}
        onChange={(e) => {
          const bruto = e.target.value;
          setValor(bruto);
          try {
            setPreview(normalizeArgentinePhone(bruto));
          } catch (error) {
            if (error instanceof ValidationError) {
              setPreview(null);
            } else {
              throw error;
            }
          }
        }}
        className="border-line-strong bg-paper rounded-control mt-1 w-full border px-3 py-2 text-sm"
      />
      <p className={`text-ink-muted mt-1 text-xs ${preview === null ? "text-clay" : ""}`}>
        {preview === null ? "No parece un WhatsApp válido." : `Se va a guardar como ${preview}.`}
      </p>
    </div>
  );
}
