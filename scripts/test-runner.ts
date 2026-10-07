// Every test invocation gets a new SQLite database. Never reuse DATABASE_URL.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export function runTests(files: string[] = ["tests/"]) {
  if (files.some((file) => file !== "tests/" && (!/^tests\/[\w-]+\.test\.ts$/.test(file)))) {
    throw new Error("Only development tests under tests/ are allowed.");
  }
  const root = mkdtempSync(join(tmpdir(), "agentetvn-tests-"));
  writeFileSync(join(root, ".test-database"), "agentetvn-disposable-tests");
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", DATABASE_URL: `file:${join(root, "test.db").replace(/\\/g, "/")}`,
    AGENTETVN_TEST_ROOT: root, AGENTETVN_MODO: "offline", HF_HUB_OFFLINE: "1", AGENTETVN_VOZ: "off",
    AGENTETVN_TRACING: "off", LANGSMITH_TRACING: "false", AGENTETVN_REGISTRO: join(root, "consultas.jsonl"),
    LLM_REGISTRO: join(root, "llm.jsonl"), AGENTETVN_DATOS: resolve("data/processed") };
  for (const key of ["LANGSMITH_API_KEY", "LANGCHAIN_API_KEY", "LLM_API_KEY", "LLM_BASE_URL", "NOTION_TOKEN", "VOZ_TOKEN"]) delete env[key];
  try {
    const schema = spawnSync(process.execPath, ["run", "--no-env-file", "node_modules/prisma/build/index.js", "db", "push", "--schema", "prisma/schema.prisma", "--skip-generate"], { env, encoding: "utf8" });
    if (schema.status !== 0) return { status: schema.status ?? 1, output: `${schema.stdout ?? ""}${schema.stderr ?? ""}` };
    const result = spawnSync(process.execPath, ["test", "--no-env-file", ...files], { env, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    return { status: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? String(result.error) : ""}` };
  } finally {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith("agentetvn-tests-")) throw new Error("Unsafe test cleanup target");
    rmSync(root, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const result = runTests(process.argv.slice(2).length ? process.argv.slice(2) : undefined);
  process.stdout.write(result.output);
  process.exitCode = result.status;
}
