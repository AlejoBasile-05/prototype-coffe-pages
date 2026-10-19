"use client";

import { Textarea } from "@/components/ui";
import { MAX_NOTES_LENGTH } from "@/lib/validation/checkout.schema";

export function NotesField({
  value,
  onChange,
  error,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string | undefined;
}) {
  return (
    <Textarea
      name="notes"
      label="Comentarios (opcional)"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      hint={`Instrucciones especiales o lo que necesites. ${value.length}/${MAX_NOTES_LENGTH}`}
      rows={3}
      maxLength={MAX_NOTES_LENGTH}
    />
  );
}
