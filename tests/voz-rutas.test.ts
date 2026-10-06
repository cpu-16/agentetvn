// Jarvis-TVN · rutas de voz con puente inverso: sesión, dueño de la llamada, token, interruptor y puente ausente u ocupado.
// El «puente» se simula llamando a /api/voz/puente/espera y /respuesta como lo haría el proceso de css-llamada.
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { serializar } from "../src/lib/sesion";
import { _vaciarEnlace } from "../src/lib/voz/enlace";
import { _vaciarRegistro, abrirLlamada, encolar } from "../src/lib/voz/registro";

const ANA = { nombre: "Ana", rol: "editor" as const, desde: new Date().toISOString() };
const BETO = { nombre: "Beto", rol: "editor" as const, desde: new Date(Date.now() - 1000).toISOString() };
const TOKEN = "t0ken-de-prueba-0123456789abcdef";
const cookie = (s: typeof ANA) => ({ cookie: `mesa=${encodeURIComponent(serializar(s))}` });
const ruta = async (r: string) => import(`../src/app/api/voz/${r}/route`);
const pedirEspera = async () => (await ruta("puente/espera")).GET(new Request("http://x/api/voz/puente/espera?ocupada=0&seg_hora=0&ms=200", { headers: { "x-voz-token": TOKEN } }));
const responder = async (cuerpo: object) => (await ruta("puente/respuesta")).POST(new Request("http://x/api/voz/puente/respuesta", { method: "POST", headers: { "x-voz-token": TOKEN, "content-type": "application/json" }, body: JSON.stringify(cuerpo) }));
const ofertar = async (s: typeof ANA) => (await ruta("offer")).POST(new Request("http://x/api/voz/offer", { method: "POST", body: "v=0 oferta", headers: cookie(s) }));

beforeAll(() => {
  Object.assign(process.env, { AGENTETVN_VERIFICAR_MANIFEST: "0", AGENTETVN_MODO: "online", AGENTETVN_VOZ: "on", VOZ_TOKEN: TOKEN, LLM_BASE_URL: "http://127.0.0.1:1/v1", LLM_REGISTRO: "/dev/null", VOZ_OFERTA_MS: "1500" });
});
afterAll(() => { process.env.AGENTETVN_MODO = "offline"; process.env.AGENTETVN_VOZ = "off"; delete process.env.LLM_BASE_URL; delete process.env.VOZ_OFERTA_MS; });
beforeEach(() => { _vaciarRegistro(); _vaciarEnlace(); process.env.AGENTETVN_VOZ = "on"; });

