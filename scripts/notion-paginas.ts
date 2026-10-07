// ─────────────────────────────────────────────────────────────
// notion-paginas · sube docs/notion/*.md como páginas hijas de NOTION_ROOT_PAGE, en orden de archivo.
//   Idempotente: si ya hay una página hija con el mismo título (o el mismo inicio antes de « · », porque los títulos
//   de catálogo y casos llevan la fecha de corte), se le cambia el título, se borran sus bloques y se reescriben.
//   Lo llama scripts/notion-sync.ts; suelto: NOTION_TOKEN=… NOTION_ROOT_PAGE=… bun scripts/notion-paginas.ts
//   Markdown soportado: # ## ###, párrafos, - y 1. (planos), > cita, tablas, ``` código, ---, **negrita**, `código`,
//   [texto](url) y URLs sueltas. Las imágenes locales quedan como párrafo con el texto alternativo y la ruta.
// ─────────────────────────────────────────────────────────────
import { Client } from "@notionhq/client";
import { readdirSync, readFileSync } from "fs";

type RT = { type: "text"; text: { content: string; link?: { url: string } }; annotations?: { bold?: boolean; code?: boolean } };
type Bloque = { type: string; [k: string]: unknown };

const LIM = 2000; // caracteres por rich_text
const esUrl = (u: string) => /^https?:\/\//.test(u);

// Texto en línea → rich_text (partido en trozos de ≤ 2000 caracteres).
export function enLinea(s: string, extra: RT["annotations"] = {}): RT[] {
  const out: RT[] = [];
  const poner = (t: string, ann: RT["annotations"] = {}, url?: string) => {
    for (let k = 0; k < t.length; k += LIM) {
      const a = { ...extra, ...ann };
      out.push({ type: "text", text: { content: t.slice(k, k + LIM), ...(url ? { link: { url } } : {}) }, ...(Object.keys(a).length ? { annotations: a } : {}) });
    }
  };
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()\]]*[^\s<>()\].,;:!?»"'])/g;
  let i = 0;
  for (const m of s.matchAll(re)) {
    poner(s.slice(i, m.index));
    if (m[1] !== undefined) out.push(...enLinea(m[1], { ...extra, bold: true }));
    else if (m[2] !== undefined) poner(m[2], { code: true });
    else if (m[3] !== undefined) poner(esUrl(m[4]) ? m[3] : `${m[3]} (${m[4]})`, {}, esUrl(m[4]) ? m[4] : undefined);
    else poner(m[5], {}, m[5]);
    i = m.index! + m[0].length;
  }
  poner(s.slice(i));
  return out;
}

// Un bloque de texto; si pasa de 100 rich_text, se parte en varios bloques del mismo tipo.
const deTexto = (tipo: string, rt: RT[], extra: Record<string, unknown> = {}): Bloque[] => {
  const out: Bloque[] = [];
  for (let k = 0; k < Math.max(rt.length, 1); k += 100) out.push({ type: tipo, [tipo]: { rich_text: rt.slice(k, k + 100), ...extra } });
  return out;
};

const LENGUAJES: Record<string, string> = { ts: "typescript", typescript: "typescript", js: "javascript", javascript: "javascript", json: "json", bash: "bash", sh: "shell", shell: "shell", py: "python", python: "python", sql: "sql", yaml: "yaml", yml: "yaml", md: "markdown", markdown: "markdown", html: "html", css: "css", diff: "diff" };

function tabla(filas: string[]): Bloque[] {
  const celdas = (f: string) => f.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
  const rows = filas.map(celdas);
  const conCabecera = rows.length > 1 && rows[1].every((c) => /^:?-+:?$/.test(c));
  const cab = conCabecera ? rows[0] : null;
  const cuerpo = conCabecera ? rows.slice(2) : rows;
  const ancho = Math.max(...rows.map((r) => r.length));
  const fila = (r: string[]) => ({ type: "table_row", table_row: { cells: Array.from({ length: ancho }, (_, k) => enLinea(r[k] ?? "")) } });
  const porTabla = cab ? 99 : 100; // máximo 100 filas por tabla: se parte repitiendo la cabecera
  const out: Bloque[] = [];
  for (let k = 0; k === 0 || k < cuerpo.length; k += porTabla)
    out.push({ type: "table", table: { table_width: ancho, has_column_header: !!cab, has_row_header: false, children: [...(cab ? [cab] : []), ...cuerpo.slice(k, k + porTabla)].map(fila) } });
  return out;
}

