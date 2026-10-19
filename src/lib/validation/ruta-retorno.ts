/**
 * Saneo del parámetro `next` (la ruta a la que se vuelve tras el login).
 *
 * ⛔ ESTA FUNCIÓN EXISTE POR UNA COSA: el open redirect.
 *
 * El middleware manda a `/login?next=/admin/productos`. Si ese valor se
 * usara crudo en `redirect()` después de autenticarse, cualquiera podría
 * mandar al encargado a un sitio de phishing con un link que **empieza
 * por nuestro dominio**:
 *
 *     https://prototype.example.com/login?next=//evil.com/steal
 *
 * `redirect("//evil.com/steal")` lo trata como URL absoluta y navega
 * afuera. Con esta sanita, vuelve a `/admin`.
 *
 * Regla: el valor tiene que ser un **path relativo con una sola barra**.
 * Nada de esquema, nada de protocolo relativo, nada de salto de línea,
 * nada de barra invertida, y nada que apunte de vuelta a `/login`.
 */

export const DEFAULT_ADMIN_PATH = "/admin";

export const sanitizeNextPath = (rawValue: string | null | undefined): string => {
  if (rawValue === null || rawValue === undefined) return DEFAULT_ADMIN_PATH;

  const value = rawValue.trim();

  if (value === "") return DEFAULT_ADMIN_PATH;
  // Una sola barra inicial. `//host` es un protocolo relativo (http://host).
  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_ADMIN_PATH;
  // `/\host` invierte el chequeo en algunos navegadores.
  if (value.startsWith("/\\") || value.includes("\\")) return DEFAULT_ADMIN_PATH;
  // Newlines: cabecera `Location` inyectada.
  if (/[\r\n]/.test(value)) return DEFAULT_ADMIN_PATH;
  // Bucle de redirección: mandar a /login desde /login.
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login/")) {
    return DEFAULT_ADMIN_PATH;
  }

  return value;
};
