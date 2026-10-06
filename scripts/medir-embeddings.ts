// ─────────────────────────────────────────────────────────────
// medir-embeddings · tiempos del perfil activo en ESTA máquina (docs/EXPERIMENTO-EMBEDDINGS-2026-10-06.md §4)
//   AGENTETVN_EMB_MODELO=granite HF_HUB_OFFLINE=1 bun scripts/medir-embeddings.ts
//   AGENTETVN_MEDIR_HILOS=2 taskset -c 4,6 …   (aproxima un CT de 2 núcleos: ONNX Runtime fija su propia afinidad
//   e ignora taskset y la cuota de cgroup, así que se le limita el pool de hilos desde aquí, sin tocar el motor)
// Frío = proceso nuevo: cargar el modelo desde ./.cache-modelos + primera consulta. Corpus = las notas de
// noticias-motor.json como pasajes (lotes de 32) con el modelo ya cargado, dos pasadas.
// ─────────────────────────────────────────────────────────────
import { readFileSync } from "fs";

if (process.env.AGENTETVN_MEDIR_HILOS) {
  const hilos = Number(process.env.AGENTETVN_MEDIR_HILOS);
  const { InferenceSession } = await import("onnxruntime-node");
  const crear = InferenceSession.create.bind(InferenceSession) as (...a: unknown[]) => Promise<unknown>;
  (InferenceSession as unknown as { create: unknown }).create = (modelo: unknown, opciones: object = {}) => crear(modelo, { ...opciones, intraOpNumThreads: hilos, interOpNumThreads: 1 });
}
const t0 = performance.now();
const { embeber, MODELO } = await import("../src/lib/motor/embeddings");
const { PERFIL } = await import("../src/lib/motor/perfiles");
const tImport = performance.now();
await embeber(["¿Qué se sabe del Canal de Panamá?"], "query");
const tFrio = performance.now();
const noticias = JSON.parse(readFileSync("data/processed/noticias-motor.json", "utf8")) as { titulo: string; descripcion: string }[];
const textos = noticias.map((n) => `${n.titulo}. ${n.descripcion}`.slice(0, 600));
const pasadas: number[] = [];
for (let k = 0; k < 2; k++) { const a = performance.now(); await embeber(textos, "passage"); pasadas.push(performance.now() - a); }
const q: number[] = [];
for (const c of ["¿Cuál fue la inflación de Panamá?", "sismo en Chiriquí", "tránsito de buques por el Canal", "precio del combustible"]) { const a = performance.now(); await embeber([c], "query"); q.push(performance.now() - a); }
const r = (x: number) => Math.round(x);
console.log(JSON.stringify({ perfil: PERFIL.id, modelo: MODELO, hilos_ort: process.env.AGENTETVN_MEDIR_HILOS ?? "defecto", notas: textos.length, import_ms: r(tImport - t0), frio_carga_mas_consulta_ms: r(tFrio - tImport), corpus_ms: pasadas.map(r), consulta_caliente_ms_mediana: r([...q].sort((a, b) => a - b)[2]), rss_mb: r(process.memoryUsage().rss / 1e6) }));