// Markdown → { título del primer «# », bloques de Notion }.
export function aBloques(md: string): { titulo: string; bloques: Bloque[] } {
  const L = md.replace(/\r/g, "").split("\n");
  const bloques: Bloque[] = [];
  let titulo = "";
  let parrafo: string[] = [];
  const cerrar = () => { if (parrafo.length) bloques.push(...deTexto("paragraph", enLinea(parrafo.join("\n")))); parrafo = []; };
  for (let i = 0; i < L.length; ) {
    const l = L[i];
    let m: RegExpExecArray | null;
    if ((m = /^\s*```(\w*)/.exec(l))) {
      cerrar();
      const cuerpo: string[] = [];
      for (i++; i < L.length && !/^\s*```/.test(L[i]); i++) cuerpo.push(L[i]);
      i++;
      const t = cuerpo.join("\n");
      const rt: RT[] = [];
      for (let k = 0; k < t.length; k += LIM) rt.push({ type: "text", text: { content: t.slice(k, k + LIM) } });
      bloques.push(...deTexto("code", rt, { language: LENGUAJES[m[1].toLowerCase()] ?? "plain text" }));
      continue;
    }
    if (!l.trim()) { cerrar(); i++; continue; }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) {
      cerrar(); i++;
      if (m[1].length === 1 && !titulo) { titulo = m[2].trim(); continue; }
      bloques.push(...deTexto(`heading_${Math.min(m[1].length, 3)}`, enLinea(m[2].trim())));
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { cerrar(); bloques.push({ type: "divider", divider: {} }); i++; continue; }
    if (/^\s*\|/.test(l)) {
      cerrar();
      const filas: string[] = [];
      while (i < L.length && /^\s*\|/.test(L[i])) filas.push(L[i++]);
      bloques.push(...tabla(filas));
      continue;
    }
    if ((m = /^\s*!\[([^\]]*)\]\(([^)\s]+)[^)]*\)\s*$/.exec(l))) {
      cerrar(); i++;
      if (esUrl(m[2])) bloques.push({ type: "image", image: { type: "external", external: { url: m[2] }, caption: enLinea(m[1]) } });
      else bloques.push(...deTexto("paragraph", [...enLinea(`Imagen: ${m[1] || "(sin texto alternativo)"} — `), { type: "text", text: { content: m[2] }, annotations: { code: true } }]));
      continue;
    }
    if ((m = /^>\s?(.*)$/.exec(l))) {
      cerrar();
      const citas: string[] = [];
      while (i < L.length && (m = /^>\s?(.*)$/.exec(L[i]))) { citas.push(m[1]); i++; }
      bloques.push(...deTexto("quote", enLinea(citas.join("\n"))));
      continue;
    }
    if ((m = /^\s*[-*+]\s+(.*)$/.exec(l))) { cerrar(); bloques.push(...deTexto("bulleted_list_item", enLinea(m[1]))); i++; continue; }
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(l))) { cerrar(); bloques.push(...deTexto("numbered_list_item", enLinea(m[1]))); i++; continue; }
    parrafo.push(l.trim());
    i++;
  }
  cerrar();
  return { titulo, bloques };
}

// ── API ──────────────────────────────────────────────────────
// Reintento con espera exponencial para 429 (rate_limited), 409 (conflict) y 5xx.
async function r<T>(fn: () => Promise<T>, intentos = 6): Promise<T> {
  for (let k = 0; ; k++) {
    try { return await fn(); } catch (e) {
      const st = (e as { status?: number }).status ?? 0;
      if (k >= intentos || !(st === 429 || st === 409 || st >= 500)) throw e;
      await new Promise((ok) => setTimeout(ok, 1000 * 2 ** k));
    }
  }
}

type Hijo = { id: string; type: string; child_page?: { title: string } };
async function hijos(notion: Client, id: string): Promise<Hijo[]> {
  const out: Hijo[] = [];
  let cursor: string | undefined;
  do {
    const p = await r(() => notion.blocks.children.list({ block_id: id, page_size: 100, start_cursor: cursor }));
    out.push(...(p.results as Hijo[]));
    cursor = p.has_more ? (p.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

// Máximo 100 bloques por llamada y ~1 000 en total contando las filas de las tablas.
async function escribir(notion: Client, id: string, bloques: Bloque[]) {
  let lote: Bloque[] = [];
  let peso = 0;
  const enviar = async () => { if (lote.length) await r(() => notion.blocks.children.append({ block_id: id, children: lote as never })); lote = []; peso = 0; };
  for (const b of bloques) {
    const w = 1 + ((b.table as { children?: unknown[] } | undefined)?.children?.length ?? 0);
    if (lote.length === 100 || peso + w > 900) await enviar();
    lote.push(b);
    peso += w;
  }
  await enviar();
}

export async function subirPaginas(notion: Client, root: string, dir = "docs/notion", log: (s: string) => void = console.log) {
  const archivos = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  const existentes = (await hijos(notion, root)).filter((b) => b.type === "child_page");
  const raiz = (t: string) => t.split(" · ")[0].trim();
  const usadas = new Set<string>();
  for (const f of archivos) {
    const { titulo, bloques } = aBloques(readFileSync(`${dir}/${f}`, "utf8"));
    const t = (titulo || f.replace(/\.md$/, "")).slice(0, LIM);
    const libres = existentes.filter((p) => !usadas.has(p.id));
    const previa = libres.find((p) => p.child_page!.title === t) ?? libres.find((p) => raiz(p.child_page!.title) === raiz(t));
    const prop = { title: { title: [{ text: { content: t } }] } };
    let id: string;
    if (previa) {
      id = previa.id;
      usadas.add(id);
      if (previa.child_page!.title !== t) await r(() => notion.pages.update({ page_id: id, properties: prop }));
      for (const b of await hijos(notion, id)) await r(() => notion.blocks.delete({ block_id: b.id }));
    } else {
      id = (await r(() => notion.pages.create({ parent: { page_id: root }, properties: prop }))).id;
    }
    await escribir(notion, id, bloques);
    log(`página ${previa ? "actualizada" : "creada"}: ${t} (${bloques.length} bloques)`);
  }
}

if (import.meta.main) {
  const token = process.env.NOTION_TOKEN;
  const root = process.env.NOTION_ROOT_PAGE;
  if (!token || !root) { console.error("Falta NOTION_TOKEN o NOTION_ROOT_PAGE"); process.exit(1); }
  await subirPaginas(new Client({ auth: token }), root, "docs/notion", (s) => console.log(`[notion] ${s}`));
}
