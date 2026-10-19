import { NextResponse, type NextRequest } from "next/server";
import { ZodError, z } from "zod";

import { verifyAdminSession } from "@/server/auth/verify-admin";
import { signProductImageUpload } from "@/server/services/image.service";

export const runtime = "nodejs";

const FirmarImagenSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    // Sin esto, un nombre enteramente no-alfanumérico produce
    // `prototype/products/` como public_id, que Cloudinary rechaza.
    // Caso borde documentado en la Tarea 06 §9.
    .regex(/[a-z0-9]/, "El slug debe contener al menos un caracter alfanumérico"),
});

/**
 * Firma una subida de imagen de producto.
 *
 * Autorización real desde la Tarea 07: `verifyAdminSession()` valida el
 * token contra Supabase Auth y cruza con `staff_members`. Sin sesión, 401.
 *
 *    Que el `slug` corresponda al producto que el admin está editando lo
 *    valida el flujo de la Tarea 16: firmar para un slug arbitrario queda
 *    documentado como deuda en la Tarea 06 §12.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await verifyAdminSession();
  if (session === null) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const cuerpo = FirmarImagenSchema.parse(await request.json());
    return NextResponse.json(signProductImageUpload(cuerpo.slug));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Datos de la firma inválidos." }, { status: 400 });
    }
    console.error("[api:images/sign]", error);
    return NextResponse.json({ error: "No se pudo firmar la subida." }, { status: 500 });
  }
}
