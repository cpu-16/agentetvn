// Server-only: imports SDK APIs; never import into a client component.
import { AsyncLocalStorage } from "node:async_hooks";
import { Client } from "langsmith";
import { getCurrentRunTree, traceable } from "langsmith/traceable";

const ENDPOINT = "https://api.smith.langchain.com";
const ENUMS: Record<string, string[]> = {
  modalidad: ["tvn", "banca"], origen: ["texto", "voz", "desarrollo"],
  modo: ["bm25", "embeddings", "extractivo", "llm"], cache: ["hit", "miss", "shared"],
  resultado: ["ok", "application_error", "fallback", "abstencion"],
};
const COUNTS = new Set(["ms", "afirmaciones", "evidencias", "descartadas", "tokens", "fuentes", "total_ms", "retrieval_ms", "ls_run_depth", "checks_total", "checks_passed", "citation_total", "citation_existing", "citation_supported", "tests_passed", "tests_failed", "cases_total"]);
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
const experimentContext = new AsyncLocalStorage<{ client: Client; projectName: string }>();
let client: Client | undefined;
let testClient: Client | undefined;
let pendingFlush: Promise<boolean> | undefined;
const NAMES = new Set(["consulta", "recuperacion", "paquete", "llm", "validacion-paquete", "validacion-respuesta", "boletin-bancario", "evaluacion-desarrollo", "enrutamiento-desarrollo", "agenda", "indicador", "agrupacion", "pruebas-desarrollo", "validacion-evidencia", "validacion-evaluacion", "vectorizacion"]);
/** SDK-generated runtime, events, serialized data and endpoint overrides are never transported. */
function transporteSeguro(value: unknown, projectName = "AgenteTVN", allowReference = false) {
  const run = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ["id", "parent_run_id", "trace_id", ...(allowReference ? ["reference_example_id"] : [])]) {
    if (typeof run[key] === "string" && /^[a-f0-9-]{36}$/.test(run[key])) out[key] = run[key];
  }
  for (const key of ["start_time", "end_time"]) {
    if (typeof run[key] === "number" && Number.isFinite(run[key])) out[key] = run[key];
  }
  if (typeof run.dotted_order === "string" && /^[0-9TZ.a-f-]+$/.test(run.dotted_order)) out.dotted_order = run.dotted_order;
  if ("name" in run) out.name = NAMES.has(String(run.name)) ? run.name : "operacion";
  if (["chain", "retriever", "llm"].includes(String(run.run_type))) out.run_type = run.run_type;
  if ("session_name" in run) out.session_name = projectName;
  if ("inputs" in run) out.inputs = {};
  if ("outputs" in run) out.outputs = sanitizarTraza((run.outputs ?? {}) as Record<string, unknown>);
  const extra = run.extra as { metadata?: Record<string, unknown> } | undefined;
  out.extra = { metadata: sanitizarTraza(extra?.metadata ?? {}) };
  out.tags = ["prompt-rules-v1", "evaluator-dev-v1"];
  return out;
}
function protegerCliente(value: Client, projectName = "AgenteTVN", allowReference = false) {
  for (const key of ["createRun", "updateRun", "flush"] as const) {
    const original = value[key].bind(value);
    Object.assign(value, { [key]: async (...args: unknown[]) => {
      try {
        const safe = key === "createRun" ? [transporteSeguro(args[0], projectName, allowReference)]
          : key === "updateRun" ? [args[0], transporteSeguro(args[1], projectName, allowReference)] : [];
        return await (original as (...xs: unknown[]) => Promise<unknown>)(...safe);
      }
      catch { throw new Error("Tracing transport unavailable"); }
    } });
  }
  return value;
}
function cliente() {
  const experiment = experimentContext.getStore();
  if (experiment) return experiment.client;
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
  const length = (v: unknown) => typeof v === "number" ? v : Array.isArray(v) ? v.length : 0;
  return sanitizarTraza({ ...sanitizarTraza(r), modo: r.modo, abstener: r.abstener, ms: r.ms,
    afirmaciones: length(r.afirmaciones ?? r.hechos ?? r.brief ?? r.frases), evidencias: r.evidencias ? length(r.evidencias) : new Set([r.hechos, r.brief, r.guion, r.copy].flatMap(v => Array.isArray(v) ? v.filter(a => a && typeof a.evidence_id === "string").map(a => a.evidence_id) : [])).size,
    ...(typeof r.total === "number" ? { citation_total: r.total, citation_existing: r.existing, citation_supported: r.supportedByFieldContract } : {}),
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
      replicas: [], project_name: experimentContext.getStore()?.projectName ?? "AgenteTVN",
      metadata: sanitizarTraza({ ...metadata, commit: process.env.AGENTETVN_COMMIT }),
      tags: ["prompt-rules-v1", "evaluator-dev-v1"], processInputs: () => ({}), processOutputs: sanitizarTraza })();
  } catch { /* Observability cannot fail or repeat the application operation. */ }
  if (root) void flushTracing();
  if (!ran) return fn();
  if (failed) throw error;
  return value!;
}
export async function flushTracing(timeoutMs = 500): Promise<boolean> {
  if (!tracingActivo() || (!client && !testClient && !experimentContext.getStore())) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const pending = pendingFlush ??= cliente().flush().then(() => true).catch(() => false)
      .finally(() => { pendingFlush = undefined; });
    return await Promise.race([pending,
      new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), Math.min(1000, Math.max(1, timeoutMs))); })]);
  } finally { if (timer) clearTimeout(timer); }
}
export function _clienteTrazaPruebas(value?: Client, projectName = "AgenteTVN") {
  if (process.env.NODE_ENV !== "test") throw new Error("Test client only available in tests");
  pendingFlush = undefined;
  if (projectName !== "AgenteTVN" && !/^AgenteTVN-dev-[a-f0-9]{12}-[0-9T]+$/.test(projectName)) throw new Error("Invalid development project");
  testClient = value ? protegerCliente(value, projectName, projectName !== "AgenteTVN") : undefined;
}

