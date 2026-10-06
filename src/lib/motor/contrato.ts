// Contrato de datos de AgenteTVN · alineado a la §7 del reto (campos mínimos) y a la §4 (puntaje y estados).
import { createHash } from "crypto";

export type Origen = "tvn_rss" | "gdelt" | "sintetica";

export interface Noticia {
  id_noticia: string;
  titulo: string;
  descripcion: string; // extracto corto del RSS; vacío en GDELT
  url: string;
  medio: string;
  idioma: string;
  fecha_publicacion: string | null; // ISO 8601 UTC; GDELT no la da
  fecha_deteccion: string | null; // seendate de GDELT; nunca sustituye a la publicación
  fecha_extraccion: string;
  tema: string | null; // lo rellena el motor
  origen: Origen;
  alcance_texto: "titular_metadatos";
  agencia: string | null; // EFE, AFP… si el texto la atribuye
  sintetica: boolean; // casos de prueba creados por el equipo
  no_confiable: boolean; // marcada por el detector de inyección
  seccion: string | null; // sección del RSS (TVN) o null
}

export interface Indicador {
  pais_iso3: string;
  indicador_id: string;
  anio: number;
  valor: number | null; // nulo se conserva; nunca 0 por ausencia
  unidad: string;
  fuente_url: string;
  fecha_extraccion: string;
  licencia: string;
}

export interface Sismo {
  id: string;
  magnitude: number;
  time: string; // ISO UTC
  updated: string;
  longitude: number;
  latitude: number;
  depth: number;
  place: string;
  status: string;
  url: string;
}

export type Tipo = "hecho_reportado" | "declaracion" | "inferencia" | "hipotesis";
export type Alcance = "titular_metadatos" | "fila_indicador" | "evento_usgs";

export interface Afirmacion {
  texto: string;
  tipo: Tipo;
  evidence_id: string; // id_noticia | "PAN:FP.CPI.TOTL.ZG:2024" | id USGS
  campo: string; // titulo | descripcion | valor | magnitude…
  alcance: Alcance;
}

export type Componente = "R" | "I" | "U" | "N" | "E";
export interface Componentes {
  R: number;
  I: number;
  U: number;
  N: number;
  E: number;
  explicacion: Record<Componente, string>;
}

export type EstadoEvidencia = "insuficiente" | "parcial" | "suficiente";
export type EstadoRevision = "nuevo" | "en_revision" | "requiere_evidencia" | "aprobado_borrador" | "descartado";
export const ESTADOS_REVISION: EstadoRevision[] = ["nuevo", "en_revision", "requiere_evidencia", "aprobado_borrador", "descartado"];
export type Rango = "bajo" | "medio" | "alto";

export interface Procedencia {
  id: string; // "agencia:EFE" | "medio:TVN" | "primaria:USGS" | "no_verificada:<evento>"
  tipo: "agencia" | "medio" | "primaria" | "no_verificada";
  nombre: string;
  ids_noticia: string[];
}

export interface Contradiccion {
  a: string; // id_noticia
  b: string;
  campo: string;
  detalle: string; // «3 muertos» vs «5 muertos»
}

export interface Contexto {
  indicadores: string[]; // "PAN:NY.GDP.MKTP.KD.ZG:2024"
  sismos: string[]; // ids USGS
}

export interface Evento {
  id: string;
  representante: string; // id_noticia
  ids_noticia: string[];
  procedencias: Procedencia[];
  tema: string;
  tema_confianza: number;
  por_revisar: boolean;
  fecha_original: string | null;
  contexto: Contexto;
  contradicciones: Contradiccion[];
  componentes: Componentes;
  P: number;
  rango: Rango;
  estado_evidencia: EstadoEvidencia;
  no_confiable: boolean; // alguna publicación marcada por inyección
}

export interface Paquete {
  titulo: string;
  enfoque: string;
  brief: Afirmacion[]; // ≤250 palabras en total
  preguntas: string[]; // 3
  verificaciones: string[];
  guion: Afirmacion[]; // 45–60 s
  copy: Afirmacion[]; // ≤80 palabras
  leyenda: string; // «Basado únicamente en titular/metadatos…»
  modo: "extractivo" | "llm";
}

export interface Ficha {
  id_caso: string;
  modalidad: "tvn";
  ids_fuente: string[];
  afirmaciones: Afirmacion[];
  citas: string[];
  puntaje: number;
  componentes: Componentes;
  estado_evidencia: EstadoEvidencia;
  borrador: Paquete | null;
  estado_revision: EstadoRevision;
  persona_revisora: string | null;
  sintetica?: boolean;
}

export interface Manifest {
  version: string;
  fecha_corte_UTC: string;
  consultas: { fuente: string; consulta: string; fecha: string }[];
  cantidades: Record<string, number>;
  licencias: Record<string, string>;
  sha256: Record<string, string>;
  transformaciones: string[];
  discrepancias_pdf: string[];
}

export const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
/** ID estable y corto a partir de una semilla (URL, clave compuesta…). */
export const idDe = (prefijo: string, semilla: string) => `${prefijo}_${sha256(semilla).slice(0, 12)}`;

/** Normaliza una URL para deduplicar: host en minúsculas, sin utm_*, sin fragmento, sin barra final. */
export function normalizarUrl(u: string): string {
  try {
    const x = new URL(u.trim());
    x.hostname = x.hostname.toLowerCase().replace(/^www\./, "");
    x.hash = "";
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) x.searchParams.delete(k);
    if (x.pathname.length > 1 && x.pathname.endsWith("/")) x.pathname = x.pathname.slice(0, -1);
    return x.toString();
  } catch {
    return u.trim();
  }
}
