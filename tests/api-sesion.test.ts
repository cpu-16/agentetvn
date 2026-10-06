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
