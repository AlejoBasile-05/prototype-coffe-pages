"use client";

/**
 * Fallback del recovery por HASH (Tarea 24).
 *
 * Cuando la plantilla de mail de Supabase usa `{{ .ConfirmationURL }}`,
 * el endpoint de Auth consume el OTP y redirige con los tokens en el
 * FRAGMENTO (`#access_token=…&type=recovery`). El fragmento nunca viaja
 * al servidor — es una regla de HTTP, no una decisión de diseño — así
 * que `/auth/confirm` redirige acá conservando el hash, y esta pantalla
 * lo lee en el navegador y lo canjea por cookies de sesión vía
 * `POST /auth/session`.
 *
 * Es un componente de transición: muestra un estado, decide, y navega.
 * No tiene otra responsabilidad.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function HashRecovery() {
  const router = useRouter();
  const ejecutado = useRef(false);

  useEffect(() => {
    if (ejecutado.current) return;
    ejecutado.current = true;

    const ejecutar = async (): Promise<string> => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      // Solo el flujo de recovery. Un hash de otro tipo (invite, signup)
      // no es asunto de esta pantalla.
      if (type !== "recovery" || accessToken === null || refreshToken === null) {
        return "/login?error=link-invalido";
      }

      try {
        const respuesta = await fetch("/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
        });

        return respuesta.ok ? "/nueva-contrasena" : "/login?error=link-invalido";
      } catch {
        return "/login?error=link-invalido";
      }
    };

    void ejecutar().then((destino) => router.replace(destino));
  }, [router]);

  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-100 px-4">
      <p role="status" className="text-sm text-neutral-500">
        Verificando tu link…
      </p>
    </main>
  );
}
