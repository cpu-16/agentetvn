import { readFileSync } from "fs";
import { PERFIL } from "./perfiles";

export interface Scoring {
  version: string;
  fecha: string;
  pesos: { R: number; I: number; U: number; N: number; E: number };
  R: { geo: number; tema: number; geo_sin_mencion: number };
  I: { prior: Record<string, number>; peso_prior: number; peso_alcance: number; peso_magnitud: number; alcance: Record<"nacional" | "sectorial" | "local" | "comercial" | "desconocido", number> };
  E: { primaria: number; independencia: number; identificable: number; umbral_insuficiente: number };
  U: { tabla_horas: [number, number][]; mas_antigua: number; sin_fecha_publicacion: number };
  N: { umbral_mismo_evento: number; jaccard_titular: number; ventana_dias: number; segunda_ola: number };
  temas: { umbral: number; margen: number };
  consulta: { umbral_coseno: number; k: number };
  rangos: { bajo: [number, number]; medio: [number, number]; alto: [number, number] };
  justificacion: string;
}
export interface TemaDef { id: string; nombre: string; descripcion: string; palabras: string[] }

let scoring: Scoring | null = null;
let temas: TemaDef[] | null = null;
/** Superpone al JSON (escala del e5) solo los cuatro umbrales de similitud del perfil de embeddings activo; e5 no trae: rige el JSON. */
function conUmbralesDelPerfil(s: Scoring): Scoring {
  const u = PERFIL.umbrales;
  if (!u) return s;
  return { ...s, N: { ...s.N, umbral_mismo_evento: u.umbral_mismo_evento }, temas: { umbral: u.umbral_tema, margen: u.margen_tema }, consulta: { ...s.consulta, umbral_coseno: u.umbral_coseno } };
}
export const leerScoring = (): Scoring => (scoring ??= conUmbralesDelPerfil(JSON.parse(readFileSync("config/scoring-v1.json", "utf8"))));
export const leerTemas = (): TemaDef[] => (temas ??= JSON.parse(readFileSync("config/temas.json", "utf8")).temas);
export const TEMAS_AGENDA: string[] = JSON.parse(readFileSync("config/temas.json", "utf8")).agenda;
