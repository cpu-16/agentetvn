// D11 en el servicio (SQLite real): una redacción en curso por evento, una edición humana no se pisa y un paquete de otro snapshot no se muestra.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Paquete } from "../src/lib/motor/contrato";

let servicio: typeof import("../src/lib/motor/servicio");
let llamadas = 0;
let srv: ReturnType<typeof Bun.serve>;
let id = "";
beforeAll(async () => {
  srv = Bun.serve({ port: 0, async fetch() { llamadas++; await Bun.sleep(400); return Response.json({ choices: [{ message: { content: "sin JSON" } }] }); } });
  process.env.AGENTETVN_VERIFICAR_MANIFEST = "0";
  process.env.AGENTETVN_MODO = "online";
  process.env.LLM_BASE_URL = `http://127.0.0.1:${srv.port}/v1`;
  process.env.LLM_REGISTRO = "/dev/null";
  servicio = await import("../src/lib/motor/servicio");
  id = servicio.snapshot().eventos.find((e) => e.rango === "alto" && !e.no_confiable)!.id;
});
afterAll(async () => {
  srv.stop(true);
  process.env.AGENTETVN_MODO = "offline";
  delete process.env.LLM_BASE_URL;
  const { db } = await import("../src/lib/db");
  await db.paqueteEditado.deleteMany({ where: { eventoId: id } });
});

describe("redacción con IA en el servicio", () => {
  test("dos solicitudes simultáneas comparten una llamada y una edición hecha mientras la IA redacta no se pisa", async () => {
    const a = servicio.paquete(id, "Prueba A", true);
    const b = servicio.paquete(id, "Prueba B", true);
    await Bun.sleep(150);
    const { generarPaquete } = await import("../src/lib/motor/paquete");
    const snap = servicio.snapshot();
    const base = generarPaquete(snap.eventos.find((e) => e.id === id)!, snap.noticias, snap.indicadores);
    await servicio.guardarPaquete(id, { ...base, titulo: "EDITADO POR UNA PERSONA" }, "Editora");
    const [pa, pb] = await Promise.all([a, b]);
    expect(llamadas).toBe(1);
    expect(pa).toBe(pb);
    expect(pa!.verificaciones.at(-1)).toContain("No se guardó: Editora editó este paquete");
    expect((await servicio.evento(id))!.paquete!.titulo).toBe("EDITADO POR UNA PERSONA");
  });
  test("un paquete redactado sobre otro snapshot no se muestra al abrir el evento", async () => {
    const { generarPaquete } = await import("../src/lib/motor/paquete");
    const snap = servicio.snapshot();
    const base = generarPaquete(snap.eventos.find((e) => e.id === id)!, snap.noticias, snap.indicadores);
    const viejo: Paquete = { ...base, modo: "llm", llm: { modelo: "m", ms: 1, tokens: 1, costo_usd: 0.01, descartadas: [], huella: "otro-snapshot" } };
    await servicio.guardarPaquete(id, viejo, "Precarga vieja");
    expect((await servicio.evento(id))!.paquete).toBeNull();
    await servicio.guardarPaquete(id, { ...viejo, llm: { ...viejo.llm!, huella: snap.huella } }, "Precarga vigente");
    expect((await servicio.evento(id))!.paquete?.modo).toBe("llm");
  });
});
