import { traceable } from "langsmith/traceable";
import { technicalTarget, technicalExamples, technicalFeedback } from "../scripts/evaluation/technical";
import { verifyHierarchy, type VerifiedSpan } from "../scripts/evaluation/verify";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Client, overrideFetchImplementation } from "langsmith";
import { _clienteTrazaPruebas, conTraza, flushTracing, sanitizarTraza, payloadTecnicoPersistido } from "../src/lib/motor/tracing";

const keys = ["AGENTETVN_MODO", "AGENTETVN_TRACING", "AGENTETVN_TRACE_APPROVED", "LANGSMITH_API_KEY", "LANGSMITH_RUNS_ENDPOINTS", "GITHUB_SHA", "LANGSMITH_TRACING_MODE", "OTEL_ENABLED"];
let previous: Record<string, string | undefined>;
let created: Record<string, unknown>[];
let updated: Record<string, unknown>[];
let mock: Client;
beforeEach(() => {
  previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { AGENTETVN_MODO: "online", AGENTETVN_TRACING: "on", AGENTETVN_TRACE_APPROVED: "1", LANGSMITH_API_KEY: "test-only-key" });
  created = []; updated = [];
  mock = new Client({ apiKey: "test-only-key", manualFlushMode: true,
    fetchImplementation: (() => { throw new Error("No cloud calls in tests"); }) as unknown as typeof fetch });
  mock.createRun = async (run) => { created.push(structuredClone(run) as unknown as Record<string, unknown>); };
  mock.updateRun = async (id, run) => { updated.push({ id, ...structuredClone(run) }); };
  mock.flush = async () => {};
  _clienteTrazaPruebas(mock);
});
afterEach(() => {
  _clienteTrazaPruebas();
  for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
});
describe("optional server tracing", () => {
  test("disabled/offline/missing credentials never touch the SDK", async () => {
    for (const [key, value] of [["AGENTETVN_TRACING", "off"], ["AGENTETVN_MODO", "offline"], ["LANGSMITH_API_KEY", ""], ["AGENTETVN_TRACE_APPROVED", "0"]]) {
      const before = process.env[key]; process.env[key] = value;
      expect(await conTraza("root", {}, async () => 42)).toBe(42);
      process.env[key] = before;
    }
    expect(created).toHaveLength(0);
  });
  test("nested runs have parentage; raw data and error messages never enter traces", async () => {
    const secret = "private-question@example.com Bearer hidden-token";
    const result = await conTraza("consulta", { modalidad: "tvn", pregunta: secret, persona: secret }, async () =>
      conTraza("recuperacion", {}, async () => ({ modo: "bm25", afirmaciones: [{ texto: secret }], vector: [1, 2], ms: 5 })));
    expect(result.afirmaciones[0].texto).toBe(secret);
    expect(created).toHaveLength(2);
    const parent = created.find((run) => run.name === "consulta")!;
    const child = created.find((run) => run.name === "recuperacion")!;
    expect(child.parent_run_id).toBe(parent.id);
    expect(JSON.stringify([...created, ...updated])).not.toContain(secret);
    const appError = new Error(secret);
    await expect(conTraza("error", {}, async () => { throw appError; })).rejects.toBe(appError);
    expect(JSON.stringify([...created, ...updated])).not.toContain(secret);
    expect(JSON.stringify(updated)).toContain("application_error");
  });
  test("SDK failure never repeats an operation; flush is bounded", async () => {
    mock.createRun = async () => { throw new Error("simulated network failure"); };
    _clienteTrazaPruebas(mock);
    let calls = 0;
    expect(await conTraza("root", {}, async () => ++calls)).toBe(1);
    expect(calls).toBe(1);
    await flushTracing();
    mock.flush = async () => new Promise<void>(() => {});
    const start = Date.now();
    expect(await flushTracing(20)).toBe(false);
    expect(Date.now() - start).toBeLessThan(300);
  });
  test("inherited replicas and SDK runtime never escape the approved transport", async () => {
    process.env.LANGSMITH_RUNS_ENDPOINTS = JSON.stringify([{ api_url: "https://unapproved.invalid", api_key: "private-replica-key" }]);
    process.env.GITHUB_SHA = "private-release-identity";
    const options: unknown[] = [];
    mock.createRun = async (run, endpoint) => { created.push(structuredClone(run) as unknown as Record<string, unknown>); options.push(endpoint); };
    _clienteTrazaPruebas(mock);
    await conTraza("consulta", { modalidad: "tvn" }, async () => ({ modo: "bm25", ms: 2 }));
    expect(created).toHaveLength(1);
    expect(options).toEqual([undefined]);
    const extra = created[0].extra as Record<string, unknown>;
    expect(extra).toEqual({ metadata: { modalidad: "tvn" } });
    const payload = JSON.stringify([...created, ...updated]);
    expect(payload).not.toContain("runtime");
    expect(payload).not.toContain("private-release-identity");
    expect(payload).not.toContain("unapproved.invalid");
    expect(payload).not.toContain("private-replica-key");
  });
  test("concurrent flush callers await the same in-flight sender", async () => {
    let calls = 0;
    let release: (() => void) | undefined;
    mock.flush = async () => { calls++; await new Promise<void>((resolve) => { release = resolve; }); };
    const first = flushTracing(300), second = flushTracing(300);
    release!();
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(calls).toBe(1);
  });
  test("production client pins LangSmith transport despite inherited OpenTelemetry settings", async () => {
    process.env.LANGSMITH_TRACING_MODE = "otel";
    process.env.OTEL_ENABLED = "true";
    delete process.env.LANGSMITH_RUNS_ENDPOINTS;
    _clienteTrazaPruebas();
    const fetchKey = Symbol.for("ls:fetch_implementation");
    const previousFetch = Reflect.get(globalThis, fetchKey);
    const urls: string[] = [];
    overrideFetchImplementation(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      urls.push(url);
      return new Response(url.endsWith("/info") ? JSON.stringify({ version: "0.12.0", batch_ingest_config: { use_multipart_endpoint: false } }) : "{}",
        { status: 200, headers: { "content-type": "application/json" } });
    });
    try {
      expect(await conTraza("consulta", { modalidad: "tvn" }, async () => 42)).toBe(42);
      expect(await flushTracing(1000)).toBe(true);
      expect(urls.some((url) => url.includes("/runs"))).toBe(true);
      expect(urls.every((url) => new URL(url).origin === "https://api.smith.langchain.com")).toBe(true);
    } finally {
      if (previousFetch) overrideFetchImplementation(previousFetch);
      else Reflect.deleteProperty(globalThis, fetchKey);
    }
  });
  test("metadata accepts only bounded technical fields", () => {
    expect(sanitizarTraza({ modo: "bm25", tokens: 9, commit: "58449b389b85", secret: "x", tokens_bad: -1, snapshot: "a private identity", q: "question" }))
      .toEqual({ modo: "bm25", tokens: 9, commit: "58449b389b85" });
  });
});


