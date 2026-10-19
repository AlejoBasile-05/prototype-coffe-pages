"use client";

/**
 * Envío o retiro, con radios nativos dentro de un `radiogroup`.
 *
 * ⛔ No es un `<select>`: son dos opciones excluyentes que se eligen una
 * vez y definen si la dirección es obligatoria. Dos botones grandes son
 * más rápidos de tocar en un teléfono y no dependen del `<select>`
 * nativo, que se ve distinto en cada sistema.
 */
import { useId } from "react";

import { t } from "@/config/prototype";
import { joinClasses } from "@/lib/ui/classes";

export function FulfillmentPicker({
  value,
  onChange,
}: {
  readonly value: "delivery" | "pickup";
  readonly onChange: (value: "delivery" | "pickup") => void;
}) {
  const groupId = useId();

  const options = [
    { value: "delivery" as const, title: t("delivery"), hint: "Te lo llevamos a tu dirección" },
    { value: "pickup" as const, title: t("pickup"), hint: "Pasás a buscarlo por el local" },
  ];

  return (
    <fieldset className="flex flex-col gap-2">
      <legend id={groupId} className="text-ink mb-1.5 text-sm font-medium">
        ¿Cómo lo querés recibir?
      </legend>
      <div role="radiogroup" aria-labelledby={groupId} className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <label
              key={option.value}
              className={joinClasses(
                "rounded-control flex min-h-11 cursor-pointer flex-col justify-center border px-4 py-3 transition-colors",
                isSelected
                  ? "border-crust-deep bg-crust/8 text-ink"
                  : "border-line-strong bg-paper text-ink hover:bg-cream",
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="fulfillment"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onChange(option.value)}
                  className="accent-crust-deep size-4"
                />
                <span className="font-medium">{option.title}</span>
              </span>
              <span className="text-ink-muted mt-0.5 pl-6 text-xs">{option.hint}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
