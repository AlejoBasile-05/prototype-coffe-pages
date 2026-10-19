"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updatePasswordAction } from "@/server/auth/actions";

const BotonGuardar = () => {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar contraseña"}
    </button>
  );
};

/**
 * Formulario del cambio de contraseña post-recovery.
 *
 * Misma estética del login (paleta neutra, tarjeta centrada): es una
 * pantalla hermana, no un lugar para inventar un idioma visual nuevo.
 * La validación fuerte (longitud, coincidencia) la hace la Server Action
 * con Zod; acá van solo las ayudas nativas del navegador.
 */
export function NuevaContrasenaForm() {
  const [estado, enviar] = useActionState(updatePasswordAction, null);

  const primerError = (campo: string): string | null =>
    estado !== null && !estado.ok ? (estado.fieldErrors?.[campo]?.[0] ?? null) : null;

  return (
    <form action={enviar} className="mt-6 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-neutral-900">
        Contraseña nueva
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-describedby="password-ayuda"
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
        <span id="password-ayuda" className="text-xs text-neutral-500">
          {primerError("password") ?? "Al menos 8 caracteres."}
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-900">
        Repetí la contraseña
        <input
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
        {primerError("confirmPassword") !== null && (
          <span role="alert" className="text-xs text-red-700">
            {primerError("confirmPassword")}
          </span>
        )}
      </label>

      <BotonGuardar />

      {estado !== null && !estado.ok && estado.fieldErrors === undefined && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.error}
        </p>
      )}
    </form>
  );
}
