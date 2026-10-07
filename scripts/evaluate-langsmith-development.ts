// Explicitly approved, technical-only development experiment. Never invoked by tests or CI.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dir, "..");
if (!process.argv.includes("--approved-development-evaluation")) throw new Error("Explicit development-evaluation approval flag required");
if (!process.argv.includes("--worker")) {
 const env = Object.fromEntries(["PATH", "Path", "SYSTEMROOT", "SystemRoot", "COMSPEC", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA"].filter(k => process.env[k]).map(k => [k, process.env[k]!])) as NodeJS.ProcessEnv;
 if (!process.env.LANGSMITH_API_KEY) throw new Error("Existing LangSmith authorization unavailable; do not change credentials");
 Object.assign(env, { LANGSMITH_API_KEY: process.env.LANGSMITH_API_KEY, LANGSMITH_TRACING: "false", AGENTETVN_MODO: "online", AGENTETVN_TRACING: "on", AGENTETVN_TRACE_APPROVED: "1", AGENTETVN_DEV_EVALUATION_APPROVED: "1", AGENTETVN_EVAL_CLOUD_WORKER: "1", HF_HUB_OFFLINE: "1", AGENTETVN_VOZ: "off", NEXT_TELEMETRY_DISABLED: "1" });
 const result = spawnSync(process.execPath, ["run", "--no-env-file", import.meta.path, "--approved-development-evaluation", "--worker"], { cwd: root, env, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
 process.stdout.write(result.stdout ?? ""); process.stderr.write(result.stderr ?? ""); process.exitCode = result.status ?? 1;
} else {
 process.chdir(root);
 if (process.env.AGENTETVN_EVAL_CLOUD_WORKER !== "1" || process.env.LLM_API_KEY || process.env.NOTION_TOKEN || process.env.LANGSMITH_RUNS_ENDPOINTS || process.env.OTEL_ENABLED) throw new Error("Requires the credential-minimizing cloud launcher");
 const git = (args: string[]) => { const r = spawnSync("git", ["-c", "safe.directory=" + root.replace(/\\/g, "/"), ...args], { encoding: "utf8" }); if (r.status !== 0) throw new Error("Git verification failed"); return r.stdout.trim(); };
 const commit = git(["rev-parse", "HEAD"]);
 if (git(["status", "--porcelain"])) throw new Error("Cloud evidence requires a clean committed tree");
 process.env.AGENTETVN_COMMIT = commit;
 const fetchOriginal = globalThis.fetch;
 globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== "https://api.smith.langchain.com") throw new Error("Only the approved LangSmith API endpoint is allowed");
  return fetchOriginal(input, { ...init, redirect: "error" });
 }) as typeof fetch;
 const { withDevelopmentExperiment, sanitizarTraza } = await import("../src/lib/motor/tracing");
 const { traceable } = await import("langsmith/traceable");
 const { technicalExamples, technicalTarget, technicalFeedback, feedbackMatches } = await import("./evaluation/technical");
 const { verifyHierarchy } = await import("./evaluation/verify");
 const { randomUUID } = await import("node:crypto");
 const stamp = new Date().toISOString().replace(/[-:.Z]/g, "");
 const name = "AgenteTVN-dev-" + commit.slice(0, 12) + "-" + stamp;
 const reportPath = join(root, "db/evaluation-dev/cloud-experiment.json");
 mkdirSync(join(root, "db/evaluation-dev"), { recursive: true });
 const report: Record<string, unknown> = { commit, name, startedAt: new Date().toISOString(), cloudModelCalls: 0, modelDownloads: 0, manualPending: 2, status: "preparing" };
 const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
 save();
 try {
  await withDevelopmentExperiment(name, async client => {
   const base = await client.readProject({ projectName: "AgenteTVN" });
   report.baseProjectId = base.id;
   const dataset = await client.createDataset(name, { dataType: "kv", description: "Technical-only development contracts; public or synthetic fixtures; no human semantic labels.", metadata: { commit, version: "evaluator-dev-v1" } });
   report.datasetId = dataset.id; save();
   const uploads = technicalExamples().map(e => ({ ...e, id: randomUUID(), dataset_id: dataset.id }));
   const examples = await client.createExamples(uploads);
   if (examples.length !== uploads.length || examples.some(e => !uploads.some(u => u.id === e.id && JSON.stringify(u.inputs) === JSON.stringify(e.inputs)))) throw new Error("Persisted example identity mismatch");
   const project = await client.createProject({ projectName: name, referenceDatasetId: dataset.id, numExamples: examples.length, numRepetitions: 1, evaluatorKeys: ["scenario_contract", "citation_existence", "citation_field_constraints"], metadata: { commit, version: "evaluator-dev-v1" }, upsert: false });
   report.projectId = project.id; save();
   if (project.tenant_id !== base.tenant_id) throw new Error("Development experiment must stay in the AgenteTVN workspace");
   const expected: { id: string; exampleId: string; caseId: string }[] = [];
   const rows: Record<string, unknown>[] = [];
   for (const example of examples) {
    const id = randomUUID(), caseId = String(example.inputs.case_id);
    expected.push({ id, exampleId: example.id, caseId });
    const outputs = await traceable(technicalTarget, { id, name: "evaluacion-desarrollo", run_type: "chain", client, tracingEnabled: true, replicas: [], project_name: name,
     reference_example_id: example.id, metadata: { origen: "desarrollo", commit, snapshot: example.inputs.fixture_hash }, tags: ["prompt-rules-v1", "evaluator-dev-v1"], processInputs: () => ({}), processOutputs: sanitizarTraza })(example.inputs);
    await client.flush();
    const feedback = technicalFeedback(outputs);
    const feedbackIds: string[] = [];
    for (const f of feedback) feedbackIds.push((await client.createFeedback({ runId: id, sessionId: project.id, key: f.key, ...(f.score !== undefined ? { score: f.score } : { value: f.value }), sourceInfo: { version: "evaluator-dev-v1" } })).id);
    rows.push({ caseId, runId: id, exampleId: example.id, fixtureHash: example.inputs.fixture_hash, outputs, feedback, feedbackIds });
    report.cases = rows; report.expectedRoots = expected; report.status = "running"; save();
    console.log(caseId + ": " + outputs.resultado);
   }
   await client.updateProject(project.id, { endTime: new Date().toISOString(), metadata: { commit, version: "evaluator-dev-v1" } });
   let spans: import("langsmith/schemas").Run[] = [];
   for (let attempt = 0; attempt < 6; attempt++) {
    spans = []; for await (const run of client.listRuns({ projectId: project.id })) { spans.push(run); if (spans.length > 500) throw new Error("Unexpected development span count"); }
    const verified = verifyHierarchy(spans, expected, project.id);
    report.hierarchy = verified; save(); if (verified.verified) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
   }
   const hierarchy = verifyHierarchy(spans, expected, project.id);
   const persisted = await client.readProject({ projectId: project.id });
   const recorded: import("langsmith/schemas").Feedback[] = [];
   for await (const f of client.listFeedback({ runIds: expected.map(e => e.id) })) recorded.push(f);
   let persistedFeedback = 0;
   for (const row of rows) for (const wanted of row.feedback as import("langsmith/evaluation").EvaluationResult[]) {
    const actual = recorded.find(f => f.run_id === row.runId && f.key === wanted.key);
    if (!actual || !feedbackMatches(wanted, actual)) throw new Error("Persisted feedback mismatch");
    persistedFeedback++;
   }
   report.hierarchy = hierarchy; report.referenceDatasetVerified = persisted.reference_dataset_id === dataset.id;
   report.persistedFeedback = persistedFeedback;
   report.projectUrl = await client.getProjectUrl({ projectId: project.id }); report.datasetUrl = await client.getDatasetUrl({ datasetId: dataset.id });
   report.status = hierarchy.verified && report.referenceDatasetVerified && persistedFeedback === rows.length * 3 && rows.every(r => (r.outputs as Record<string, unknown>).resultado === "ok") ? "verified" : "verification_failed";
   report.completedAt = new Date().toISOString(); save();
   console.log(JSON.stringify({ status: report.status, projectUrl: report.projectUrl, datasetUrl: report.datasetUrl, hierarchy, persistedFeedback, commit }));
   if (report.status !== "verified") process.exitCode = 1;
  });
 } catch {
  report.status = "failed_or_incomplete"; report.completedAt = new Date().toISOString(); save();
  console.error("Development experiment incomplete. Inspect the technical local report; do not retry automatically."); process.exitCode = 1;
 }
}
