// Local development evaluation only. No LangSmith SDK runner, API client, upload flag or model call.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
const root = resolve(import.meta.dir, "..");
const reportsRoot = join(root, "db", "evaluation-dev");
const requested = process.argv.indexOf("--report");
const reportPath = resolve(requested >= 0 ? process.argv[requested + 1] : join(reportsRoot, "report.json"));
if (!reportPath.startsWith(reportsRoot + sep) || !reportPath.endsWith(".json")) throw new Error("Evaluation reports must stay under ignored db/evaluation-dev and use .json");

if (!process.argv.includes("--worker")) {
  // Whitelist system plumbing only. Never pass inherited credentials or load .env into the worker.
  const env = Object.fromEntries(["PATH", "Path", "SYSTEMROOT", "SystemRoot", "COMSPEC", "TEMP", "TMP", "HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA"].filter((k) => process.env[k]).map((k) => [k, process.env[k]!])) as NodeJS.ProcessEnv;
  Object.assign(env, { AGENTETVN_MODO: "offline", AGENTETVN_TRACING: "off", AGENTETVN_TRACE_APPROVED: "0", LANGSMITH_TRACING: "false", HF_HUB_OFFLINE: "1", AGENTETVN_VOZ: "off", NEXT_TELEMETRY_DISABLED: "1", AGENTETVN_EVAL_WORKER: "1" });
  const child = spawnSync(process.execPath, ["run", "--no-env-file", import.meta.path, "--worker", "--report", reportPath], { cwd: root, env, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  process.stdout.write(child.stdout ?? ""); process.stderr.write(child.stderr ?? "");
  process.exitCode = child.status ?? 1;
} else {
  if (process.env.AGENTETVN_EVAL_WORKER !== "1" || process.env.AGENTETVN_MODO !== "offline" || process.env.AGENTETVN_TRACING !== "off" || process.env.LANGSMITH_API_KEY || process.env.LLM_API_KEY || process.env.NOTION_TOKEN) throw new Error("Evaluation worker requires the credential-free launcher");
  process.chdir(root);
  let blockedFetchAttempts = 0;
  globalThis.fetch = (() => { blockedFetchAttempts++; throw new Error("Development evaluation: network disabled"); }) as unknown as typeof fetch;
  const { developmentCases } = await import("./evaluation/cases");
  const { developmentTarget, exampleInput } = await import("./evaluation/target");
  const { contractChecks } = await import("./evaluation/evaluators");
  const { modeloEnCache } = await import("../src/lib/motor/embeddings");
  const git = (args: string[]) => {
    const r = spawnSync("git", ["-c", "safe.directory=" + root.replace(/\\/g, "/"), ...args], { cwd: root, encoding: "utf8" });
    if (r.status !== 0) throw new Error("Git identity verification failed");
    return r.stdout.trim();
  };
  const commit = git(["rev-parse", "HEAD"]), dirty = git(["status", "--porcelain"]).length > 0;
  const hash = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");
  const files: string[] = [];
  for (const dir of ["src", "config", "tests", "scripts/evaluation"]) {
    const walk = (p: string) => { for (const e of readdirSync(p, { withFileTypes: true })) { const next = join(p, e.name); if (e.isDirectory()) walk(next); else if (e.isFile()) files.push(relative(root, next).replace(/\\/g, "/")); } };
    walk(join(root, dir));
  }
  files.push("scripts/evaluate-development.ts", "scripts/evaluate-langsmith-development.ts", "scripts/trace-public-dev.ts", "scripts/test-runner.ts", "bunfig.toml", "package.json", "bun.lock", "prisma/schema.prisma");
  const executionDefinitionHash = hash(JSON.stringify(files.sort().map((p) => [p, hash(readFileSync(join(root, p)))])));
  const report: Record<string, unknown> = { startedAt: new Date().toISOString(), commit, workingTreeDirty: dirty,
    executionDefinitionHash, scope: "development contracts; separate from frozen benchmarks and human semantic acceptance",
    networkPolicy: "worker fetch disabled; reused suites use isolated databases and loopback-only doubles",
    cloudUploads: 0, cloudModelCalls: 0, modelDownloads: 0,
    embeddingInference: { executed: false, cachePresent: modeloEnCache(), reason: "Full embedding inference is outside this contract run; lexical/offline behavior is checked separately." }, cases: [] };
  const results: Record<string, unknown>[] = [];
  mkdirSync(dirname(reportPath), { recursive: true });
  for (const c of developmentCases) {
    const startedAt = new Date().toISOString(), input = exampleInput(c);
    try {
      const output = await developmentTarget(input), checks = contractChecks(output);
      const status = output.status === "manual_pending" ? "manual_pending" : checks.length > 0 && checks.every((x) => x.passed) ? "passed" : "failed";
      if (output.suiteLog) { writeFileSync(join(dirname(reportPath), c.id + ".log"), output.suiteLog); delete output.suiteLog; }
      results.push({ id: c.id, title: c.title, aliases: c.aliases ?? [], alignment: c.alignment ?? "development contract", inputs: input,
        expected: c.expected, startedAt, completedAt: new Date().toISOString(), status, checks, output });
      console.log(c.id + ": " + status + (output.citations ? "; citation IDs=" + output.citations.existenceScore + ", field constraints=" + output.citations.fieldContractScore : ""));
    } catch {
      results.push({ id: c.id, startedAt, completedAt: new Date().toISOString(), status: "failed", error: "Case execution failed; inspect local development logs. No remote call was attempted." });
      console.log(c.id + ": failed during execution");
    }
  }
  report.cases = results; report.blockedWorkerFetchAttempts = blockedFetchAttempts;
  report.completedAt = new Date().toISOString();
  report.summary = { total: results.length, passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length, manualPending: results.filter((r) => r.status === "manual_pending").length };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ report: relative(root, reportPath), ...report.summary as object, commit, workingTreeDirty: dirty }));
  process.exitCode = results.some((r) => r.status === "failed") ? 1 : 0;
}
