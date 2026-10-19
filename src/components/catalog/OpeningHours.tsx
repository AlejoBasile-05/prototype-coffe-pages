/**
 * Grilla de horarios de atención (Server Component).
 *
 * Es una `<table>` y no divs: la relación día → horario es tabular y un
 * lector de pantalla la anuncia de forma nativa con `scope="row"`.
 *
 * El orden y las claves de los días las fija el DOMINIO (`WEEKDAY_KEYS`,
 * claves canónicas en inglés, las que guarda el jsonb) con los labels en
 * español de `WEEKDAY_LABELS`. No se usa una tabla local en español:
 * buscar `hours["lunes"]` cuando el dato vive en `hours["monday"]` deja
 * la grilla entera en "Cerrado" (bug que esta versión corrige).
 *
 * ⛔ No se calcula "Abierto ahora": el HTML sale de la caché ISR y un
 *    estado cacheado de ayer es peor que no mostrarlo (DESIGN.md §4.2).
 */
import { WEEKDAY_KEYS, WEEKDAY_LABELS } from "@/lib/domain";
import type { OpeningHours } from "@/lib/domain";

interface OpeningHoursProps {
  hours: OpeningHours;
}

export function OpeningHoursTable({ hours }: OpeningHoursProps) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Horarios de atención</caption>
      <tbody>
        {WEEKDAY_KEYS.map((dayKey) => {
          const range = hours[dayKey];

          return (
            <tr key={dayKey} className="border-line border-b last:border-0">
              <th scope="row" className="text-ink-muted py-1.5 text-left font-normal">
                {WEEKDAY_LABELS[dayKey]}
              </th>
              <td className="text-ink py-1.5 text-right font-medium">
                {/* Tres estados, no dos (misma regla que `normalizeOpeningHours`):
                    · `null` en el dato  → "Cerrado" (el local NO abre ese día).
                    · clave ausente      → "—" (sin informar: mentir "Cerrado"
                      espantaría clientes de un día que quizás sí abre). */}
                {range === null
                  ? "Cerrado"
                  : range === undefined
                    ? "—"
                    : `${range.opens} a ${range.closes} hs`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
