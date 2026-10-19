"use client";

/**
 * Botón del header con el ícono de carrito y el badge de cantidad.
 *
 * El total sale de `getCartItemCount({ lines })` con las líneas ya
 * suscritas: el componente se re-renderiza cuando cambia `lines` y
 * deriva el número en el render, así el badge no puede quedar viejo
 * (no hay dos copias del valor). "99+" corta en tres dígitos: un badge
 * de cuatro empuja el ícono del borde del header en 320 px.
 */
import { getCartItemCount } from "@/lib/cart/cart-rules";
import { tapFeedback } from "@/lib/haptics";
import { useCartStore } from "@/store/cart-store";

export function CartButton() {
  const lines = useCartStore((state) => state.lines);
  const setOpen = useCartStore((state) => state.setOpen);

  const units = getCartItemCount({ lines });

  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback();
        setOpen(true);
      }}
      aria-label={`Abrir el carrito, ${units} ${units === 1 ? "artículo" : "artículos"}`}
      className="border-line hover:bg-ink/5 rounded-control relative flex size-10 items-center justify-center border"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="text-ink size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
        />
      </svg>

      {units > 0 && (
        <span className="bg-crust-deep text-paper absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full px-1 text-[11px] leading-5 font-semibold">
          {units > 99 ? "99+" : units}
        </span>
      )}
    </button>
  );
}
