import { NextResponse } from "next/server";

/**
 * ⛔ Recibe los reportes de la CSP en modo `Report-Only`. Ver Tarea 19
 *    §6.4, etapa 2. La etapa 3 —activar la CSP bloqueante— es una
 *    decisión manual en el PR que la cambia, y no se toma acá.
 *
 * ⛔ Nunca responde 4xx por un cuerpo inválido. Un navegador que recibe
 *    un error en este endpoint deja de reportar, y el reporte que falta
 *    es el que no se lee. Se responde 204 siempre.
 */
export const dynamic = "force-dynamic";

const CREADOS: Reporte[] = [];

interface Reporte {
  readonly recibidoEn: string;
  readonly documento: string;
  readonly directiva: string;
  readonly bloqueado: string;
}

/**
 * El body de un reporte de CSP es `application/csp-report`, un objeto con
 * `csp-report`. Varios navegadores lo mandan en el campo `body`. Se leen
 * los dos y se guarda lo que haya.
 */
const leerReportes = (cuerpo: unknown): Reporte[] => {
  if (typeof cuerpo !== "object" || cuerpo === null) return [];

  const envoltorio = cuerpo as { "csp-report"?: unknown; body?: unknown };
  const crudo = envoltorio["csp-report"] ?? envoltorio.body;
  if (typeof crudo !== "object" || crudo === null) return [];

  const reporte = crudo as {
    "document-uri"?: string;
    "violated-directive"?: string;
    "blocked-uri"?: string;
  };

  return [
    {
      recibidoEn: new Date().toISOString(),
      documento: reporte["document-uri"] ?? "desconocido",
      directiva: reporte["violated-directive"] ?? "desconocida",
      bloqueado: reporte["blocked-uri"] ?? "desconocido",
    },
  ];
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const reportes = leerReportes(await request.json());
    if (reportes.length === 0) {
      console.warn("[csp-report] Cuerpo legible sin un reporte de CSP dentro.");
    }
    CREADOS.push(...reportes);
  } catch {
    // ⛔ Un body que no es JSON se registra como lo que es, y se
    //    responde igual. Ver la nota del encabezado.
    console.error("[csp-report] Body ilegible");
  }

  return new NextResponse(null, { status: 204 });
}

/**
 * ⛔ Los reportes quedan **en memoria, y a propósito**.
 *
 * Una función serverless es un módulo nuevo en cada invocación: este
 * arreglo se vacía solo y no sirve para nada. Lo que sirve es el log.
 * Guardarlos en la base sería escribir desde un endpoint público sin
 * sesión, que es exactamente lo que el modelo de la Tarea 19 no permite: la `anon`
 *    key lee, no escribe.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ total: CREADOS.length }, { headers: { "Cache-Control": "no-store" } });
}