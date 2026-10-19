/**
 * Estado "abierto/cerrado" del local (capa 0 · dominio).
 *
 * Puro y sin I/O: recibe los horarios y un instante, devuelve el estado.
 * 100% testeable sin reloj del sistema — los tests congelan `now`.
 *
 * ⚠️ Timezone fija del local: Vercel corre en UTC y el navegador del
 *    cliente puede estar en cualquier zona, pero el negocio abre y cierra
 *    en San Rafael, Mendoza. Por eso la hora se evalúa SIEMPRE en
 *    `America/Argentina/Mendoza`, con `Intl` (sin dependencia nueva).
 */
import type { OpeningHours } from "./settings";
import { WEEKDAY_KEYS, WEEKDAY_LABELS, type WeekdayKey } from "./settings";

export const BUSINESS_TIME_ZONE = "America/Argentina/Mendoza";

export type OpenState =
  | { readonly estado: "abierto"; readonly cierra: string }
  | {
      readonly estado: "cerrado";
      /** `dia_completo`: el local no abre hoy. `fuera_de_horario`: abre más tarde o ya cerró. */
      readonly motivo: "dia_completo" | "fuera_de_horario";
      /** Próximo momento de apertura, si existe dentro de los próximos 7 días. */
      readonly proximaApertura: { readonly diaLabel: string; readonly hora: string } | null;
    };

interface RelojLocal {
  readonly diaKey: WeekdayKey;
  readonly minutosDelDia: number;
}

/**
 * Formateador de una sola instancia por módulo: construir
 * `Intl.DateTimeFormat` por llamada cuesta ~10× más que el resto del
 * cálculo junto.
 */
const RELOJ_MENDOZA = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const PARTE_A_DIA_KEY: Readonly<Record<string, WeekdayKey>> = {
  Sun: "sunday",
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
};

/**
 * Día y minuto local del local para un instante dado. Devuelve `null` si
 * el formato no pudo parsearse (mejor no mostrar estado que mostrar el
 * estado equivocado: quien consume decide).
 */
export const relojDelLocal = (now: Date): RelojLocal | null => {
  const partes = RELOJ_MENDOZA.formatToParts(now);
  const get = (tipo: string): string | undefined =>
    partes.find((parte) => parte.type === tipo)?.value;

  const diaKey = PARTE_A_DIA_KEY[get("weekday") ?? ""];
  const hora = Number(get("hour"));
  const minuto = Number(get("minute"));

  if (diaKey === undefined || Number.isNaN(hora) || Number.isNaN(minuto)) return null;
  return { diaKey, minutosDelDia: hora * 60 + minuto };
};

const aMinutos = (hhmm: string): number => {
  const [hora = "0", minuto = "0"] = hhmm.split(":");
  return Number(hora) * 60 + Number(minuto);
};

const diaSiguiente = (diaKey: WeekdayKey, salto: number): WeekdayKey => {
  const indice = WEEKDAY_KEYS.indexOf(diaKey);
  return WEEKDAY_KEYS[(indice + salto + WEEKDAY_KEYS.length) % WEEKDAY_KEYS.length] ?? "monday";
};

/** La franja de un día, o `null` si permanece cerrado todo el día. */
const franjaDelDia = (
  hours: OpeningHours,
  diaKey: WeekdayKey,
): { readonly opens: string; readonly closes: string } | null => hours[diaKey] ?? null;

/**
 * ¿Está abierto el local en `now`? Responde también con la próxima
 * apertura cuando está cerrado, porque TODO consumidor (banner, botón
 * de agregar, checkout) necesita decir cuándo vuelve.
 */
export const getOpenState = (hours: OpeningHours, now: Date): OpenState | null => {
  const reloj = relojDelLocal(now);
  if (reloj === null) return null;

  // Sin UN SOLO día cargado no hay base para decidir: `null` ("horario no
  // informado") es distinto de "cerrado" — no se muestra banner ni se
  // bloquea el carrito cuando el local todavía no cargó sus horarios.
  if (Object.keys(hours).length === 0) return null;

  const { diaKey, minutosDelDia } = reloj;

  // La franja de AYER puede seguir viva: un local que cierra de madrugada
  // (22:00–02:00) está abierto a la 1:00 con la franja del día anterior.
  const ayer = franjaDelDia(hours, diaSiguiente(diaKey, -1));
  if (ayer !== null && aMinutos(ayer.closes) <= aMinutos(ayer.opens)) {
    if (minutosDelDia < aMinutos(ayer.closes)) {
      return { estado: "abierto", cierra: ayer.closes };
    }
  }

  const hoy = franjaDelDia(hours, diaKey);
  const motivo: "dia_completo" | "fuera_de_horario" = hoy === null ? "dia_completo" : "fuera_de_horario";

  if (hoy !== null) {
    const abre = aMinutos(hoy.opens);
    const cierra = aMinutos(hoy.closes);
    // Normal (abre < cierra) o madrugada (cierra <= abre: cierra mañana).
    const abierto = abre <= minutosDelDia && (minutosDelDia < cierra || cierra <= abre);
    if (abierto) return { estado: "abierto", cierra: hoy.closes };
  }

  // Próxima apertura: hoy (si aún no abrió) y luego los 6 días siguientes.
  if (hoy !== null && minutosDelDia < aMinutos(hoy.opens) && aMinutos(hoy.opens) < aMinutos(hoy.closes)) {
    return cerrado(motivo, { diaLabel: "Hoy", hora: hoy.opens });
  }
  for (let salto = 1; salto <= WEEKDAY_KEYS.length; salto += 1) {
    const diaCandidato = diaSiguiente(diaKey, salto);
    const franja = franjaDelDia(hours, diaCandidato);
    if (franja === null) continue;
    return cerrado(motivo, {
      diaLabel: salto === 1 ? "Mañana" : WEEKDAY_LABELS[diaCandidato],
      hora: franja.opens,
    });
  }

  return cerrado(motivo, null);
};

const cerrado = (
  motivo: "dia_completo" | "fuera_de_horario",
  proximaApertura: { readonly diaLabel: string; readonly hora: string } | null,
): OpenState => ({ estado: "cerrado", motivo, proximaApertura });

/**
 * Texto corto para CTA deshabilitados y banners. Ejemplos:
 *  · abierto                    → "Abierto hasta las 20:30"
 *  · cerrado con próxima        → "Abre hoy a las 08:30" / "Abre mañana a las 08:30" / "Abre el lunes a las 08:30"
 *  · cerrado sin próxima        → "Sin horario cargado"
 */
export const describirEstado = (estado: OpenState | null): string => {
  if (estado === null) return "Horario no disponible";
  if (estado.estado === "abierto") return `Abierto hasta las ${estado.cierra}`;
  if (estado.proximaApertura === null) return "Cerrado por ahora";
  const { diaLabel, hora } = estado.proximaApertura;
  return `Abre ${diaLabel === "Hoy" || diaLabel === "Mañana" ? diaLabel.toLowerCase() : `el ${diaLabel.toLowerCase()}`} a las ${hora}`;
};
