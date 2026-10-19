import Link from "next/link";

/**
 * 404 raíz. Hoy es la pantalla que ve el cliente desde cualquier enlace
 * roto: tiene salidas visibles a la home y al menú. No hereda el layout
 * público (los segmentos con `not-found` propio lo usan), así que trae
 * su propio `<main>`.
 */
export default function NotFound() {
  return (
    <main className="bg-cream text-ink mx-auto flex min-h-dvh max-w-6xl flex-col items-start justify-center gap-4 px-4">
      <h1 className="font-display text-3xl">No encontramos esta página</h1>

      <p className="text-ink-muted max-w-prose">
        Puede que el link esté viejo o que la dirección tenga un error de tipeo.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="text-ink rounded-control border-line border px-5 py-3 font-medium"
        >
          Ir al inicio
        </Link>

        <Link href="/menu" className="bg-crust text-paper rounded-control px-5 py-3 font-medium">
          Ver el menú
        </Link>
      </div>
    </main>
  );
}
