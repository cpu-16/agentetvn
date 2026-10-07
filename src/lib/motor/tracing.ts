// Server-only: imports SDK APIs; never import into a client component.
import { Client } from "langsmith";
import { getCurrentRunTree, traceable } from "langsmith/traceable";

const ENDPOINT = "https://api.smith.langchain.com";
const ENUMS: Record<string, string[]> = {
  modalidad: ["tvn", "banca"], origen: ["texto", "voz", "desarrollo"],
  modo: ["bm25", "embeddings", "extractivo", "llm"], cache: ["hit", "miss", "shared"],
  resultado: ["ok", "application_error", "fallback", "abstencion"],
};
const COUNTS = new Set(["ms", "afirmaciones", "evidencias", "descartadas", "tokens", "fuentes", "total_ms", "retrieval_ms"]);
export function sanitizarTraza(values: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (ENUMS[key]?.includes(String(value))) out[key] = value;
    else if (COUNTS.has(key) && typeof value === "number" && Number.isFinite(value) && value >= 0) out[key] = value;
    else if (key === "abstener" && typeof value === "boolean") out[key] = value;
    else if (["commit", "snapshot"].includes(key) && typeof value === "string" && /^[a-f0-9]{7,64}$/.test(value)) out[key] = value;
  }
  return out;
}
export function tracingActivo() {
  return process.env.AGENTETVN_MODO === "online" && process.env.AGENTETVN_TRACING === "on" &&
    process.env.AGENTETVN_TRACE_APPROVED === "1" && !!process.env.LANGSMITH_API_KEY &&
    (!process.env.LANGSMITH_ENDPOINT || process.env.LANGSMITH_ENDPOINT === ENDPOINT);
}
let client: Client | undefined;
let testClient: Client | undefined;
let pendingFlush: Promise<boolean> | undefined;
const NAMES = new Set(["consulta", "recuperacion", "paquete", "llm", "validacion-paquete", "validacion-respuesta", "boletin-bancario"]);
/** SDK-generated runtime, events, serialized data and endpoint overrides are never transported. */
function transporteSeguro(value: unknown) {
  const run = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ["id", "parent_run_id", "trace_id"]) {
    if (typeof run[key] === "string" && /^[a-f0-9-]{36}$/.test(run[key])) out[key] = run[key];
  }
  for (const key of ["start_time", "end_time"]) {
    if (typeof run[key] === "number" && Number.isFinite(run[key])) out[key] = run[key];
  }
  if (typeof run.dotted_order === "string" && /^[0-9TZ.a-f-]+$/.test(run.dotted_order)) out.dotted_order = run.dotted_order;
  if ("name" in run) out.name = NAMES.has(String(run.name)) ? run.name : "operacion";
  if (["chain", "retriever", "llm"].includes(String(run.run_type))) out.run_type = run.run_type;
  if ("session_name" in run) out.session_name = "AgenteTVN";
  if ("inputs" in run) out.inputs = {};
  if ("outputs" in run) out.outputs = sanitizarTraza((run.outputs ?? {}) as Record<string, unknown>);
  const extra = run.extra as { metadata?: Record<string, unknown> } | undefined;
  out.extra = { metadata: sanitizarTraza(extra?.metadata ?? {}) };
  out.tags = ["prompt-rules-v1", "evaluator-dev-v1"];
  return out;
}
function protegerCliente(value: Client) {
  for (const key of ["createRun", "updateRun", "flush"] as const) {
    const original = value[key].bind(value);
    Object.assign(value, { [key]: async (...args: unknown[]) => {
      try {
        const safe = key === "createRun" ? [transporteSeguro(args[0])]
          : key === "updateRun" ? [args[0], transporteSeguro(args[1])] : [];
        return await (original as (...xs: unknown[]) => Promise<unknown>)(...safe);
      }
      catch { throw new Error("Tracing transport unavailable"); }
    } });
  }
  return value;
}
function cliente() {
  if (testClient) return testClient;
  return client ??= protegerCliente(new Client({ apiKey: process.env.LANGSMITH_API_KEY, apiUrl: ENDPOINT,
    tracingMode: "langsmith", hideInputs: sanitizarTraza, hideOutputs: sanitizarTraza, hideMetadata: sanitizarTraza,
    anonymizer: sanitizarTraza, omitTracedRuntimeInfo: true, disablePromptCache: true,
    timeout_ms: 500, callerOptions: { maxRetries: 0 }, manualFlushMode: true,
    maxIngestMemoryBytes: 1_000_000, blockOnRootRunFinalization: false, debug: false }));
}
export function resumenTraza(value: unknown): Record<string, unknown> {
  const r = value as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return {};
  const length = (v: unknown) => Array.isArray(v) ? v.length : 0;
  return sanitizarTraza({ modo: r.modo, abstener: r.abstener, ms: r.ms,
    afirmaciones: length(r.afirmaciones ?? r.brief ?? r.frases), evidencias: length(r.evidencias),
    resultado: r.abstener ? "abstencion" : "ok" });
}
export async function conTraza<T>(name: string, metadata: Record<string, unknown>, fn: () => Promise<T>, runType: "chain" | "retriever" | "llm" = "chain"): Promise<T> {
  if (!tracingActivo()) return fn();
  let root = true;
  try { root = !getCurrentRunTree(); } catch { /* no parent context */ }
  let ran = false, failed = false, value: T, error: unknown;
  const execute = async () => {
    ran = true;
    try { value = await fn(); return resumenTraza(value); }
    catch (e) { failed = true; error = e; return { resultado: "application_error" }; }
  };
  try {
    await traceable(execute, { name, run_type: runType, client: cliente(), tracingEnabled: true,
      replicas: [], project_name: "AgenteTVN",
      metadata: sanitizarTraza({ ...metadata, commit: process.env.AGENTETVN_COMMIT }),
      tags: ["prompt-rules-v1", "evaluator-dev-v1"], processInputs: () => ({}), processOutputs: sanitizarTraza })();
  } catch { /* Observability cannot fail or repeat the application operation. */ }
  if (root) void flushTracing();
  if (!ran) return fn();
  if (failed) throw error;
  return value!;
}
export async function flushTracing(timeoutMs = 500): Promise<boolean> {
  if (!tracingActivo() || (!client && !testClient)) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const pending = pendingFlush ??= cliente().flush().then(() => true).catch(() => false)
      .finally(() => { pendingFlush = undefined; });
    return await Promise.race([pending,
      new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), Math.min(1000, Math.max(1, timeoutMs))); })]);
  } finally { if (timer) clearTimeout(timer); }
}
export function _clienteTrazaPruebas(value?: Client) {
  if (process.env.NODE_ENV !== "test") throw new Error("Test client only available in tests");
  pendingFlush = undefined;
  testClient = value ? protegerCliente(value) : undefined;
}

export function actualizarTraza(metadata: Record<string, unknown>) {
  if (!tracingActivo()) return;
  try { const run = getCurrentRunTree(); run.metadata = { ...run.metadata, ...sanitizarTraza(metadata) }; } catch { /* no current span */ }
}
