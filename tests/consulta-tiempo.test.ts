import { afterAll, expect, test } from "bun:test";
const previous = { modo: process.env.AGENTETVN_MODO, url: process.env.LLM_BASE_URL };
let srv: ReturnType<typeof Bun.serve> | undefined;
afterAll(() => {
  srv?.stop(true);
  process.env.AGENTETVN_MODO = previous.modo;
  if (previous.url === undefined) delete process.env.LLM_BASE_URL; else process.env.LLM_BASE_URL = previous.url;
});
test("root latency includes local generation even when it falls back", async () => {
  let calls = 0;
  srv = Bun.serve({ port: 0, async fetch() {
    calls++; await Bun.sleep(80);
    return Response.json({ choices: [{ message: { content: "invalid JSON" } }] });
  } });
  process.env.AGENTETVN_MODO = "online";
  process.env.LLM_BASE_URL = "http://127.0.0.1:" + srv.port + "/v1";
  const { consulta } = await import("../src/lib/motor/servicio");
  const response = await consulta("¿Qué se sabe del Canal de Panamá?", "bm25");
  expect(calls).toBe(1);
  expect(response.ms).toBeGreaterThanOrEqual(70);
  expect(response.redaccion).toBeUndefined();
  expect(response.afirmaciones.length).toBeGreaterThan(0);
});