describe("rutas de la página", () => {
  test("sin sesión → 401", async () => {
    expect((await (await ruta("estado")).GET(new Request("http://x/api/voz/estado"))).status).toBe(401);
    expect((await (await ruta("offer")).POST(new Request("http://x/api/voz/offer", { method: "POST", body: "v=0" }))).status).toBe(401);
    expect((await (await ruta("acciones")).GET(new Request("http://x/api/voz/acciones?hilo=h"))).status).toBe(401);
    expect((await (await ruta("contexto")).POST(new Request("http://x/api/voz/contexto?hilo=h", { method: "POST", body: "{}" }))).status).toBe(401);
  });
  test("puente que nunca consultó → no disponible y la oferta da 503 al instante", async () => {
    const e = await (await (await ruta("estado")).GET(new Request("http://x/api/voz/estado", { headers: cookie(ANA) }))).json();
    expect(e.disponible).toBe(false);
    const t0 = Date.now();
    expect((await ofertar(ANA)).status).toBe(503);
    expect(Date.now() - t0).toBeLessThan(500);
  });
  test("oferta de ida y vuelta por el puente inverso: registra la llamada a nombre de la sesión", async () => {
    await pedirEspera(); // el puente se anuncia (vivo)
    expect((await (await (await ruta("estado")).GET(new Request("http://x/api/voz/estado", { headers: cookie(ANA) }))).json()).disponible).toBe(true);
    const oferta = ofertar(ANA);
    const cmd = await (await pedirEspera()).json();
    expect(cmd).toMatchObject({ tipo: "offer", sdp: "v=0 oferta", persona: "Ana" });
    expect(await (await responder({ id: cmd.id, ok: true, sdp: "v=0 respuesta", hilo: "hilo-1" })).json()).toMatchObject({ aceptada: true });
    const r = await oferta;
    expect(r.status).toBe(200);
    expect(r.headers.get("x-hilo")).toBe("hilo-1");
    expect(await r.text()).toBe("v=0 respuesta");
    const ac = await (await ruta("acciones")).GET(new Request("http://x/api/voz/acciones?hilo=hilo-1", { headers: cookie(ANA) }));
    expect(ac.status).toBe(200);
    // el registro de turnos: solo el dueño de la llamada y solo turnos válidos
    const turno = async (quien: string, sesion: Parameters<typeof cookie>[0]) => (await ruta("turno")).POST(new Request("http://x/api/voz/turno?hilo=hilo-1", { method: "POST", headers: { ...cookie(sesion), "content-type": "application/json" }, body: JSON.stringify({ quien, texto: "hola" }) }));
    expect((await turno("persona", ANA)).status).toBe(200);
    expect((await turno("sistema", ANA)).status).toBe(400);
    expect((await turno("persona", BETO)).status).toBe(403);
  });
  test("puente ocupado → 429 con mensaje claro", async () => {
    await pedirEspera();
    const oferta = ofertar(BETO);
    const cmd = await (await pedirEspera()).json();
    await responder({ id: cmd.id, ok: false, status: 429, error: "ocupada" });
    const r = await oferta;
    expect(r.status).toBe(429);
    expect((await r.json()).error).toContain("ocupada");
  });
  test("puente ocupado u otra oferta en curso → 429 al instante, sin encolar", async () => {
    await (await ruta("puente/espera")).GET(new Request("http://x/api/voz/puente/espera?ocupada=1&seg_hora=0&ms=100", { headers: { "x-voz-token": TOKEN } }));
    const t0 = Date.now();
    expect((await ofertar(ANA)).status).toBe(429);
    expect(Date.now() - t0).toBeLessThan(500);
    await pedirEspera(); // libre otra vez
    const primera = ofertar(ANA);
    expect((await ofertar(BETO)).status).toBe(429); // la segunda no espera ni se encola
    const cmd = await (await pedirEspera()).json();
    await responder({ id: cmd.id, ok: false, status: 502, error: "x" });
    expect((await primera).status).toBe(503);
  });
  test("respuesta tardía (nadie la espera) → aceptada=false para que el puente cuelgue", async () => {
    const r = await responder({ id: "ya-vencida", ok: true, sdp: "v=0", hilo: "hilo-x" });
    expect(await r.json()).toMatchObject({ aceptada: false });
  });
  test("reconciliación: si el puente reporta una llamada que Next no conoce, le ordena colgarla", async () => {
    const r = await (await ruta("puente/espera")).GET(new Request("http://x/api/voz/puente/espera?ocupada=1&seg_hora=10&activa=hilo-fantasma&ms=100", { headers: { "x-voz-token": TOKEN } }));
    expect(await r.json()).toMatchObject({ tipo: "colgar", hilo: "hilo-fantasma" });
    abrirLlamada("hilo-conocido", ANA.nombre, ANA.desde);
    const r2 = await (await ruta("puente/espera")).GET(new Request("http://x/api/voz/puente/espera?ocupada=1&seg_hora=10&activa=hilo-conocido&ms=100", { headers: { "x-voz-token": TOKEN } }));
    expect(await r2.json()).toMatchObject({ tipo: "nada" });
  });
  test("llamada abandonada (la página dejó de consultar más de 15 s) → el puente recibe colgar", async () => {
    abrirLlamada("hilo-viejo", ANA.nombre, ANA.desde);
    const real = Date.now;
    Date.now = () => real() + 16_000; // pasan 16 s sin que la página consulte acciones
    try {
      const r = await (await ruta("puente/espera")).GET(new Request("http://x/api/voz/puente/espera?ocupada=1&seg_hora=10&activa=hilo-viejo&ms=100", { headers: { "x-voz-token": TOKEN } }));
      expect(await r.json()).toMatchObject({ tipo: "colgar", hilo: "hilo-viejo", motivo: "la página dejó de responder" });
    } finally { Date.now = real; }
  });
  test("puente vivo que no contesta → 503 tras el plazo", async () => {
    await pedirEspera();
    const r = await ofertar(ANA);
    expect(r.status).toBe(503);
  });
  test("acciones: solo el dueño; una llamada que ya no existe → 404; colgar encola el comando para el puente", async () => {
    abrirLlamada("h1", ANA.nombre, ANA.desde);
    encolar("h1", { tipo: "navegar", vista: "tablero" });
    expect((await (await ruta("acciones")).GET(new Request("http://x/api/voz/acciones?hilo=h1", { headers: cookie(BETO) }))).status).toBe(403);
    const ok = await (await ruta("acciones")).GET(new Request("http://x/api/voz/acciones?hilo=h1", { headers: cookie(ANA) }));
    expect((await ok.json()).acciones).toEqual([{ tipo: "navegar", vista: "tablero" }]);
    expect((await (await ruta("colgar")).POST(new Request("http://x/api/voz/colgar?hilo=h1&motivo=listo", { method: "POST", headers: cookie(ANA) }))).status).toBe(200);
    expect(await (await pedirEspera()).json()).toMatchObject({ tipo: "colgar", hilo: "h1", motivo: "listo" });
    expect((await (await ruta("acciones")).GET(new Request("http://x/api/voz/acciones?hilo=h1", { headers: cookie(ANA) }))).status).toBe(404);
  });
  test("interruptor apagado → no disponible y la oferta da 503", async () => {
    await pedirEspera();
    process.env.AGENTETVN_VOZ = "off";
    expect(await (await (await ruta("estado")).GET(new Request("http://x/api/voz/estado", { headers: cookie(ANA) }))).json()).toMatchObject({ disponible: false });
    expect((await ofertar(ANA)).status).toBe(503);
  });
});

