"use client";

/**
 * Nombre y teléfono. El teléfono se muestra normalizado mientras se
 * escribe (mitigación del riesgo R2): el `9` móvil es invisible para
 * quien no lo conoce, y ver `+54 9 261 555-1234` debajo del campo hace
 * que el error aparezca antes de confirmar.
 */
import { Input } from "@/components/ui";
import { t } from "@/config/prototype";
import { formatArgentinePhoneForDisplay, normalizeArgentinePhone } from "@/lib/format/phone";

interface CustomerFieldsProps {
  readonly fullName: string;
  readonly phone: string;
  readonly onFullNameChange: (value: string) => void;
  readonly onPhoneChange: (value: string) => void;
  readonly errors: Readonly<Record<string, readonly string[]>>;
}

export function CustomerFields(props: CustomerFieldsProps) {
  const { fullName, phone, onFullNameChange, onPhoneChange, errors } = props;

  const preview = ((): string | null => {
    if (phone.trim().length < 8) return null;
    try {
      return formatArgentinePhoneForDisplay(normalizeArgentinePhone(phone));
    } catch {
      // Todavía no es un teléfono válido: sin preview. El error formal
      // aparece al enviar, no mientras el cliente está escribiendo.
      return null;
    }
  })();

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="font-display text-ink text-lg">Tus datos</legend>

      <Input
        name="fullName"
        label="Nombre y apellido"
        value={fullName}
        onChange={(event) => onFullNameChange(event.target.value)}
        error={errors.fullName?.[0]}
        autoComplete="name"
        required
        maxLength={80}
        enterKeyHint="next"
      />

      <Input
        name="phone"
        label={t("whatsappPlaceholder")}
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(event) => onPhoneChange(event.target.value)}
        error={errors.phone?.[0]}
        hint={
          preview === null
            ? "Con o sin el 9. Lo normalizamos nosotros."
            : `Va a figurar como ${preview}`
        }
        autoComplete="tel"
        required
        maxLength={32}
        enterKeyHint="next"
      />
    </fieldset>
  );
}
