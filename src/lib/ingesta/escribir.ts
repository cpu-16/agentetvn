import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { stringify } from "csv-stringify/sync";
import { sha256, type Manifest } from "../motor/contrato";

export const COLUMNAS_NOTICIAS = ["id_noticia", "titulo", "url", "medio", "idioma", "fecha_publicacion", "fecha_deteccion", "fecha_extraccion", "tema", "origen", "alcance_texto", "descripcion", "agencia", "sintetica", "no_confiable", "seccion"];
export const COLUMNAS_INDICADORES = ["pais_iso3", "indicador_id", "anio", "valor", "unidad", "fuente_url", "fecha_extraccion", "licencia"];

export function escribirCsv(ruta: string, filas: Record<string, unknown>[], columnas: string[]) {
  const csv = stringify(filas, { header: true, columns: columnas, cast: { boolean: (b) => (b ? "true" : "false") } });
  writeFileSync(ruta, csv, "utf8");
}

export function escribirJson(ruta: string, obj: unknown) {
  mkdirSync(ruta.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(ruta, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

export function hashArchivo(ruta: string) {
  return sha256(readFileSync(ruta));
}

export function escribirManifest(ruta: string, m: Manifest) {
  escribirJson(ruta, m);
}
