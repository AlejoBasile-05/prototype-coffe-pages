"use client";

/**
 * Checkboxes del glosario cerrado de alérgenos (Tarea 16 §5.3, §7.1).
 *
 * ⛔ No es un campo de texto. Un alérgeno desconocido no se puede
 *    escribir: entraría un riesgo para alguien con una alergia real
 *    cuando se muestre el menú.
 *
 * ⚠️ La etiqueta `?? alergeno` conserva una entrada nueva que el
 *    glosario agregó sin duplicar el `EQUIVALENTE` map: un alérgeno
 *    nuevo se ve, aunque no sea la palabra final. Un checkbox invisible
 *    sería peor que uno feo (ver §7.1).
 */
import { ALERGENOS } from "@/lib/domain/allergens";

const ETIQUETAS: Record<string, string> = {
  gluten: "Gluten",
  lactosa: "Lácteos",
  huevo: "Huevo",
  maní: "Maní",
  "frutos secos": "Frutos secos",
  sésamo: "Sésamo",
  soja: "Soja",
  pescado: "Pescado",
};

interface AllergenFieldsetProps {
  value: readonly string[];
  onChange: (value: string[]) => void;
}

export const AllergenFieldset = ({ value, onChange }: AllergenFieldsetProps) => (
  <fieldset className="flex flex-col gap-2">
    <legend className="text-ink text-sm font-medium">Alérgenos</legend>
    {ALERGENOS.map((alergeno) => (
      <label
        key={alergeno}
        className="border-line bg-paper text-ink has-checked:border-crust-deep has-checked:bg-crust/10 rounded-control flex min-h-11 cursor-pointer items-center gap-2 border px-3 py-2 text-sm"
      >
        <input
          type="checkbox"
          checked={value.includes(alergeno)}
          onChange={(evento) =>
            onChange(
              evento.target.checked
                ? [...value, alergeno]
                : value.filter((item) => item !== alergeno),
            )
          }
        />
        {ETIQUETAS[alergeno] ?? alergeno}
      </label>
    ))}
    <p className="text-ink-muted text-xs">
      Solo se muestran los alérgenos del glosario. Uno nuevo entra por el código, no desde acá (ver
      §5.3).
    </p>
  </fieldset>
);
