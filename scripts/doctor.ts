// ─────────────────────────────────────────────────────────────
// doctor · ¿puede AgenteTVN correr la demo en ESTA máquina, sin internet?
//   bun run doctor   (sale 1 si falta algo obligatorio; el modelo ausente es advertencia: modo léxico)
// ─────────────────────────────────────────────────────────────
import { existsSync, readFileSync } from "fs";
import { isAbsolute, resolve } from "path";

type Estado = "OK" | "FALLA" | "AVISO";
const filas: { estado: Estado; nombre: string; detalle: string }[] = [];
const marca = { OK: "✔", FALLA: "✖", AVISO: "△" };
const r = (estado: Estado, nombre: string, detalle: string) => filas.push({ estado, nombre, detalle });

const major = Number(process.versions.node.split(".")[0]);
r(major >= 20 ? "OK" : "FALLA", "Runtime", `node ${process.versions.node}${process.versions.bun ? ` · bun ${process.versions.bun}` : ""} (mínimo node 20)`);

const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("file:")) r("FALLA", "DATABASE_URL", url ? `«${url}» no es SQLite` : "no definida: cp .env.example .env");
else {
  const cruda = url.slice(5);
  const ruta = isAbsolute(cruda) ? cruda : resolve(process.cwd(), "prisma", cruda);
  r(existsSync(ruta) ? "OK" : "AVISO", "Base de datos", existsSync(ruta) ? ruta : `${ruta} no existe aún → bun run db:push la crea`);
}

const dir = process.env.AGENTETVN_DATOS ?? "data/processed";
try {
  const { cargarSnapshot } = await import("../src/lib/motor/cargar");
  const s = cargarSnapshot(dir, { forzar: true });
  r("OK", "Snapshot", `${s.manifest.version} · corte ${s.manifest.fecha_corte_UTC} · ${s.noticias.length} noticias, ${s.indicadores.length} indicadores, ${s.sismos.length} sismos · SHA-256 verificados · ${s.errores.length} errores separados`);
  r(s.eventos.length ? "OK" : "FALLA", "Motor", s.eventos.length ? `${s.eventos.length} eventos puntuados (eventos.json)` : "falta eventos.json → bun run motor");
  r(s.embeddings ? "OK" : "AVISO", "Embeddings precalculados", s.embeddings ? `${s.embeddings.modelo} · ${s.embeddings.ids.length} vectores` : "sin embeddings.json: la consulta usará BM25");
} catch (e) {
  r("FALLA", "Snapshot", (e as Error).message.slice(0, 160));
}

try {
  const { modeloEnCache, MODELO } = await import("../src/lib/motor/embeddings");
  r(modeloEnCache() ? "OK" : "AVISO", "Modelo local", modeloEnCache() ? `${MODELO} en caché (./.cache-modelos)` : `${MODELO} no está en caché: con internet, bun run modelo:descargar; sin internet, consulta en modo léxico (BM25)`);
} catch (e) {
  r("AVISO", "Modelo local", (e as Error).message.slice(0, 120));
}

const modo = process.env.AGENTETVN_MODO ?? "offline";
const claves = Object.keys(process.env).filter((k) => /^(LLM_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY)$/.test(k) && process.env[k]);
if (modo === "offline") r("OK", "Modo", `offline · cero llamadas de red${claves.length ? " (hay claves en el entorno, pero no se usan)" : ""}`);
else if (!process.env.LLM_BASE_URL) r("FALLA", "Modo", "online sin LLM_BASE_URL: define el endpoint del LLM o usa AGENTETVN_MODO=offline");
else {
  const url = process.env.LLM_BASE_URL.replace(/\/$/, "");
  const vivo = await fetch(`${url}/models`, { signal: AbortSignal.timeout(3000) }).then((x) => x.ok).catch(() => false);
  r(vivo ? "OK" : "AVISO", "Modo", vivo ? `online · LLM de redacción (${process.env.LLM_MODEL ?? "claude-opus-5-5"}) responde en ${url}; si se cae, respaldo extractivo` : `online, pero ${url} no responde: la redacción usará el respaldo extractivo`);
}
r(existsSync(".env.example") && !/=(secret|ntn_|sk-)/.test(readFileSync(".env.example", "utf8")) ? "OK" : "FALLA", "Secretos", ".env.example sin valores; .env ignorado por git");

const ancho = Math.max(...filas.map((f) => f.nombre.length));
for (const f of filas) console.log(`${marca[f.estado]} ${f.nombre.padEnd(ancho)}  ${f.detalle}`);
const fallas = filas.filter((f) => f.estado === "FALLA").length;
console.log(fallas ? `\n${fallas} falla(s): la demo no está lista.` : "\nListo para la demo sin internet.");
process.exit(fallas ? 1 : 0);
