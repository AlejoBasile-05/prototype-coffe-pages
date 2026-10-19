"use client";

/**
 * Solo existe si el cliente eligió envío. Montarlo y desmontarlo según la
 * modalidad mantiene correctos el `autocomplete` y el `aria`: no hay un
 * input escondido que un lector de pantalla anuncie como un campo más.
 */
import { Textarea } from "@/components/ui";
import { MAX_ADDRESS_LENGTH, MIN_ADDRESS_LENGTH } from "@/lib/validation/checkout.schema";

export function AddressField({
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
      name="address"
      label="Dirección de entrega"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      hint={`Entre ${MIN_ADDRESS_LENGTH} y ${MAX_ADDRESS_LENGTH} caracteres. Incluí los datos necesarios para ubicar la entrega. ${value.length}/${MAX_ADDRESS_LENGTH}`}
      autoComplete="street-address"
      required
      rows={3}
      maxLength={MAX_ADDRESS_LENGTH}
    />
  );
}
