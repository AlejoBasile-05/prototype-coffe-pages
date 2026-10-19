import type { Metadata } from "next";

import { PROTOTYPE_CONFIG } from "@/config/prototype";
import { sanitizeNextPath } from "@/lib/validation/ruta-retorno";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;

  // ⛔ Se sanea en el SERVIDOR, no en el cliente. Si se hiciera en el
  //    cliente, el HTML ya traería el valor crudo.
  const nextCrudo = Array.isArray(params.next) ? params.next[0] : params.next;
  const destino = sanitizeNextPath(nextCrudo);

  // ⛔ Whitelist, nunca el texto crudo del querystring: un mensaje libre
  //    en la URL sería un canal para pintar texto arbitrario en la
  //    pantalla de login (phishing asistido).
  const errorCrudo = Array.isArray(params.error) ? params.error[0] : params.error;
  const errorInicial =
    errorCrudo === "link-invalido"
      ? "El link venció o ya se usó. Pedí uno nuevo desde «Olvidé mi contraseña»."
      : null;

  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-100 px-4">
      <section className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {PROTOTYPE_CONFIG.brand.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Panel de administración</p>

        <LoginForm nextPath={destino} errorInicial={errorInicial} />

        <p className="mt-6 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          Si no entrás, pedile al encargado del local que te habilite el acceso.
        </p>
      </section>
    </main>
  );
}
