import type { Componentes } from "./medidor";

export interface EventoResumen {
  id: string; titulo: string; medio: string; tema: string; por_revisar: boolean; P: number; rango: "bajo" | "medio" | "alto";
  componentes: Componentes; estado_evidencia: "insuficiente" | "parcial" | "suficiente"; estado_revision: string;
  procedencias: { id: string; tipo: string; nombre: string; ids_noticia: string[] }[]; publicaciones: number; fecha_original: string | null;
  contradicciones: unknown[]; sintetica?: boolean; no_confiable: boolean; ids_noticia: string[];
}
export interface ResumenCorte { publicaciones: number; eventos: number; medios: number; agencias: number; sinteticas: number; noConfiablesReales: number }
export interface AgendaDatos { corteUTC: string; version: string; resumen: ResumenCorte; eventos: EventoResumen[]; cinco: { evento: EventoResumen; razones: string[]; vacios: string[] }[] }
