"use client";

/**
 * Índice sticky de categorías (Client Component).
 *
 * · En mobile es scroll horizontal con `snap-x`: ocho categorías en
 *   flex-wrap a 320 px se comen media pantalla y empujan el producto
 *   fuera de vista. De `sm` para arriba vuelve a ser una lista normal.
 *
 * · El `IntersectionObserver` va en `useEffect`, no en el render: los
 *   `<section>` que observa los renderiza el servidor y el DOM existe
 *   recién después del montaje.
 *
 * · `rootMargin: "-96px 0px -60% 0px"` hace que la activa sea la primera
 *   sección que ocupa la parte superior, no la que roza el borde inferior.
 *
 * · El enlace activo lleva `aria-current="true"`: un `className` distinto
 *   no le dice nada a un lector de pantalla.
 */
import { useEffect, useState } from "react";

import { t } from "@/config/prototype";

interface CategoryLink {
  readonly slug: string;
  readonly name: string;
}

interface CategoryNavProps {
  categories: readonly CategoryLink[];
}

const ACTIVE_LINK = "bg-crust text-paper";
const INACTIVE_LINK = "text-ink-muted hover:text-ink border border-line bg-paper";
const BASE_LINK = "inline-block rounded-full px-3 py-1.5 text-sm font-medium transition-colors";

export function CategoryNav({ categories }: CategoryNavProps) {
  const [activeSlug, setActiveSlug] = useState(categories[0]?.slug ?? "");

  useEffect(() => {
    const sections = categories
      .map(({ slug }) => document.getElementById(slug))
      .filter((element): element is HTMLElement => element !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) setActiveSlug(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, [categories]);

  return (
    <nav
      aria-label={t("categories")}
      className="bg-cream/90 border-line sticky top-14 z-30 -mx-4 border-b px-4 py-3 backdrop-blur"
    >
      <ul className="flex snap-x gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible">
        {categories.map(({ slug, name }) => {
          const isActive = slug === activeSlug;

          return (
            <li key={slug} className="snap-start">
              <a
                href={`#${slug}`}
                aria-current={isActive ? "true" : undefined}
                className={
                  isActive ? `${BASE_LINK} ${ACTIVE_LINK}` : `${BASE_LINK} ${INACTIVE_LINK}`
                }
              >
                {name}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
