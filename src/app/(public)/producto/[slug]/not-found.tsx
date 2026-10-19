import Link from "next/link";

/**
 * 404 de producto. Un `not-found` sin salida es un callejón sin salida:
 * el link al menú es adonde el visitante realmente quiere ir.
 */
export default function ProductNotFound() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-20">
      <h1 className="text-ink font-display text-3xl">No encontramos ese producto</h1>

      <p className="text-ink-muted max-w-prose">
        Puede que haya cambiado de nombre o que ya no esté en el menú.
      </p>

      <Link href="/menu" className="bg-crust text-paper rounded-control px-5 py-3 font-medium">
        Volver al menú
      </Link>
    </div>
  );
}
