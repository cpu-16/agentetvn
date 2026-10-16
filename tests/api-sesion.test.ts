// La mesa está detrás del PIN: sus lecturas (tablero, agenda, control, evento) también exigen la sesión.
import { beforeAll, describe, expect, test } from "bun:test";
import { serializar } from "../src/lib/sesion";

let id = "";
beforeAll(async () => {
  process.env.AGENTETVN_VERIFICAR_MANIFEST = "0";
  const { snapshot } = await import("../src/lib/motor/servicio");
  id = snapshot().eventos[0].id;
});
const conCookie = () => new Request("http://x/api", { headers: { cookie: `mesa=${encodeURIComponent(serializar({ nombre: "Prueba", rol: "editor", desde: new Date().toISOString() }))}` } });
const sinCookie = () => new Request("http://x/api");

describe("rutas de lectura con sesión", () => {
  test("sin cookie → 401 en tablero, agenda, control y evento", async () => {
    const rutas = await Promise.all([import("../src/app/api/tablero/route"), import("../src/app/api/agenda/route"), import("../src/app/api/control/route")]);
    for (const r of rutas) expect((await r.GET(sinCookie())).status).toBe(401);
    const ev = await import("../src/app/api/eventos/[id]/route");
    expect((await ev.GET(sinCookie(), { params: Promise.resolve({ id }) })).status).toBe(401);
  });
  test("con sesión → 200 y la agenda trae el resumen compartido con el tablero", async () => {
    const tab = await import("../src/app/api/tablero/route");
    const ag = await import("../src/app/api/agenda/route");
    const ev = await import("../src/app/api/eventos/[id]/route");
    const ctl = await import("../src/app/api/control/route");
    expect((await ctl.GET(conCookie())).status).toBe(200);
    const rt = await tab.GET(conCookie());
    const ra = await ag.GET(conCookie());
    expect(rt.status).toBe(200);
    expect(ra.status).toBe(200);
    expect((await ev.GET(conCookie(), { params: Promise.resolve({ id }) })).status).toBe(200);
    const [t, a] = [await rt.json(), await ra.json()];
    expect(a.resumen.publicaciones).toBe(t.publicaciones);
    expect(a.resumen.medios).toBe(t.mediosDistintos);
    expect(a.resumen.eventos).toBe(t.eventos.length);
  });
});

describe("PIN extra para ensayar (15-oct)", () => {
  test("acepta el PIN de la mesa y el extra; sin extra, solo el de la mesa; la sesión sigue firmada con el principal", async () => {
    const { pinCoincide, serializar: ser } = await import("../src/lib/sesion");
    const antes = { pin: process.env.AGENTETVN_PIN, extra: process.env.AGENTETVN_PIN_EXTRA };
    process.env.AGENTETVN_PIN = "Tvn2026***"; delete process.env.AGENTETVN_PIN_EXTRA;
    const firmada = ser({ nombre: "Ana", rol: "editor", desde: "2026-10-15T00:00:00Z" });
    expect(pinCoincide("0000")).toBe(false);
    process.env.AGENTETVN_PIN_EXTRA = "0000";
    expect(pinCoincide("0000")).toBe(true);
    expect(pinCoincide("Tvn2026***")).toBe(true);
    expect(pinCoincide("000")).toBe(false);
    expect(pinCoincide("")).toBe(false);
    expect(ser({ nombre: "Ana", rol: "editor", desde: "2026-10-15T00:00:00Z" })).toBe(firmada); // agregar el extra no cierra sesiones
    if (antes.pin === undefined) delete process.env.AGENTETVN_PIN; else process.env.AGENTETVN_PIN = antes.pin; // asignar undefined dejaría el texto «undefined»
    if (antes.extra === undefined) delete process.env.AGENTETVN_PIN_EXTRA; else process.env.AGENTETVN_PIN_EXTRA = antes.extra;
  });
});
