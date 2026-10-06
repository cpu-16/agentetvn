// P = 30R + 25I + 20U + 15N + 10E · cada componente 0–1 con su explicación en español. Reglas: config/scoring-v1.json.
import { leerScoring, TEMAS_AGENDA, type Scoring } from "./config";
import type { Componentes, Contradiccion, Indicador, Noticia, Procedencia, Rango, Sismo } from "./contrato";
import { idIndicador } from "./contexto";

export interface EntradaPuntaje {
  publicaciones: Noticia[];
  procedencias: Procedencia[];
  tema: string;
  por_revisar: boolean;
  contexto: { indicadores: string[]; sismos: string[] };
  contradicciones: Contradiccion[];
  novedad: "primera" | "segunda_ola" | "repeticion";
  fecha_original: string | null;
  corteUTC: string;
  indicadores: Indicador[];
  sismos: Sismo[];
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const OTROS_PAISES = /\b(costa rica|colombia|m[eé]xico|guatemala|honduras|nicaragua|el salvador|venezuela|ecuador|per[uú]|chile|argentina|brasil|espa[ñn]a|estados unidos|eeuu|rep[uú]blica dominicana)\b/i;
const PANAMA = /panam[aá]|panameñ|canal de panam|\bacp\b|chiriqu[ií]|col[oó]n|david|santiago de veraguas|bocas del toro|azuero|darién/i;

export function componenteR(pubs: Noticia[], tema: string, porRevisar: boolean, cfg: Scoring["R"]): { v: number; expl: string } {
  const texto = pubs.map((p) => `${p.titulo} ${p.descripcion}`).join(" ");
  const esTvn = pubs.some((p) => p.medio === "TVN");
  let geo: number, g: string;
  if (PANAMA.test(texto) || esTvn) (geo = 1), (g = esTvn && !PANAMA.test(texto) ? "medio panameño (TVN)" : "menciona Panamá o un lugar panameño");
  else if (OTROS_PAISES.test(texto)) (geo = 0), (g = "nombra otro país y no Panamá");
  else (geo = cfg.geo_sin_mencion), (g = "sin mención explícita de Panamá (vino de consulta «Panama»)");
  const enAgenda = TEMAS_AGENDA.includes(tema);
  const temaOk = enAgenda ? (porRevisar ? 0.5 : 1) : 0;
  const t = enAgenda ? (porRevisar ? `tema ${tema} por revisar` : `tema ${tema} de la agenda`) : `tema ${tema} fuera de la agenda`;
  return { v: r3(cfg.tema * temaOk + cfg.geo * geo), expl: `${g}; ${t}` };
}

const NACIONAL = /\b(gobierno|presidente|mulino|asamblea|diputad|ministerio|ministr|mef|inec|css\b|caja de seguro|acp\b|canal de panam|idaan|ensa|naturgy|sinaproc|contralor|procurad|corte suprema|ley\b|decreto|superintendencia|banco nacional|tocumen|metro de panam|meduca|minsa|mici|mida|atp\b|acodeco|asep|anati|migraci[oó]n|elecciones|tribunal electoral)/i;
const SECTORIAL = /\b(sector|gremio|c[aá]mara de comercio|fedec[aá]maras|apede|sindicato|colegio de|hoteler|naviera|bancos?|aseguradora|productores|transportistas|m[eé]dicos|docentes|provincia|chiriqu[ií]|col[oó]n|veraguas|azuero|bocas del toro|coc[lé]|herrera|los santos|dari[eé]n|comarca)/i;
const COMERCIAL = /\b(presenta|lanza|lanzamiento|nueva identidad|celebra sus?|aniversario|inaugura su|llega a panam[aá]|de la mano de|motor show|nuevo (modelo|cx|x5|ti)|flota|rent a car|concesionario|promoci[oó]n|descuentos|black weekend|marca)\b/i;

export function alcanceDe(texto: string): keyof Scoring["I"]["alcance"] {
  if (NACIONAL.test(texto)) return "nacional";
  if (COMERCIAL.test(texto)) return "comercial";
  if (SECTORIAL.test(texto)) return "sectorial";
  if (/\b(barrio|corregimiento|distrito|comunidad|vecinos|alcald[ií]a|junta comunal)\b/i.test(texto)) return "local";
  return "desconocido";
}

export function componenteI(tema: string, contexto: EntradaPuntaje["contexto"], indicadores: Indicador[], sismos: Sismo[], cfg: Scoring["I"], texto = ""): { v: number; expl: string } {
  const prior = cfg.prior[tema] ?? 0;
  const alc = alcanceDe(texto);
  const alcance = cfg.alcance[alc];
  let magnitud = 0;
  let m = "sin dato oficial ligado";
  const idInd = contexto.indicadores[0];
  if (idInd) {
    const [pais, ind] = idInd.split(":");
    const serie = indicadores.filter((i) => i.pais_iso3 === pais && i.indicador_id === ind && i.valor !== null).sort((a, b) => b.anio - a.anio);
    if (serie.length >= 2) {
      const delta = Math.abs(serie[0].valor! - serie[1].valor!);
      const deltas = [];
      for (const p of new Set(indicadores.map((i) => i.pais_iso3))) {
        const s = indicadores.filter((i) => i.pais_iso3 === p && i.indicador_id === ind && i.valor !== null).sort((a, b) => a.anio - b.anio);
        for (let k = 1; k < s.length; k++) deltas.push(Math.abs(s[k].valor! - s[k - 1].valor!));
      }
      deltas.sort((a, b) => a - b);
      const p90 = deltas[Math.floor(deltas.length * 0.9)] || 1;
      magnitud = Math.min(1, delta / p90);
      m = `variación ${serie[1].anio}→${serie[0].anio} de ${ind} (${pais}) = ${r3(delta)} vs p90 regional ${r3(p90)}`;
    } else m = `${idInd}: un solo año con valor, variación no calculable`;
  } else if (contexto.sismos[0]) {
    const s = sismos.find((x) => x.id === contexto.sismos[0]);
    if (s) (magnitud = Math.min(1, Math.max(0, (s.magnitude - 3) / 4))), (m = `sismo M${s.magnitude} (es magnitud, no daño)`);
  }
  return { v: r3(cfg.peso_prior * prior + cfg.peso_alcance * alcance + cfg.peso_magnitud * magnitud), expl: `prior editorial del tema ${tema} = ${prior}; alcance ${alc} = ${alcance}; ${m}` };
}

export function componenteU(pubs: Noticia[], corteUTC: string, cfg: Scoring["U"]): { v: number; expl: string } {
  const fechas = pubs.map((p) => p.fecha_publicacion).filter((f): f is string => !!f).sort();
  if (!fechas.length) return { v: cfg.sin_fecha_publicacion, expl: "sin fecha de publicación (GDELT solo informa detección, que no rejuvenece la noticia)" };
  const reciente = fechas[fechas.length - 1];
  const horas = (new Date(corteUTC).getTime() - new Date(reciente).getTime()) / 3600000;
  for (const [h, v] of cfg.tabla_horas) if (horas < h) return { v, expl: `publicación más reciente hace ${Math.round(horas)} h (< ${h} h)` };
  return { v: cfg.mas_antigua, expl: `publicación más reciente hace ${Math.round(horas / 24)} días; se muestra la fecha original` };
}

export function componenteN(novedad: EntradaPuntaje["novedad"], cfg: Scoring["N"]): { v: number; expl: string } {
  if (novedad === "primera") return { v: 1, expl: "primera aparición del evento en el snapshot" };
  if (novedad === "segunda_ola") return { v: cfg.segunda_ola, expl: "segunda ola de un evento ya agrupado antes" };
  return { v: 0, expl: "repetición o recirculación; las copias no suman" };
}

export function componenteE(pubs: Noticia[], procedencias: Procedencia[], contexto: EntradaPuntaje["contexto"], cfg: Scoring["E"]): { v: number; expl: string; primaria: boolean } {
  const primaria = contexto.indicadores.length > 0 || contexto.sismos.length > 0 || pubs.some((p) => /\.gob\.pa$/i.test(p.medio));
  const M = procedencias.filter((p) => p.tipo !== "no_verificada").length;
  const indep = Math.min(1, M / 2);
  const ident = pubs.every((p) => p.url && (p.fecha_publicacion || p.fecha_deteccion)) ? 1 : 0;
  const noVer = procedencias.find((p) => p.tipo === "no_verificada");
  return {
    v: r3(cfg.primaria * (primaria ? 1 : 0) + cfg.independencia * indep + cfg.identificable * ident),
    expl: `${primaria ? "con" : "sin"} fuente primaria; ${M} procedencia(s) identificada(s)${noVer ? ` + ${noVer.ids_noticia.length} publicación(es) con independencia no verificada` : ""}; ${ident ? "todas" : "no todas"} las publicaciones con URL y fecha`,
    primaria,
  };
}

export function rangoDe(P: number, cfg: Scoring["rangos"]): Rango {
  if (P < cfg.bajo[1]) return "bajo";
  if (P < cfg.medio[1]) return "medio";
  return "alto";
}

export function puntuar(e: EntradaPuntaje, cfg: Scoring = leerScoring()): Componentes & { P: number; rango: Rango; primaria: boolean } {
  const R = componenteR(e.publicaciones, e.tema, e.por_revisar, cfg.R);
  const I = componenteI(e.tema, e.contexto, e.indicadores, e.sismos, cfg.I, e.publicaciones.map((p) => `${p.titulo} ${p.descripcion}`).join(" "));
  const U = componenteU(e.publicaciones, e.corteUTC, cfg.U);
  const N = componenteN(e.novedad, cfg.N);
  const E = componenteE(e.publicaciones, e.procedencias, e.contexto, cfg.E);
  const P = Math.round((cfg.pesos.R * R.v + cfg.pesos.I * I.v + cfg.pesos.U * U.v + cfg.pesos.N * N.v + cfg.pesos.E * E.v) * 100) / 100;
  return { R: R.v, I: I.v, U: U.v, N: N.v, E: E.v, explicacion: { R: R.expl, I: I.expl, U: U.expl, N: N.expl, E: E.expl }, P, rango: rangoDe(P, cfg.rangos), primaria: E.primaria };
}

/** Orden del reto: P desc, luego U desc, luego id asc (sin redondear antes). */
export function ordenar<T extends { P: number; componentes: { U: number }; id: string }>(eventos: T[]): T[] {
  return [...eventos].sort((a, b) => b.P - a.P || b.componentes.U - a.componentes.U || a.id.localeCompare(b.id));
}

export { idIndicador };
