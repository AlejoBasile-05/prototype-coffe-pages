/**
 * JSON-LD del proyecto (Tarea 18 §6.8).
 *
 * ⛔ El único `dangerouslySetInnerHTML` de todo el proyecto. El escape
 *    caracter vive en `serializeJsonLd` de `@/lib/domain/schema-org.ts`
 *    (§2.7); acá solo se escribe el tag <script>.
 *
 * "Componente" a propósito: abrir el string por renglón era la única
 * forma de esconder la inyección. Cerrando el tag con serialize primero
 * y ponerlo después es lo mismo, porque ya es JSON serializado.
 */
import { serializeJsonLd } from "@/lib/domain/schema-org";

export interface JsonLdProps {
  readonly data: object;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // ⛔ El escape ocurre en `serializeJsonLd`, no acá. El componente
      //    no sabe qué es un `</script>` ni qué caracteres cierran el
      //    bloque.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
