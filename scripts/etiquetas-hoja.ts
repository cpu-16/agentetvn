// Genera las hojas de etiquetado humano (data/labels/*.csv) con candidatos propuestos por el motor; la persona corrige y firma.
//   bun scripts/etiquetas-hoja.ts   → data/labels/temas.csv (100 titulares) y data/labels/pares.csv (60 pares)
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { stringify } from "csv-stringify/sync";
import { cargarSnapshot } from "../src/lib/motor/cargar";
import { coseno } from "../src/lib/motor/embeddings";

const snap = cargarSnapshot("data/processed", { forzar: true });
mkdirSync("data/labels", { recursive: true });
const reales = snap.noticias.filter((n) => !n.sintetica);
// temas: muestra estratificada por origen (TVN primero) hasta 100
const muestra = [...reales.filter((n) => n.origen === "tvn_rss"), ...reales.filter((n) => n.origen !== "tvn_rss")].filter((_, i) => i % Math.max(1, Math.floor(reales.length / 100)) === 0).slice(0, 100);
if (!existsSync("data/labels/temas.csv"))
  writeFileSync("data/labels/temas.csv", stringify(muestra.map((n) => ({ id_noticia: n.id_noticia, titulo: n.titulo, medio: n.medio, tema_propuesto: n.tema ?? "", tema: "", revisado_por: "", fecha: "" })), { header: true }));
// pares: 20 con cos alto, 20 medio, 20 bajo (negativos difíciles)
const emb = snap.embeddings!;
const idx = new Map(emb.ids.map((id, i) => [id, i]));
const ids = reales.map((n) => n.id_noticia).filter((i) => idx.has(i));
const pares: { a: string; b: string; cos: number }[] = [];
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pares.push({ a: ids[i], b: ids[j], cos: coseno(emb.vectores[idx.get(ids[i])!], emb.vectores[idx.get(ids[j])!]) });
pares.sort((x, y) => y.cos - x.cos);
const alto = pares.slice(0, 20), medio = pares.filter((p) => p.cos >= 0.84 && p.cos < 0.9).slice(0, 20), bajo = pares.filter((p) => p.cos < 0.84).slice(0, 20);
const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
if (!existsSync("data/labels/pares.csv"))
  writeFileSync("data/labels/pares.csv", stringify([...alto, ...medio, ...bajo].map((p) => ({ a: p.a, titulo_a: porId.get(p.a)!.titulo, b: p.b, titulo_b: porId.get(p.b)!.titulo, coseno: Math.round(p.cos * 1000) / 1000, mismo_evento: "", revisado_por: "", fecha: "" })), { header: true }));
console.log(`hojas en data/labels/: temas.csv (${muestra.length}) y pares.csv (${alto.length + medio.length + bajo.length}). Llenar tema (economia|logistica_canal|turismo|servicios_publicos|eventos_naturales|regulacion|deportes|otro) y mismo_evento (si|no), con revisado_por y fecha.`);
