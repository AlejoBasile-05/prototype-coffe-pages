"use client";

/**
 * Una fila del carrito: imagen, nombre, precio de la línea, stepper y
 * quitar.
 *
 * · La línea se queda aunque `available` sea `false`: se marca "Ya no
 *   está disponible" y el cliente decide. Vaciarle el carrito a sus
 *   espaldas es peor que avisarle; la Tarea 13 revalida antes de mandar.
 *
 * · El precio mostrado es `unitPrice * quantity`, formateado una vez.
 */
import Image from "next/image";
import Link from "next/link";

import type { CartLine } from "@/lib/cart/cart-types";
import { formatARS } from "@/lib/format/currency";
import cloudinaryLoader from "@/lib/images/cloudinary-loader";
import { useCartStore } from "@/store/cart-store";

import { QuantityStepper } from "./QuantityStepper";

interface CartLineItemProps {
  line: CartLine;
}

export function CartLineItem({ line }: CartLineItemProps) {
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  const title = line.variantName ? `${line.name} · ${line.variantName}` : line.name;

  return (
    <li className="flex gap-3 py-4">
      <div className="bg-cream rounded-control relative size-16 shrink-0 overflow-hidden">
        {line.imageUrl !== null && line.imageUrl !== "" && (
          <Image
            loader={cloudinaryLoader}
            src={line.imageUrl}
            alt={line.name}
            fill
            sizes="64px"
            className={line.available ? "object-cover" : "object-cover opacity-60 grayscale"}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/producto/${line.slug}`}
            className="text-ink min-w-0 text-sm font-medium hover:underline"
          >
            <span className="line-clamp-1">{title}</span>
          </Link>

          <span className="text-ink shrink-0 text-sm font-medium">
            {formatARS(line.unitPrice * line.quantity)}
          </span>
        </div>

        {!line.available && <p className="text-clay text-xs">Ya no está disponible</p>}

        <div className="mt-1 flex items-center justify-between gap-2">
          <QuantityStepper
            value={line.quantity}
            onChange={(quantity) => setQuantity(line.productId, line.variantId, quantity)}
            label={title}
            size="sm"
          />

          <button
            type="button"
            onClick={() => removeItem(line.productId, line.variantId)}
            aria-label={`Quitar ${title} del carrito`}
            className="text-ink-muted hover:text-clay text-xs underline-offset-2 hover:underline"
          >
            Quitar
          </button>
        </div>
      </div>
    </li>
  );
}
