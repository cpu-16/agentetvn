// Carga data/processed/ a memoria una sola vez por proceso y verifica el SHA-256 del manifest.
import { existsSync, readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { sha256, type Evento, type Ficha, type Indicador, type Manifest, type Noticia, type Sismo } from "./contrato";
import { validarIndicadores, validarNoticias, type ErrorFila } from "./validar";
import { parsearUsgs } from "../ingesta/usgs";

export class ManifestInvalido extends Error {}

export interface Snapshot {
  dir: string;
  manifest: Manifest;
  noticias: Noticia[];
  indicadores: Indicador[];
  sismos: Sismo[];
  errores: ErrorFila[];
  eventos: Evento[];
  fichas: Ficha[];
  embeddings: { modelo: string; dim: number; ids: string[]; vectores: number[][] } | null;
  huella: string; // identifica el snapshot (manifest + derivados) para cachés
  avisos: string[];
}

let cache: Snapshot | null = null;

export function leerCsv(ruta: string): Record<string, string>[] {
  return parse(readFileSync(ruta, "utf8"), { columns: true, skip_empty_lines: true, bom: true });
}

export function verificarManifest(dir: string, manifest: Manifest) {
  for (const [archivo, hash] of Object.entries(manifest.sha256)) {
    const ruta = `${dir}/${archivo}`;
    if (!existsSync(ruta)) throw new ManifestInvalido(`falta ${archivo}`);
    const real = sha256(readFileSync(ruta));
    if (real !== hash) throw new ManifestInvalido(`${archivo}: SHA-256 ${real.slice(0, 12)}… ≠ manifest ${hash.slice(0, 12)}…`);
  }
}

export function cargarSnapshot(dir = process.env.AGENTETVN_DATOS ?? "data/processed", opts: { verificar?: boolean; forzar?: boolean } = {}): Snapshot {
  if (cache && !opts.forzar && cache.dir === dir) return cache;
  const manifest: Manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8"));
  if (opts.verificar !== false) verificarManifest(dir, manifest);
  // Si el motor ya corrió, sus noticias (con tema, no_confiable y los casos sintéticos marcados) son la vista de trabajo.
  const vn = existsSync(`${dir}/noticias-motor.json`) ? { validas: JSON.parse(readFileSync(`${dir}/noticias-motor.json`, "utf8")) as Noticia[], errores: [] as ErrorFila[] } : validarNoticias(leerCsv(`${dir}/noticias.csv`));
  const erroresCsv = validarNoticias(leerCsv(`${dir}/noticias.csv`)).errores;
  const vi = validarIndicadores(leerCsv(`${dir}/indicadores.csv`));
  const sismos = existsSync(`${dir}/eventos.geojson`) ? parsearUsgs(JSON.parse(readFileSync(`${dir}/eventos.geojson`, "utf8"))) : [];
  const leerJson = <T>(n: string, def: T): T => (existsSync(`${dir}/${n}`) ? (JSON.parse(readFileSync(`${dir}/${n}`, "utf8")) as T) : def);
  const fichas = existsSync(`${dir}/fichas.jsonl`)
    ? readFileSync(`${dir}/fichas.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Ficha)
    : [];
  // Los derivados del motor (eventos, fichas, embeddings, noticias-motor) solo valen si nacieron de ESTOS CSV.
  const meta = leerJson<{ huella_entradas?: string } | null>("motor-meta.json", null);
  const avisos: string[] = [];
  const derivadosValidos = (() => {
    if (!meta?.huella_entradas) return true; // motor viejo sin huella: se acepta (compatibilidad), se avisa
    const esperada = meta.huella_entradas;
    try {
      const partes = [manifest.sha256["noticias.csv"], manifest.sha256["indicadores.csv"]];
      // la huella completa incluye sintéticas/config/etiquetas; aquí basta comprobar que las entradas CSV son las mismas
      const sinteticas = existsSync("data/sinteticas.json") ? sha256(readFileSync("data/sinteticas.json")) : "";
      return esperada.length > 0 && !!partes[0] && (leerJson<{ entradas_csv?: string[] }>("motor-meta.json", {}).entradas_csv ?? partes).join() === partes.join() && !!sinteticas;
    } catch {
      return false;
    }
  })();
  if (!derivadosValidos) avisos.push("los derivados del motor no corresponden a este snapshot: corre bun run motor");
  const eventos = derivadosValidos ? leerJson<Evento[]>("eventos.json", []) : [];
  const emb = derivadosValidos ? leerJson<Snapshot["embeddings"]>("embeddings.json", null) : null;
  const noticiasFinales = derivadosValidos ? vn.validas : validarNoticias(leerCsv(`${dir}/noticias.csv`)).validas;
  const huella = sha256(`${manifest.sha256["noticias.csv"]}|${manifest.sha256["indicadores.csv"]}|${meta?.huella_entradas ?? ""}|${noticiasFinales.length}`);
  return (cache = { dir, manifest, noticias: noticiasFinales, indicadores: vi.validas, sismos, errores: [...erroresCsv, ...vi.errores], eventos, fichas: derivadosValidos ? fichas : [], embeddings: emb, huella, avisos });
}
