// ─────────────────────────────────────────────────────────────
// notion-sync · sube las páginas de docs/notion/*.md (idempotente por título, ver notion-paginas.ts) y catálogo, casos,
//   pruebas y decisiones a Notion como bases de datos (idempotente por id_estable).
//   NOTION_TOKEN y NOTION_ROOT_PAGE en .env (nunca en el repo). Si fallan, se registra y Jeff carga a mano desde docs/notion/.
//   bun run notion:sync
// ─────────────────────────────────────────────────────────────
import { Client } from "@notionhq/client";
import { existsSync, readFileSync } from "fs";
import { cargarSnapshot } from "../src/lib/motor/cargar";
import { db } from "../src/lib/db";
import { subirPaginas } from "./notion-paginas";

const token = process.env.NOTION_TOKEN;
const root = process.env.NOTION_ROOT_PAGE;
if (!token || !root) {
  console.error("Falta NOTION_TOKEN o NOTION_ROOT_PAGE en .env. Carga manual: docs/notion/*.md");
  process.exit(1);
}
const notion = new Client({ auth: token });
const log = (s: string) => console.log(`[notion] ${s}`);
const txt = (s: string) => ({ rich_text: [{ text: { content: String(s).slice(0, 1900) } }] });
const titulo = (s: string) => ({ title: [{ text: { content: String(s).slice(0, 1900) } }] });
const sel = (s: string) => ({ select: { name: String(s).slice(0, 90) } });
const num = (n: number | null) => ({ number: n });

async function base(nombre: string, props: Record<string, unknown>): Promise<string> {
  const hijos = await notion.blocks.children.list({ block_id: root!, page_size: 100 });
  const existente = hijos.results.find((b) => "type" in b && b.type === "child_database" && (b as { child_database: { title: string } }).child_database.title === nombre);
  if (existente) return existente.id;
  const d = await notion.databases.create({ parent: { page_id: root! }, title: [{ text: { content: nombre } }], properties: { Nombre: { title: {} }, id_estable: { rich_text: {} }, ...props } as never });
  log(`base creada: ${nombre}`);
  return d.id;
}

async function upsert(dbId: string, idEstable: string, props: Record<string, unknown>) {
  const q = await notion.databases.query({ database_id: dbId, filter: { property: "id_estable", rich_text: { equals: idEstable } } });
  const propiedades = { ...props, id_estable: txt(idEstable) } as never;
  if (q.results[0]) await notion.pages.update({ page_id: q.results[0].id, properties: propiedades });
  else await notion.pages.create({ parent: { database_id: dbId }, properties: propiedades });
}

const snap = cargarSnapshot("data/processed", { forzar: true });
let errores = 0;
const intentar = async (nombre: string, fn: () => Promise<void>) => { try { await fn(); log(`${nombre}: ok`); } catch (e) { errores++; log(`${nombre}: ERROR ${(e as Error).message.slice(0, 160)}`); } };

await intentar("Páginas de documentación", () => subirPaginas(notion, root, "docs/notion", log));

await intentar("Catálogo de datos", async () => {
  const id = await base("Catálogo de datos", { Fuente: { select: {} }, URL: { url: {} }, Extracción: { rich_text: {} }, Cobertura: { rich_text: {} }, Licencia: { rich_text: {} }, SHA256: { rich_text: {} }, Registros: { number: {} } });
  const fuentes = JSON.parse(readFileSync(`${snap.dir}/fuentes.json`, "utf8")) as Record<string, { nombre: string; url: string; condiciones: string; cobertura: string }>;
  const archivo: Record<string, string> = { tvn_rss: "noticias.csv", gdelt: "noticias.csv", bancomundial: "indicadores.csv", usgs: "eventos.geojson" };
  for (const [k, f] of Object.entries(fuentes))
    await upsert(id, `fuente:${k}`, { Nombre: titulo(f.nombre), Fuente: sel(k), URL: { url: f.url.replace("<seccion>", "nacionales") }, Extracción: txt(snap.manifest.fecha_corte_UTC), Cobertura: txt(f.cobertura), Licencia: txt(f.condiciones), SHA256: txt(snap.manifest.sha256[archivo[k]] ?? ""), Registros: num(snap.manifest.cantidades[archivo[k]] ?? null) });
});

await intentar("Casos y evidencias", async () => {
  const id = await base("Casos y evidencias", { Tema: { select: {} }, P: { number: {} }, Rango: { select: {} }, Evidencia: { select: {} }, Revisión: { select: {} }, Revisor: { rich_text: {} }, Procedencias: { rich_text: {} }, Citas: { rich_text: {} }, Sintético: { checkbox: {} } });
  const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
  const revisiones = await db.revision.findMany({ orderBy: { createdAt: "asc" } });
  const ultimo = new Map(revisiones.map((r) => [r.eventoId, r]));
  for (const e of snap.eventos.slice(0, 40)) {
    const r = ultimo.get(e.id);
    await upsert(id, `caso:${e.id}`, { Nombre: titulo(porId.get(e.representante)?.titulo ?? e.id), Tema: sel(e.tema), P: num(e.P), Rango: sel(e.rango), Evidencia: sel(e.estado_evidencia), Revisión: sel(r?.estado ?? "nuevo"), Revisor: txt(r?.persona ?? ""), Procedencias: txt(e.procedencias.map((p) => `${p.nombre} (${p.ids_noticia.length})`).join("; ")), Citas: txt([...e.ids_noticia, ...e.contexto.indicadores].join(", ")), Sintético: { checkbox: e.ids_noticia.some((i) => porId.get(i)?.sintetica) } });
  }
});

await intentar("Pruebas y métricas", async () => {
  const id = await base("Pruebas y métricas", { Estado: { select: {} }, Resultado: { rich_text: {} }, Corrección: { rich_text: {} }, Commit: { rich_text: {} } });
  if (existsSync(`${snap.dir}/pruebas.json`)) {
    const pruebas = JSON.parse(readFileSync(`${snap.dir}/pruebas.json`, "utf8")) as { id: string; nombre: string; estado: string; resultado: string; correccion?: string; commit?: string }[];
    for (const p of pruebas) await upsert(id, `prueba:${p.id}`, { Nombre: titulo(`${p.id} · ${p.nombre}`), Estado: sel(p.estado), Resultado: txt(p.resultado), Corrección: txt(p.correccion ?? ""), Commit: txt(p.commit ?? "") });
  }
});

await intentar("Decisiones", async () => {
  const id = await base("Decisiones", { Alternativa: { rich_text: {} }, Motivo: { rich_text: {} }, Responsable: { rich_text: {} }, Fecha: { date: {} } });
  for (const d of await db.decision.findMany()) await upsert(id, `decision:${d.id}`, { Nombre: titulo(d.titulo), Alternativa: txt(d.alternativa), Motivo: txt(d.motivo), Responsable: txt(d.persona), Fecha: { date: { start: d.createdAt.toISOString() } } });
});

log(errores ? `${errores} bloque(s) con error: cargar esos a mano desde docs/notion/` : "sincronización completa");
process.exit(errores ? 2 : 0);
