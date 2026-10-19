import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { ToastViewport } from "@/components/ui/ClientOnlyToastViewport";
import { PROTOTYPE_CONFIG } from "@/config/prototype";
import "./globals.css";

/**
 * Fraunces (display) + Inter (cuerpo), auto-hospedadas por next/font:
 * sin request a Google en runtime y sin CLS.
 *
 * `display: "swap"` muestra la fuente de sistema hasta que llega la real.
 * Los `weight` explícitos evitan el subset variable que el navegador no
 * cachea bien.
 */
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-miga",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body-miga",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: PROTOTYPE_CONFIG.brand.name,
    template: `%s | ${PROTOTYPE_CONFIG.brand.name}`,
  },
  description: "Sándwiches de miga artesanales en San Rafael, Mendoza.",
  metadataBase: new URL(process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  // Un color por esquema: la barra del navegador acompaña al tema activo.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1b120d" },
  ],
  // Sin maximumScale ni userScalable: bloquear el zoom es un fallo de
  // accesibilidad (WCAG 1.4.4). Se fija solo el color de la barra.
  width: "device-width",
  initialScale: 1,
};

/**
 * Aplica el tema (light/dark) antes del primer paint para evitar el
 * flash del tema equivocado (FOUC de tema). Corre síncrono en <head>:
 * lee la preferencia guardada y, si no hay, la del sistema. Es el
 * patrón documentado por Arc UI. El script es estático (string literal,
 * sin input): no hay riesgo de inyección, pero sí impacta CSP — el
 * header Content-Security-Policy debe permitirlo con hash o nonce.
 */
const themeScript = `try {
  var saved = localStorage.getItem("theme");
  var dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
} catch {}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Las clases de variable van en <html>, no en <body>: los tokens
    // font-family los resuelve :root, y un portal del Sheet fuera del
    // body perdería la tipografía si las variables vivieran ahí.
    // suppressHydrationWarning: el theme script muta <html> (data-theme)
    // antes de hidratar; sin esto React reportaría un falso mismatch.
    <html
      lang="es-AR"
      className={`${display.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* El provider envuelve el body entero para que useToast funcione
          en cualquier Server Action y página, sin que cada ruta tenga
          que acordarse de montarlo. El viewport es hermano, no hijo:
          es presentación y solo necesita el hook. */}
      <body className="min-h-dvh">
        {/* El provider envuelve el body entero para que useToast funcione
            en cualquier Server Action y página. El viewport va DENTRO:
            usa el hook `useToast` y fuera del provider lanzaría (un
            ToastViewport hermano falla con el contexto a null). */}
        <ToastProvider>
          {children}
          <ToastViewport />
        </ToastProvider>
      </body>
    </html>
  );
}
