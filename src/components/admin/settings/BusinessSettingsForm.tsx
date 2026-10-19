/**
 * Formulario de ajustes del negocio (Tarea 17 §6.10).
 *
 * ⛔ Un `STAFF` que abre esta página ve el formulario en `readOnly`
 *    con el aviso arriba, y la action rechaza cualquier envío que le
 *    llegue (§6.9). El formulario deshabilitado es cortesía, la action
 *    es la frontera.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, useToast } from "@/components/ui";
import { t } from "@/config/prototype";
import type { SettingsFormModel } from "@/lib/domain";
import { updateBusinessSettingsAction } from "@/server/actions/ajustes";

import { OpeningHoursFieldset } from "./OpeningHoursFieldset";
import { WhatsAppPhoneField } from "./WhatsAppPhoneField";

interface BusinessSettingsFormProps {
  readonly modelo: SettingsFormModel;
  readonly puedeEditar: boolean;
}

const ERRORES_POR_CAMPO: Record<string, string> = {};

export function BusinessSettingsForm({ modelo, puedeEditar }: BusinessSettingsFormProps) {
  const router = useRouter();
  const { show } = useToast();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [pendiente, startTransition] = useTransition();
  const [dias, setDias] = useState(modelo.dias);

  const handleSubmit = (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setErrores(ERRORES_POR_CAMPO);
    setErrorGeneral(null);

    startTransition(async () => {
      const resultado = await updateBusinessSettingsAction({
        nombre: modelo.nombre,
        telefonoWhatsapp: modelo.telefonoWhatsapp,
        direccion: modelo.direccion,
        instagram: modelo.instagram,
        mensajeCierre: modelo.mensajeCierre,
        avisoLegal: modelo.avisoLegal,
        horarios: horariosDesdeDias(dias),
      });

      if (resultado.ok) {
        show("Los ajustes quedaron guardados.", "success");
        router.refresh();
        return;
      }

      setErrorGeneral(resultado.error);
      if (resultado.fieldErrors) {
        setErrores(
          Object.fromEntries(
            Object.entries(resultado.fieldErrors).map(([clave, mensajes]) => [
              clave,
              mensajes[0] ?? resultado.error ?? "",
            ]),
          ),
        );
        if (resultado.fieldErrors.whatsappPhone) {
          // El mensaje tiene que ir pegado al campo del teléfono, no
          // como error general.
          setErrorGeneral(resultado.fieldErrors.whatsappPhone[0] ?? resultado.error);
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {errorGeneral && (
        <p
          role="alert"
          className="rounded-control border-clay/35 bg-clay/10 text-clay-deep px-3 py-2 text-sm"
        >
          {errorGeneral}
        </p>
      )}

      <fieldset disabled={!puedeEditar} className="flex flex-col gap-4 disabled:opacity-60">
        <div>
          <label htmlFor="nombre" className="text-ink text-sm font-medium">
            {t("businessName")}
          </label>
          <input
            id="nombre"
            name="nombre"
            defaultValue={modelo.nombre}
            disabled={!puedeEditar}
            className="border-line-strong bg-paper rounded-control mt-1 w-full border px-3 py-2 text-sm"
          />
          {errores.nombre && <p className="text-clay mt-1 text-xs">{errores.nombre}</p>}
        </div>

        <WhatsAppPhoneField
          label={`${t("whatsapp")} de la tienda`}
          name="telefonoWhatsapp"
          defaultValue={modelo.telefonoWhatsapp}
        />

        <div>
          <label htmlFor="direccion" className="text-ink text-sm font-medium">
            {t("address")}
          </label>
          <textarea
            id="direccion"
            name="direccion"
            defaultValue={modelo.direccion}
            disabled={!puedeEditar}
            rows={2}
            className="border-line-strong bg-paper rounded-control mt-1 w-full border px-3 py-2 text-sm"
          />
          {errores.direccion && <p className="text-clay mt-1 text-xs">{errores.direccion}</p>}
        </div>

        <div>
          <label htmlFor="instagram" className="text-ink text-sm font-medium">
            {t("instagramUrl")}
          </label>
          <input
            id="instagram"
            name="instagram"
            defaultValue={modelo.instagram}
            disabled={!puedeEditar}
            className="border-line-strong bg-paper rounded-control mt-1 w-full border px-3 py-2 text-sm"
          />
          {errores.instagram && <p className="text-clay mt-1 text-xs">{errores.instagram}</p>}
        </div>

        <div>
          <label htmlFor="mensajeCierre" className="text-ink text-sm font-medium">
            {t("closingMessage")}
          </label>
          <textarea
            id="mensajeCierre"
            name="mensajeCierre"
            defaultValue={modelo.mensajeCierre}
            disabled={!puedeEditar}
            rows={2}
            className="border-line-strong bg-paper rounded-control mt-1 w-full border px-3 py-2 text-sm"
          />
          {errores.mensajeCierre && (
            <p className="text-clay mt-1 text-xs">{errores.mensajeCierre}</p>
          )}
        </div>

        <div>
          <label htmlFor="avisoLegal" className="text-ink text-sm font-medium">
            {t("legalNotice")} (del pie del sitio)
          </label>
          <textarea
            id="avisoLegal"
            name="avisoLegal"
            defaultValue={modelo.avisoLegal}
            disabled={!puedeEditar}
            rows={3}
            className="border-line-strong bg-paper rounded-control mt-1 w-full border px-3 py-2 text-sm"
          />
          {errores.avisoLegal && <p className="text-clay mt-1 text-xs">{errores.avisoLegal}</p>}
        </div>

        <OpeningHoursFieldset value={dias} onChange={setDias} />
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" disabled={pendiente || !puedeEditar}>
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

/** Hay que distinguir entre "informado" válido (horas en formato OK) y
 * ida del estado que el usuario cambio pero la base nunca escribió: la
 * forma que queda en el DTO le dice al menú qué mostrar (§5.7). */
function horariosDesdeDias(
  dias: readonly { key: unknown; estado: string; abre: string; cierra: string }[],
): Record<string, { estado: string; abre: string; cierra: string }> {
  // `sin_informar` se omite: el menú muestra el guion y el JSON-LD no
  // publica horario que el local no informó (ver §5.7 y §9).
  const salida: Record<string, { estado: string; abre: string; cierra: string }> = {};
  for (const dia of dias) {
    if (dia.estado !== "sin_informar") {
      salida[String(dia.key)] = { estado: dia.estado, abre: dia.abre, cierra: dia.cierra };
    }
  }
  return salida;
}
