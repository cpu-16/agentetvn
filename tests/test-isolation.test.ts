import { expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runTests } from "../scripts/test-runner";

test("direct test execution refuses a configured database before persistence", () => {
  const path = join(process.env.AGENTETVN_TEST_ROOT!, "protected.db");
  writeFileSync(path, "user database sentinel");
  const result = Bun.spawnSync([process.execPath, "test", "--no-env-file", "tests/api-revision.test.ts"], {
    env: { ...process.env, DATABASE_URL: "file:" + path.replaceAll("\\\\", "/") },
    stdout: "pipe", stderr: "pipe",
  });
  expect(result.exitCode).not.toBe(0);
  expect(new TextDecoder().decode(result.stderr)).toContain("disposable database");
  expect(readFileSync(path, "utf8")).toBe("user database sentinel");
});
test("test harness refuses non-development targets", () => {
  expect(() => runTests(["data/reserved.json"])).toThrow("Only development tests");
});

test("a failing assertion produces a failing command exit", () => {
  const file = "tests/runner-exit-probe-" + process.pid + ".test.ts";
  writeFileSync(file, 'import { test, expect } from "bun:test"; test("intentional local exit probe", () => expect(1).toBe(2));', { flag: "wx" });
  try {
    const result = Bun.spawnSync([process.execPath, "run", "--no-env-file", "scripts/test-runner.ts", file], {
      env: process.env, stdout: "pipe", stderr: "pipe",
    });
    expect(result.exitCode).not.toBe(0);
    expect(new TextDecoder().decode(result.stdout)).toContain("1 fail");
  } finally { rmSync(file); }
});

test("loopback redirects cannot escape the offline network boundary", async () => {
  let reached = false;
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch(req) {
    if (new URL(req.url).pathname === "/redirect") return Response.redirect(server.url + "target");
    reached = true;
    return new Response("unexpected");
  } });
  try {
    await expect(fetch(server.url + "redirect", { redirect: "follow" })).rejects.toThrow();
    expect(reached).toBe(false);
    expect(() => fetch("https://example.invalid")).toThrow("External network disabled");
  } finally { server.stop(true); }
});