export function actualizarTraza(metadata: Record<string, unknown>) {
  if (!tracingActivo()) return;
  try { const run = getCurrentRunTree(); run.metadata = { ...run.metadata, ...sanitizarTraza(metadata) }; } catch { /* no current span */ }
}

/** Validate persisted technical fields, including the SDK/server's numeric depth counter. */
export function payloadTecnicoPersistido(run: { inputs?: Record<string, unknown> | null; outputs?: Record<string, unknown> | null; extra?: { metadata?: Record<string, unknown> } & Record<string, unknown> | null; reference_example_id?: string | null }, exampleProvenance?: "synthetic" | "public_snapshot") {
  const inputs = run.inputs ?? {}, outputs = run.outputs ?? {}, extra = run.extra ?? {};
  const metadata = { ...(extra.metadata ?? {}) };
  // Server-enriched example metadata is checked only on referenced evaluation roots.
  // These fields remain forbidden by the outbound sanitizer.
  if (exampleProvenance && /^[a-f0-9-]{36}$/.test(run.reference_example_id ?? "")) {
    if (metadata.ls_example_provenance !== exampleProvenance || metadata.ls_example_version !== "evaluator-dev-v1" ||
      JSON.stringify(metadata.ls_example_dataset_split) !== '["base"]') return false;
    delete metadata.ls_example_provenance; delete metadata.ls_example_version; delete metadata.ls_example_dataset_split;
  }
  return Object.keys(inputs).length === 0 && JSON.stringify(outputs) === JSON.stringify(sanitizarTraza(outputs)) &&
    Object.keys(extra).every(k => k === "metadata") && JSON.stringify(metadata) === JSON.stringify(sanitizarTraza(metadata));
}

/** A separately approved development experiment; never enables application tracing implicitly. */
export async function withDevelopmentExperiment<T>(projectName: string, fn: (client: Client) => Promise<T>): Promise<T> {
  if (!tracingActivo() || process.env.AGENTETVN_DEV_EVALUATION_APPROVED !== "1" ||
    !/^AgenteTVN-dev-[a-f0-9]{12}-[0-9T]+$/.test(projectName)) throw new Error("Development experiment requires explicit scoped approval");
  const value = protegerCliente(new Client({ apiKey: process.env.LANGSMITH_API_KEY, apiUrl: ENDPOINT,
    tracingMode: "langsmith", hideInputs: () => ({}), hideOutputs: sanitizarTraza, hideMetadata: sanitizarTraza,
    anonymizer: sanitizarTraza, omitTracedRuntimeInfo: true, disablePromptCache: true,
    timeout_ms: 15000, callerOptions: { maxRetries: 0 }, manualFlushMode: true,
    maxIngestMemoryBytes: 1_000_000, blockOnRootRunFinalization: false, debug: false }), projectName, true);
  return experimentContext.run({ client: value, projectName }, () => fn(value));
}
