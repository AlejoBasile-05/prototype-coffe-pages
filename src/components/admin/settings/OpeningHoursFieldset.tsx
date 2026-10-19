"use client";

/**
 * Grilla de siete días del formulario de ajustes (Tarea 17 §5.7).
 *
 * ⛔ Una fila, tres estados. El `select` con "Sin informar / Informado
 *    / Cerrado" es la opción correcta: un switch no tiene forma de
 *    decir "no sé" sin mentir, y dos switches productdrían una
 *    combinación imposible que la UI tiene que impedir por diseño.
 *
 *    Un día "Cerrado" con horas cueba menos que una tabla vacía:
 *    `toOpeningHours` omite la clave si el select queda sin informar.
 */
import { t } from "@/config/prototype";
import { WEEKDAY_KEYS, WEEKDAY_LABELS } from "@/lib/domain";
import type { DayScheduleRow, DayScheduleState } from "@/lib/domain";

interface OpeningHoursFieldsetProps {
  readonly value: readonly DayScheduleRow[];
  readonly onChange: (value: readonly DayScheduleRow[]) => void;
}

/** Cierra con el `EstadoHealthBar` visual si el campo no es válido. */
const TEMP_DESECONSPECIFICO: Record<DayScheduleState, string> = {
  sin_informar: "Sin informar",
  informado: "Informado",
  cerrado: "Cerrado",
};

export function OpeningHoursFieldset({ value, onChange }: OpeningHoursFieldsetProps) {
  return (
    <fieldset className="rounded-card border-line space-y-3 border p-4">
      <legend className="text-ink px-2 text-sm font-medium">{t("openingHours")}</legend>

      {WEEKDAY_KEYS.map((key, ix) => {
        const fila = value[ix];
        if (fila === undefined) return null;
        const estadoActual = fila.estado;

        return (
          <div key={key} className="border-line flex flex-col gap-2 border-b pb-3 last:border-0">
            <div className="flex items-center justify-between">
              <span className="text-ink text-sm font-medium">{WEEKDAY_LABELS[key]}</span>
              <span
                className={`text-xs ${estadoActual === "cerrado" ? "text-clay" : estadoActual === "informado" ? "text-ink-muted" : "text-ink-muted"}`}
              >
                {TEMP_DESECONSPECIFICO[estadoActual]}
              </span>
            </div>

            {estadoActual !== "sin_informar" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-ink-muted">Abre</span>
                  <input
                    type="time"
                    value={fila.abre}
                    onChange={(e) => onChange(conCambios(ix, { abre: e.target.value }, value))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-ink-muted">Cierra</span>
                  <input
                    type="time"
                    value={fila.cierra}
                    onChange={(e) => onChange(conCambios(ix, { cierra: e.target.value }, value))}
                  />
                </label>
              </div>
            )}

            <select
              aria-label={`Estado del día ${WEEKDAY_LABELS[key]}`}
              value={estadoActual}
              onChange={(e) =>
                onChange(conCambios(ix, { estado: e.target.value as DayScheduleState }, value))
              }
              className="border-line-strong bg-paper rounded-control flex-1 border px-3 py-2 text-sm"
            >
              <option value="sin_informar">Sin informar</option>
              <option value="informado">Informado</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>
        );
      })}
    </fieldset>
  );
}

/** Reemplaza la fila en la posición y devuelve una lista nueva. */
const conCambios = (
  indice: number,
  cambio: Partial<Pick<DayScheduleRow, "estado" | "abre" | "cierra">>,
  filas: readonly DayScheduleRow[],
): readonly DayScheduleRow[] =>
  filas.map((fila, i) => (i === indice ? { ...fila, ...cambio } : fila));
