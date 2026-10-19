/**
 * Rate limiting en memoria (Tarea 23 §anti-spam).
 *
 * Ventana deslizante por clave (IP del cliente). Diseñado para la acción
 * PÚBLICA `registerOrderAction`: sin ella, un script podría inundar la
 * columna "Pendientes" del tablero con comandas falsas.
 *
 * ⚠️ LIMITACIÓN CONOCIDA en serverless: el mapa vive por instancia de
 *    Vercel, no globalmente. Con N instancias calientes el límite real
 *    es N × `limit`. Para el volumen del negocio (< 30 pedidos/día) es
 *    suficiente como freno de scripts triviales; si el negocio escala, el
 *    reemplazo natural es Upstash Ratelimit, y la firma de esta función
 *    no tendría que cambiar.
 *
 * ⛔ Fail-closed: una clave vacía (IP indeterminable) consume igual, con
 *    la clave compartida "unknown", en vez de pasar de largo.
 */
import "server-only";

interface Bucket {
  readonly hits: number[];
}

const buckets = new Map<string, Bucket>();

/** Período de gracia al rearmar el proceso: el mapa muere con él. */
const prune = (bucket: Bucket, windowMs: number, now: number): void => {
  const cutoff = now - windowMs;
  while (bucket.hits.length > 0 && (bucket.hits[0] ?? 0) <= cutoff) {
    bucket.hits.shift();
  }
};

/**
 * Registra un intento y responde si la clave sigue dentro del límite.
 *
 * Devuelve `true` = permitido. El intento se cuenta SIEMPRE: contar solo
 * los permitidos dejaría pasar ráfagas sostenidas justo en el máximo.
 */
export const consumeRateLimit = (options: {
  readonly key: string;
  readonly limit: number;
  readonly windowMs: number;
}): boolean => {
  const now = Date.now();
  const key = options.key === "" ? "unknown" : options.key;
  const bucket = buckets.get(key) ?? { hits: [] };

  prune(bucket, options.windowMs, now);
  bucket.hits.push(now);
  buckets.set(key, bucket);

  // Sin esto el mapa crece una entrada por IP para siempre. El barrido
  // es oportunista: corre solo cuando el mapa se empieza a notar.
  if (buckets.size > 5_000) {
    for (const [clave, otro] of buckets) {
      prune(otro, options.windowMs, now);
      if (otro.hits.length === 0) buckets.delete(clave);
    }
  }

  return bucket.hits.length <= options.limit;
};
