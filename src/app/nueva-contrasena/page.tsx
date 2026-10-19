import type { Metadata } from "next";
import Link from "next/link";

import { NuevaContrasenaForm } from "@/components/admin/NuevaContrasenaForm";
import { haySesionDeRecovery } from "@/server/auth/recovery";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * A dónde aterriza el link de recuperación después de `/auth/confirm`.
 *
 * ⛔ Vive FUERA del árbol de `/login` a propósito: `login/layout.tsx`
 *    redirige a `/admin` a quien tiene sesión, y la sesión de recovery ES
 *    una sesión. Si esta página viviera adentro, el flujo terminaría en
 *    el panel sin haber cambiado la contraseña.
 *
 * Si no hay sesión válida (link vencido, reutilizado o entrada directa),
 * no se muestra el formulario: se muestra el camino para pedir uno nuevo.
 */
export default async function NuevaContrasenaPage() {
  const sesionActiva = await haySesionDeRecovery();

  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-100 px-4">
      <section className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Nueva contraseña</h1>

        {sesionActiva ? (
          <>
            <p className="mt-1 text-sm text-neutral-500">
              Elegí la contraseña nueva para tu cuenta del panel.
            </p>
            <NuevaContrasenaForm />
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-neutral-500">
              El link venció o ya se usó. Pedí uno nuevo desde la pantalla de inicio de sesión.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-block w-full rounded-xl bg-neutral-900 px-4 py-3 text-center font-medium text-white transition hover:bg-neutral-700"
            >
              Ir a iniciar sesión
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
