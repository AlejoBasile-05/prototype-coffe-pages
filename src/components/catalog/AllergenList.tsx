/**
 * Lista de alérgenos (Server Component).
 *
 * Resuelve cada valor contra el glosario cerrado de la Tarea 00 y
 * muestra la etiqueta CANÓNICA ("maní", "sésamo"). Un valor fuera del
 * glosario se muestra tal cual y queda reportado en consola del
 * servidor: inventar una traducción de un alérgeno es un problema de
 * salud, no de contenido.
 *
 * Con lista vacía devuelve `null`: un contenedor vacío es un hueco
 * invisible en la grilla.
 */
import { toCanonicalAllergen } from "@/lib/domain";
import { joinClasses } from "@/lib/ui/classes";

interface AllergenListProps {
  allergens: readonly string[];
  className?: string;
}

export function AllergenList({ allergens, className }: AllergenListProps) {
  if (allergens.length === 0) return null;

  return (
    <ul
      aria-label="Alérgenos"
      className={joinClasses(
        "text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm",
        className,
      )}
    >
      {allergens.map((allergen) => {
        const canonical = toCanonicalAllergen(allergen);
        if (canonical === null) {
          console.warn(`[catalog] Alérgeno fuera del glosario: ${allergen}`);
        }

        return (
          <li key={allergen} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-60" />
            {canonical ?? allergen}
          </li>
        );
      })}
    </ul>
  );
}