describe("development experiment hierarchy and privacy", () => {
  test("one actual root per case has the executed child stages, with independently verified counts", async () => {
    const project = "AgenteTVN-dev-abcdefabcdef-20261007T120000";
    // Fresh scoped transport: do not wrap the normal-project mock a second time.
    mock = new Client({ apiKey: "test-only-key", manualFlushMode: true, fetchImplementation: (() => { throw new Error("No cloud calls in tests"); }) as unknown as typeof fetch });
    mock.createRun = async run => { created.push(structuredClone(run) as unknown as Record<string, unknown>); };
    mock.updateRun = async (id, run) => { updated.push({ id, ...structuredClone(run) }); };
    mock.flush = async () => {};
    _clienteTrazaPruebas(mock, project);
    const expected: { id: string; exampleId: string; caseId: string }[] = [];
    for (const caseId of ["CU01", "CU05", "JURY-ABSTENTION", "JURY-LEXICAL"]) {
      const input = technicalExamples().find(e => e.inputs.case_id === caseId)!.inputs;
      const id = crypto.randomUUID(), exampleId = crypto.randomUUID();
      const outputs = await traceable(technicalTarget, { id, reference_example_id: exampleId, name: "evaluacion-desarrollo", client: mock, tracingEnabled: true, replicas: [], project_name: project, processInputs: () => ({}), processOutputs: sanitizarTraza })(input);
      expect(technicalFeedback(outputs)[0].score).toBe(true);
      if (caseId === "CU01") expect(outputs).toMatchObject({ afirmaciones: 5, evidencias: 5 });
      expected.push({ id, exampleId, caseId });
    }
    const persisted: VerifiedSpan[] = created.map(r => ({ ...r, ...updated.filter(u => u.id === r.id).at(-1), session_id: "test-project" })) as unknown as VerifiedSpan[];
    const verified = verifyHierarchy(persisted, expected, "test-project");
    expect(verified).toMatchObject({ verified: true, roots: 4 });
    expect(verified.children).toBeGreaterThan(4);
    const abstentionId = expected.find(e => e.caseId === "JURY-ABSTENTION")!.id;
    expect(persisted.some(r => r.trace_id === abstentionId && r.name === "recuperacion")).toBe(false);
    const lexicalId = expected.find(e => e.caseId === "JURY-LEXICAL")!.id;
    expect(persisted.some(r => r.trace_id === lexicalId && r.name === "recuperacion")).toBe(true);
    const extraRoot = { ...persisted[0], id: crypto.randomUUID(), parent_run_id: null };
    expect(verifyHierarchy([...persisted, extraRoot], expected, "test-project").verified).toBe(false);
    expect(verifyHierarchy(persisted.filter(r => r.name !== "agenda"), expected, "test-project").violations).toContain("executed_stage_mismatch");
    expect(created.every(r => r.session_name === project)).toBe(true);
    const payload = JSON.stringify([...created, ...updated]);
    expect(payload).not.toContain("Titular candidato");
    expect(payload).not.toContain("ajusta tránsitos");
    expect(payload).not.toContain("Inflación en Panamá");
    expect(created.every(r => Object.keys(r.inputs as object).length === 0)).toBe(true);
  });
  test("SDK depth is numeric technical metadata; text, runtime and unknown fields are rejected", () => {
    expect(payloadTecnicoPersistido({ inputs: {}, outputs: { evidencias: 5 }, extra: { metadata: { ls_run_depth: 0 } } })).toBe(true);
    for (const value of ["0", -1, "private-text"]) expect(payloadTecnicoPersistido({ extra: { metadata: { ls_run_depth: value } } })).toBe(false);
    expect(payloadTecnicoPersistido({ inputs: { question: "private" } })).toBe(false);
    expect(payloadTecnicoPersistido({ extra: { runtime: {}, metadata: {} } })).toBe(false);
    expect(payloadTecnicoPersistido({ outputs: { content: "private" } })).toBe(false);
  });
  test("empty evidence denominators stay unscored; contradictory counters cannot create feedback", () => {
    const outputs = { resultado: "ok", checks_total: 2, checks_passed: 2, citation_total: 0, citation_existing: 0, citation_supported: 0 };
    expect(technicalFeedback(outputs).map(f => f.score ?? f.value)).toEqual([true, "not_applicable", "not_applicable"]);
    expect(() => technicalFeedback({ ...outputs, citation_total: 1, citation_supported: 2 })).toThrow("Invalid citation counters");
    expect(() => technicalFeedback({ ...outputs, checks_total: 0 })).toThrow("Invalid contract counters");
    expect(technicalExamples().every(e => Object.keys(e.inputs).sort().join() === "case_id,fixture_hash")).toBe(true);
  });
});
