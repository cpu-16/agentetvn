// Explicit, one-shot public development connection check; never imported by the app.
import { Client } from "langsmith";
import { getCurrentRunTree } from "langsmith/traceable";
import { conTraza, flushTracing, payloadTecnicoPersistido } from "../src/lib/motor/tracing";
import { cargarSnapshot } from "../src/lib/motor/cargar";
import { cincoTemas } from "../src/lib/motor/consulta";

async function main() {
  if (!process.argv.includes("--approved-public-dev")) throw new Error("Explicit approved public development run required");
  const keyPresent = !!process.env.LANGSMITH_API_KEY?.trim();
  console.log(JSON.stringify({ keyPresent }));
  if (!keyPresent) { process.exitCode = 1; return; }
  // Disable model/download/voice paths. The input is the brief's public CU-01 agenda question.
  process.env.HF_HUB_OFFLINE = "1";
  process.env.AGENTETVN_VOZ = "off";
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_API_KEY;
  Object.assign(process.env, { AGENTETVN_MODO: "online", AGENTETVN_TRACING: "on", AGENTETVN_TRACE_APPROVED: "1",
    LANGSMITH_ENDPOINT: "https://api.smith.langchain.com", LANGSMITH_PROJECT: "AgenteTVN" });
  const snap = cargarSnapshot();
  let id = "";
  await conTraza("consulta", { modalidad: "tvn", origen: "desarrollo", snapshot: snap.huella }, async () => {
    id = getCurrentRunTree().id;
    // CU-01: Which five topics merit review and why? Same deterministic evidence core as the agenda.
    const items = cincoTemas(snap);
    return { modo: "extractivo", afirmaciones: items.map((x) => x.evento), evidencias: [...new Set(items.flatMap(x => x.evento.ids_noticia))], abstener: items.length === 0 };
  });
  if (!await flushTracing(1000) || !id) throw new Error("Trace transport not confirmed");
  const reader = new Client({ apiKey: process.env.LANGSMITH_API_KEY, apiUrl: "https://api.smith.langchain.com",
    timeout_ms: 3000, callerOptions: { maxRetries: 0 }, debug: false,
    fetchImplementation: ((input: string | URL | Request, init?: RequestInit) => fetch(input, { ...init, redirect: "error" })) as typeof fetch });
  let run: Awaited<ReturnType<typeof reader.readRun>> | undefined;
  // Read back this same run; never create another trace to retry verification.
  for (let attempt = 0; attempt < 4; attempt++) {
    try { run = await reader.readRun(id); break; } catch { await Bun.sleep(500); }
  }
  if (!run?.end_time || run.error) throw new Error("Persisted completed run not confirmed");
  const inputs = run.inputs ?? {}, outputs = run.outputs ?? {}, extra = run.extra ?? {};
  if (!payloadTecnicoPersistido(run)) throw new Error("Persisted payload violated technical-only policy");
  const project = await reader.readProject({ projectName: "AgenteTVN" });
  const runUrl = await reader.getRunUrl({ run, projectOpts: { projectId: project.id } });
  if (!runUrl.includes("/p/" + project.id + "/r/" + run.id)) throw new Error("Persisted run project mismatch");
  console.log(JSON.stringify({ verified: true, runId: run.id, runUrl, projectVerified: true,
    case: "CU-01", questionUploaded: false, evidenceUploaded: false, outputTextUploaded: false,
    modelCalls: 0, inputs, outputs, metadata: extra.metadata }));
}
const originalError = console.error;
console.error = () => originalError("Trace transport unavailable (details suppressed)");
try { await main(); }
catch { console.log(JSON.stringify({ verified: false, error: "Connection or persisted trace verification failed; credential and transport details suppressed." })); process.exitCode = 1; }
finally { process.env.AGENTETVN_TRACING = "off"; process.env.AGENTETVN_TRACE_APPROVED = "0"; }
