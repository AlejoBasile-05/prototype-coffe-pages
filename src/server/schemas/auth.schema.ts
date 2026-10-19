import { z } from "zod";

/**
 * ⛔ `password` tiene `min(8)`: Supabase exige 6 por defecto, pero 6 es
 *    demasiado poco para una cuenta que puede publicar precios y cambiar
 *    el número de WhatsApp del local. El rate limiting y el 2FA son de la
 *    Tarea 19; 8 es el piso del formulario, no la solución completa.
 */
const emailField = z
  .string()
  .trim()
  .min(1, { message: "Ingresá tu email." })
  .email({ message: "El email no tiene formato válido." })
  // Se normaliza a minúsculas: el login también lo hace, y un login
  // case-sensitive es una fuente de tickets de soporte evitable.
  .transform((valor) => valor.toLowerCase());

export const LoginSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(8, { message: "La contraseña tiene al menos 8 caracteres." })
    .max(200, { message: "La contraseña es demasiado larga." }),
});

export const MagicLinkSchema = z.object({
  email: emailField,
});

/**
 * Contraseña NUEVA del flujo de recuperación (Tarea 24).
 *
 * Piso de 8 como el resto del sistema (ver nota arriba), máximo 200.
 * La confirmación se compara en `superRefine`: con un `.refine` sobre un
 * solo campo Zod no puede mirar el otro.
 */
export const PasswordResetSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "La contraseña tiene al menos 8 caracteres." })
      .max(200, { message: "La contraseña es demasiado larga." }),
    confirmPassword: z.string().min(1, { message: "Repetí la contraseña nueva." }),
  })
  .superRefine((valor, ctx) => {
    if (valor.password !== valor.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Las contraseñas no coinciden.",
      });
    }
  });

export type LoginInput = z.infer<typeof LoginSchema>;
export type MagicLinkInput = z.infer<typeof MagicLinkSchema>;
export type PasswordResetInput = z.infer<typeof PasswordResetSchema>;
