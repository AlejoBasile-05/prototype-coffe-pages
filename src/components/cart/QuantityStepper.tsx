"use client";

/**
 * Control de cantidad: menos, número editable, más.
 *
 * · `draft` y `value` son dos estados distintos: `value` es la verdad
 *   del store y `draft` es lo que el usuario está escribiendo. Si el
 *   input leyera `value` directo, escribir "1" sobre "15" dispararía
 *   `onChange(1)` y se comería el resto.
 *
 * · `onChange` recibe el valor ya recortado: el botón de menos se
 *   deshabilita en 1 y el texto editado a mano con "0" o "-3" se
 *   ajusta a 1. La única forma de sacar una línea es el "Quitar" de
 *   la fila.
 *
 * · El contenedor es `role="group"` con `aria-label`: el lector de
 *   pantalla anuncia "grupo, Cantidad de Café" y los tres controles
 *   quedan dentro del contexto, no flotando sueltos. El campo central
 *   es texto, no `input[type=number]`: los spinners nativos se
 *   comportan distinto en cada sistema y no se pueden estilizar.
 */
import { useState } from "react";

import { MAX_QUANTITY_PER_ITEM } from "@/lib/cart/cart-types";
import { tapFeedback } from "@/lib/haptics";
import { joinClasses } from "@/lib/ui/classes";

interface QuantityStepperProps {
  value: number;
  onChange: (quantity: number) => void;
  label: string;
  size?: "sm" | "md";
}

const BUTTON =
  "flex size-8 items-center justify-center rounded-control text-lg leading-none text-ink hover:bg-ink/5 disabled:pointer-events-none disabled:opacity-40";
const FIELD = "w-10 bg-transparent text-center text-sm tabular-nums outline-none";

export function QuantityStepper({ value, onChange, label, size = "md" }: QuantityStepperProps) {
  const [draft, setDraft] = useState(String(value));
  // Sincronización "adjusting state during render": cuando el store
  // confirma un `value` distinto del último visto, el draft se resetea.
  // Con `useEffect` disparábamos un render extra y eslint lo marca.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  const commit = (next: number) => {
    tapFeedback();
    const clamped = Math.min(Math.max(next, 1), MAX_QUANTITY_PER_ITEM);
    setDraft(String(clamped));
    onChange(clamped);
  };

  const handleCommitDraft = () => {
    const parsed = Number.parseInt(draft, 10);

    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }

    commit(parsed);
  };

  const dimension = size === "sm" ? "size-7" : "size-8";

  return (
    <div
      role="group"
      aria-label={`Cantidad de ${label}`}
      className="rounded-control border-line inline-flex items-center gap-1 border"
    >
      <button
        type="button"
        onClick={() => commit(value - 1)}
        disabled={value <= 1}
        aria-label={`Quitar una unidad de ${label}`}
        className={joinClasses(BUTTON, dimension)}
      >
        −
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={handleCommitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            handleCommitDraft();
          }
        }}
        aria-label={`Cantidad de ${label}`}
        className={FIELD}
      />

      <button
        type="button"
        onClick={() => commit(value + 1)}
        disabled={value >= MAX_QUANTITY_PER_ITEM}
        aria-label={`Agregar una unidad de ${label}`}
        className={joinClasses(BUTTON, dimension)}
      >
        +
      </button>
    </div>
  );
}
