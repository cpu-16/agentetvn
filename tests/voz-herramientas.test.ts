// Jarvis-TVN · herramientas de la voz: catálogo fijo, registro por dueño, corpus sin ampliar, navegar sin adivinar.
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { contextoDesdeMesa, explicacionFija } from "../src/lib/voz/catalogo";
import { _vaciarRegistro, abrirLlamada, encolar, esDueno, guardarContexto, sacarAcciones } from "../src/lib/voz/registro";

let h: typeof import("../src/lib/voz/herramientas");
let servicio: typeof import("../src/lib/motor/servicio");
beforeAll(async () => {
  process.env.AGENTETVN_VERIFICAR_MANIFEST = "0";
  process.env.AGENTETVN_MODO = "offline"; // sin LLM: respuestas extractivas deterministas
  h = await import("../src/lib/voz/herramientas");
  servicio = await import("../src/lib/motor/servicio");
});
beforeEach(() => { _vaciarRegistro(); abrirLlamada("h1", "Ana", "2026-10-06T10:00:00Z"); });

describe("catálogo", () => {
  test("cada vista y pestaña tiene su texto fijo", () => {
    for (const vista of ["portada", "agenda", "tablero", "control"] as const) expect(explicacionFija({ vista }).length).toBeGreaterThan(80);
    expect(explicacionFija({ vista: "ficha", pestana: "paquete" })).toContain("Aprobar no publica");
    expect(explicacionFija({ vista: "ficha" })).toContain("Evidencia");
  });
  test("contexto desde el store", () => {
    expect(contextoDesdeMesa({ vista: "tablero", eventoId: null, pantalla: { filtroTablero: "Economía" } })).toEqual({ vista: "tablero", eventoId: null, filtroTablero: "Economía" });
  });
});

describe("registro", () => {
  test("solo el dueño (persona + inicio de sesión) ve su llamada; las acciones se sacan una vez", () => {
    expect(esDueno("h1", "Ana", "2026-10-06T10:00:00Z")).toBe(true);
    expect(esDueno("h1", "Ana", "2026-10-06T11:00:00Z")).toBe(false);
    expect(esDueno("otro", "Ana", "2026-10-06T10:00:00Z")).toBe(false);
    encolar("h1", { tipo: "navegar", vista: "tablero" });
    expect(sacarAcciones("h1")).toHaveLength(1);
    expect(sacarAcciones("h1")).toHaveLength(0);
  });
});

describe("herramientas", () => {
  test("navegar a una sección permitida encola la acción; un destino fuera de la lista no", () => {
    expect(h.navegar("h1", { destino: "tablero" })).toContain("tablero");
    expect(sacarAcciones("h1")).toEqual([{ tipo: "navegar", vista: "tablero" }]);
    expect(h.navegar("h1", { destino: "borrar" })).toContain("No puedo abrir");
    expect(sacarAcciones("h1")).toHaveLength(0);
  });
  test("ficha por titular: única → abre; ninguna → no abre; empate → opciones sin abrir", () => {
    const snap = servicio.snapshot();
    const tituloDe = (id: string) => snap.noticias.find((n) => n.id_noticia === id)!.titulo;
    // un tema cuyo titular lo encuentra solo a él (sin empate)
    const ev = snap.eventos.find((e) => { if (e.no_confiable) return false; const r = h.buscarEventos(tituloDe(e.representante)); return r[0]?.id === e.id && (r.length === 1 || r[1].score < r[0].score); })!;
    const titulo = tituloDe(ev.representante);
    expect(h.navegar("h1", { destino: "ficha", consulta: titulo })).toContain("Abrí");
    expect(sacarAcciones("h1")).toEqual([{ tipo: "navegar", vista: "ficha", eventoId: ev.id }]);
    expect(h.navegar("h1", { destino: "ficha", consulta: "zzzz qwerty inexistente" })).toContain("No encontré");
    expect(sacarAcciones("h1")).toHaveLength(0);
    expect(h.navegar("h1", { destino: "ficha", consulta: "Panamá" })).toContain("varios temas"); // muchos titulares empatan: pregunta, no abre
    expect(sacarAcciones("h1")).toHaveLength(0);
  });
  test("preguntarCorpus: un eventoId inexistente no amplía la búsqueda", async () => {
    const t = await h.preguntarCorpus("h1", { pregunta: "inflación", eventoId: "ev_no_existe" });
    expect(t).toContain("no está en el corte");
    expect(sacarAcciones("h1")).toHaveLength(0);
  });
  test("preguntarCorpus responde con «Según…» o se abstiene, y encola la respuesta completa para el hilo", async () => {
    const t = await h.preguntarCorpus("h1", { pregunta: "¿Qué se sabe del Canal de Panamá?" });
    expect(t.length).toBeGreaterThan(20);
    const [a] = sacarAcciones("h1");
    expect(a.tipo).toBe("mostrar");
  });
  test("explicarPantalla usa el texto fijo y el resumen de la ficha abierta", async () => {
    const ev = servicio.snapshot().eventos[0];
    guardarContexto("h1", { vista: "ficha", eventoId: ev.id, pestana: "evidencia" });
    const t = await h.explicarPantalla("h1");
    expect(t).toContain("Evidencia");
    expect(t).toContain(`P ${ev.P}`);
  });
});

describe("servicio.consulta", () => {
  test("eventoId inexistente → abstención, no búsqueda en todo el corpus", async () => {
    const r = await servicio.consulta("inflación", undefined, "ev_no_existe");
    expect(r.abstener).toBe(true);
    expect(r.motivo).toContain("no existe");
  });
});
