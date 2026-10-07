import { basename, dirname, join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";

const root = process.env.AGENTETVN_TEST_ROOT;
if (!root || dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith("agentetvn-tests-") ||
  process.env.DATABASE_URL !== `file:${join(root, "test.db").replace(/\\/g, "/")}` ||
  readFileSync(join(root, ".test-database"), "utf8") !== "agentetvn-disposable-tests") {
  throw new Error("Tests require a disposable database. Run bun run test (not bun test).");
}

// Local HTTP doubles are allowed; external services are never contacted by tests.
const original = globalThis.fetch;
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("External network disabled in development tests");
  return original(input, { ...init, redirect: "error" });
}) as typeof fetch;
