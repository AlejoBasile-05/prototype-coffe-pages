/**
 * Aviso de cierre escrito por el encargado (Server Component).
 *
 * No calcula el estado del local: muestra el texto que vino en
 * `BusinessSettingsDTO.closingMessage`. Si el local reabre, el encargado
 * edita el mensaje desde el panel; no se resuelve con lógica de fechas.
 *
 * Sin mensaje devuelve `null`: un bloque vacío empujaría el menú hacia
 * abajo.
 */
interface ClosingMessageProps {
  message: string | null;
}

export function ClosingMessage({ message }: ClosingMessageProps) {
  if (message === null || message === "") return null;

  return (
    <aside role="note" className="bg-cream text-ink rounded-card border-line border p-4 text-sm">
      <p className="font-medium">{message}</p>
    </aside>
  );
}
