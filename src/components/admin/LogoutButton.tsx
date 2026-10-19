"use client";

import { useFormStatus } from "react-dom";

import { logoutAction } from "@/server/auth/actions";

const Boton = () => {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="border-line-strong text-ink hover:bg-cream rounded-control w-full border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
};

/**
 * El logout es una Server Action del archivo de la Tarea 07. Este
 * componente existe solo para el estado de carga: sin él, el botón queda
 * habilitado y un segundo clic manda dos `signOut`.
 *
 * `useFormStatus` lee el estado del `<form>` padre, así que tiene que
 * vivir en un hijo: por eso el botón está en su propio componente y no
 * inline en el `<form>`.
 */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Boton />
    </form>
  );
}