describe("rutas del puente (token)", () => {
  test("espera, respuesta, herramienta y fin exigen el token", async () => {
    expect((await (await ruta("puente/espera")).GET(new Request("http://x/api/voz/puente/espera"))).status).toBe(401);
    expect((await (await ruta("puente/respuesta")).POST(new Request("http://x/api/voz/puente/respuesta", { method: "POST", body: "{}" }))).status).toBe(401);
    expect((await (await ruta("herramienta")).POST(new Request("http://x/api/voz/herramienta", { method: "POST", body: "{}", headers: { "x-voz-token": "otro" } }))).status).toBe(401);
    expect((await (await ruta("fin")).POST(new Request("http://x/api/voz/fin", { method: "POST", body: "{}" }))).status).toBe(401);
  });
  test("herramienta: lista cerrada y llamada existente", async () => {
    abrirLlamada("h1", ANA.nombre, ANA.desde);
    const H = await ruta("herramienta");
    const pedir = (nombre: string, hilo = "h1") => H.POST(new Request("http://x/api/voz/herramienta", { method: "POST", headers: { "content-type": "application/json", "x-voz-token": TOKEN }, body: JSON.stringify({ hilo, nombre, args: { destino: "agenda" } }) }));
    expect((await pedir("borrar_todo")).status).toBe(400);
    expect((await pedir("navegar", "no-existe")).status).toBe(404);
    expect((await (await pedir("navegar")).json()).texto).toContain("agenda");
  });
  test("fin: el corte del puente le llega a la página como acción «colgada»", async () => {
    abrirLlamada("h1", ANA.nombre, ANA.desde);
    await (await ruta("fin")).POST(new Request("http://x/api/voz/fin", { method: "POST", headers: { "x-voz-token": TOKEN, "content-type": "application/json" }, body: JSON.stringify({ hilo: "h1", motivo: "tope de 3 minutos" }) }));
    const r = await (await ruta("acciones")).GET(new Request("http://x/api/voz/acciones?hilo=h1", { headers: cookie(ANA) }));
    expect((await r.json()).acciones).toEqual([{ tipo: "colgada", motivo: "tope de 3 minutos" }]);
  });
});
