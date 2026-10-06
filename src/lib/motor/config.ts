import { readFileSync } from "fs";

export interface Scoring {
  version: string;
  fecha: string;
  pesos: { R: number; I: number; U: number; N: number; E: number };
  R: { geo: number; tema: number; geo_sin_mencion: number };
  I: { prior: Record<string, number>; peso_prior: number; peso_magnitud: number };
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
export const leerScoring = (): Scoring => (scoring ??= JSON.parse(readFileSync("config/scoring-v1.json", "utf8")));
export const leerTemas = (): TemaDef[] => (temas ??= JSON.parse(readFileSync("config/temas.json", "utf8")).temas);
export const TEMAS_AGENDA: string[] = JSON.parse(readFileSync("config/temas.json", "utf8")).agenda;
