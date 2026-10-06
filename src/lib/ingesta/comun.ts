import { readFileSync } from "fs";
import { idDe, normalizarUrl, type Noticia } from "../motor/contrato";

const AGENCIAS: { nombre: string; patrones: RegExp[] }[] = (JSON.parse(readFileSync("config/agencias.json", "utf8")).agencias as { nombre: string; patrones: string[] }[]).map((a) => ({
  nombre: a.nombre,
  patrones: a.patrones.map((p) => new RegExp(p)),
}));

/** Agencia atribuida en titular/descripción (EFE, AFP…), o null. */
export function detectarAgencia(texto: string): string | null {
  for (const a of AGENCIAS) if (a.patrones.some((p) => p.test(texto))) return a.nombre;
  return null;
}

export function aISO(fecha: string | number | Date | null | undefined): string | null {
  if (fecha === null || fecha === undefined || fecha === "") return null;
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** seendate de GDELT: 20261001T233000Z → ISO */
export function gdeltFecha(s: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s ?? "");
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : null;
}

export function nuevaNoticia(p: Omit<Noticia, "id_noticia" | "alcance_texto" | "agencia" | "sintetica" | "no_confiable" | "tema"> & { sintetica?: boolean }): Noticia {
  const url = normalizarUrl(p.url);
  return {
    ...p,
    url,
    id_noticia: idDe("n", url),
    tema: null,
    alcance_texto: "titular_metadatos",
    agencia: detectarAgencia(`${p.titulo} ${p.descripcion}`),
    sintetica: p.sintetica ?? false,
    no_confiable: false,
  };
}

/** Deduplica por URL normalizada; conserva la primera (y registra cuántas se excluyeron). */
export function dedup(noticias: Noticia[]): { unicas: Noticia[]; excluidas: number } {
  const vistas = new Map<string, Noticia>();
  for (const n of noticias) if (!vistas.has(n.url)) vistas.set(n.url, n);
  return { unicas: [...vistas.values()], excluidas: noticias.length - vistas.size };
}

export const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson<T>(url: string, intentos = 3): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "AgenteTVN/0.1 (hackIAthon Panamá; contacto: gilberto@ciberpty.com)" } });
      const texto = await r.text();
      if (r.status === 429) {
        await dormir(20000); // GDELT: esperar antes de reintentar
        throw new Error(`HTTP 429: ${texto.slice(0, 80)}`);
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${texto.slice(0, 120)}`);
      return JSON.parse(texto) as T;
    } catch (e) {
      ultimo = e;
      await dormir(3000 * (i + 1));
    }
  }
  throw ultimo;
}
