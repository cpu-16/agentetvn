import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Client } from "langsmith";
import { _clienteTrazaPruebas, conTraza, flushTracing, sanitizarTraza } from "../src/lib/motor/tracing";

const keys = ["AGENTETVN_MODO", "AGENTETVN_TRACING", "AGENTETVN_TRACE_APPROVED", "LANGSMITH_API_KEY", "LANGSMITH_RUNS_ENDPOINTS", "GITHUB_SHA"];
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
    let calls = 0;
    expect(await conTraza("root", {}, async () => ++calls)).toBe(1);
    expect(calls).toBe(1);
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
  test("metadata accepts only bounded technical fields", () => {
    expect(sanitizarTraza({ modo: "bm25", tokens: 9, commit: "58449b389b85", secret: "x", tokens_bad: -1, snapshot: "a private identity", q: "question" }))
      .toEqual({ modo: "bm25", tokens: 9, commit: "58449b389b85" });
  });
});
