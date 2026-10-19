"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  loginAction,
  loginWithMagicLinkAction,
  requestPasswordResetAction,
  type AuthActionResult,
} from "@/server/auth/actions";

interface LoginFormProps {
  /** Ya saneado en el servidor (`sanitizeNextPath`). */
  readonly nextPath: string;
  /** Error que llega por query, saneado en el servidor (Tarea 24). */
  readonly errorInicial?: string | null;
}

const BotonEnviar = ({ etiqueta }: { readonly etiqueta: string }) => {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Un momento…" : etiqueta}
    </button>
  );
};

const Mensaje = ({ resultado }: { readonly resultado: AuthActionResult | null }) => {
  if (resultado === null) return null;
  if (resultado.ok) {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        {resultado.message}
      </p>
    );
  }
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {resultado.error}
    </p>
  );
};

export function LoginForm({ nextPath, errorInicial = null }: LoginFormProps) {
  const [estadoLogin, enviarLogin] = useActionState(loginAction, null);
  const [estadoMagico, enviarMagico] = useActionState(loginWithMagicLinkAction, null);
  const [estadoReset, enviarReset] = useActionState(requestPasswordResetAction, null);

  return (
    <div className="mt-6 flex flex-col gap-4">
      {errorInicial !== null && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorInicial}
        </p>
      )}
      <form action={enviarLogin} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={nextPath} />

        <label className="flex flex-col gap-1 text-sm text-neutral-900">
          Email
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            className="rounded-lg border border-neutral-300 px-3 py-2"
            placeholder="dueno@prototype.invalid"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-900">
          Contraseña
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            minLength={8}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>

        <BotonEnviar etiqueta="Iniciar sesión" />
        <Mensaje resultado={estadoLogin} />
      </form>

      <details className="text-sm">
        <summary className="cursor-pointer text-neutral-500">Entrar con un link por email</summary>

        <form action={enviarMagico} className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-neutral-900">
            Email
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              className="rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>

          <BotonEnviar etiqueta="Enviar link" />
          <Mensaje resultado={estadoMagico} />
        </form>
      </details>

      {/* Recuperación (Tarea 24): manda el mail que aterriza en
          /auth/confirm. El mensaje de éxito es genérico a propósito —
          ver requestPasswordResetAction. */}
      <details className="text-sm">
        <summary className="cursor-pointer text-neutral-500">Olvidé mi contraseña</summary>

        <form action={enviarReset} className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-neutral-900">
            Email
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              className="rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>

          <BotonEnviar etiqueta="Enviar link de recuperación" />
          <Mensaje resultado={estadoReset} />
        </form>
      </details>
    </div>
  );
}
