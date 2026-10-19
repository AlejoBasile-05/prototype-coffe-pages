/**
 * `proxy.ts` — el middleware de Next.js 16 (Tarea 07 §6.9 + Tarea 19 §2.6).
 *
 * ⛔ ⛔ ESTO NO ES SEGURIDAD. ⛔ ⛔
 *
 * El proxy corre en el borde, antes de resolver la ruta, y no puede
 * consultar Postgres ni validar un token contra el servidor de Auth. La
 * autorización real es `verifyAdminSession()` en cada Server Action y en
 * `src/app/admin/layout.tsx` (Tarea 07 §4.2). Si este archivo se borra,
 * el panel sigue seguro; si la llamada a `verifyAdminSession` se borra de
 * una action y queda sólo esto, el panel es una puerta abierta.
 *
 * Hace tres cosas y sólo tres:
 *
 *   1. Renovar el token de sesión, para que el encargado no pierda el
 *      guardado a mitad de un cambio de precio.
 *   2. Mandar a `/login` a quien entra a `/admin` sin cookie (UX: no ver
 *      un instante la página en blanco del panel).
 *   3. Agregar los seis headers de seguridad a la respuesta (Tarea 19 §6.3).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { sanitizeNextPath } from "@/lib/validation/ruta-retorno";
import { construirHeaders } from "@/server/infra/security-headers";

/**
 * ⛔ El HSTS y la CSP se construyen con el entorno del REQUEST, no con una
 *    constante de módulo: por eso el módulo de headers vive aparte y se
 *    llama por request. Ver Tarea 19 §2.6 y §6.3.
 */
const headersDeRespuesta = (): Record<string, string> =>
  construirHeaders({
    isProduction: process.env.NODE_ENV === "production",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  });

/** Escribe los headers sobre cualquier respuesta del proxy (incluida la redirección). */
const aplicarHeaders = (respuesta: NextResponse): NextResponse => {
  for (const [nombre, valor] of Object.entries(headersDeRespuesta())) {
    respuesta.headers.set(nombre, valor);
  }
  return respuesta;
};

/**
 * Las rutas donde la cookie importa. En el resto del sitio no hay sesión
 * que renovar y no hay nada que redirigir: quedarse sólo con los headers
 * evita una llamada a Supabase Auth en cada página pública.
 */
const managesSesion = (pathname: string): boolean =>
  pathname.startsWith("/admin") || pathname === "/login";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  if (!managesSesion(pathname)) {
    return aplicarHeaders(NextResponse.next({ request }));
  }

  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "",
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        /**
         * ⛔ `setAll` RECONSTRUYE la respuesta. Es la API de `@supabase/ssr`
         *    y no es opcional: una `NextResponse` ya creada no puede recibir
         *    cookies nuevas. Por eso los headers se vuelven a aplicar en la
         *    respuesta nueva — si no, el refresh de sesión sacaría los
         *    headers justo de las rutas del panel.
         */
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          respuesta = aplicarHeaders(NextResponse.next({ request }));

          cookiesToSet.forEach(({ name, value, options }) => {
            respuesta.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  /**
   * ⚠️ `getClaims()` NO alcanza para autorizar: valida la firma del JWT
   *    localmente y NO consulta al servidor de Auth, así que un token
   *    revocado sigue siendo criptográficamente válido. Acá alcanza para lo
   *    único que se le pide —¿hay sesión para renovar el token?— porque la
   *    decisión de "¿entra?" la toma `verifyAdminSession`.
   */
  const { data, error } = await supabase.auth.getClaims();
  const tieneSesion = error === null && (data?.claims ?? null) !== null;

  if (pathname.startsWith("/admin") && !tieneSesion) {
    const destinoSeguro = sanitizeNextPath(`${pathname}${search}`);
    const url = new URL("/login", request.url);
    url.searchParams.set("next", destinoSeguro);

    // ⛔ Los headers van también en la redirección: un `curl -I` a
    //    `/admin` sin sesión es un 307, y sin esto no mostraría ninguno.
    return aplicarHeaders(NextResponse.redirect(url));
  }

  return aplicarHeaders(respuesta);
}

export const config = {
  /**
   * ⛔ Todas las rutas EXCEPTO los assets estáticos.
   *
   * Los headers tienen que estar en `curl -I` de cualquier ruta (Tarea 19
   * §8.1), así que el matcher no puede quedar encerrado en `/admin`. Lo
   * que sí quedan afuera son los archivos que sirve el CDN de Vercel sin
   * pasar por el proxy: para esos, `next.config.ts` declara `nosniff`
   * (§2.6) y ningún otro header protegería nada de un `.js` ya descargado.
   *
   * `/login` entra por los headers y por el refresh del token; la
   * redirección de UX sólo se dispara para `/admin`, así que no hay bucle
   * (Tarea 07 §6.9).
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};