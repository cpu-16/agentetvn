import { readFileSync } from "fs";

export interface Scoring {
  version: string;
  fecha: string;
  pesos: { R: number; I: number; U: number; N: number; E: number };
  R: { geo: number; tema: number };
  E: { trazable: number; procedencia: number; conflicto: number };
  U: { vida_media_h: number };
  N: { umbral_mismo_evento: number; jaccard_titular: number; ventana_dias: number };
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
