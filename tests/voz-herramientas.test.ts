// Jarvis-TVN · herramientas de la voz: catálogo fijo, registro por dueño, corpus sin ampliar, navegar sin adivinar.
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { contextoDesdeMesa, explicacionFija } from "../src/lib/voz/catalogo";
import { _vaciarRegistro, abrirLlamada, contextoDe, encolar, esDueno, guardarContexto, sacarAcciones } from "../src/lib/voz/registro";

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
  test("subir, bajar, ir al inicio o al final y volver atrás (con o sin tilde) encolan su acción", () => {
    expect(h.navegar("h1", { destino: "abajo" })).toContain("Bajé");
    expect(h.navegar("h1", { destino: "Arriba" })).toContain("Subí");
    expect(h.navegar("h1", { destino: "final" })).toContain("final");
    expect(h.navegar("h1", { destino: "atrás" })).toContain("anterior");
    expect(sacarAcciones("h1")).toEqual([{ tipo: "desplazar", direccion: "abajo" }, { tipo: "desplazar", direccion: "arriba" }, { tipo: "desplazar", direccion: "final" }, { tipo: "atras" }]);
    for (const raro of ["constructor", "__proto__", "toString"]) expect(h.navegar("h1", { destino: raro })).toContain("No puedo abrir"); // lista cerrada (revisión de Codex)
    expect(sacarAcciones("h1")).toHaveLength(0);
  });
  test("«siguiente» sin recorrido no abre nada; navegar a la sección abierta no borra sus filtros (revisión de Codex)", () => {
    expect(h.navegar("h1", { destino: "siguiente" })).toContain("No estamos en un recorrido");
    expect(sacarAcciones("h1")).toHaveLength(0);
    guardarContexto("h1", { vista: "agenda", filtrosAgenda: "tema economía" });
    h.navegar("h1", { destino: "agenda" }); sacarAcciones("h1");
    expect(contextoDe("h1")?.filtrosAgenda).toBe("tema economía");
  });
  test("recorrido guiado: cada «siguiente» muestra una parte (navega, resalta, demuestra) hasta terminar", () => {
    expect(h.navegar("h1", { destino: "recorrido" })).toContain("Empecemos. Arriba ves el corte");
    expect(h.navegar("h1", { destino: "siguiente" })).toContain("cinco temas");
    for (let i = 0; i < 20; i++) if (h.navegar("h1", { destino: "siguiente" }).includes("recorrido completo")) break;
    const acciones = sacarAcciones("h1") as unknown as { tipo: string; parte?: string; demo?: { tipo: string } }[];
    expect(acciones[0]).toMatchObject({ tipo: "guia", parte: "portada-cifras" });
    expect(acciones.some((a) => a.parte === "ficha-paquete" && a.demo?.tipo === "pestana")).toBe(true);
    expect(acciones.some((a) => a.parte === "tablero-temas" && a.demo?.tipo === "filtroTablero")).toBe(true);
  });
  test("el tope de minutos corta a mitad del recorrido: «sigue» en la llamada nueva retoma donde iba (prueba de Gilberto, 6-oct)", () => {
    h.navegar("h1", { destino: "recorrido" });
    for (let i = 0; i < 8; i++) h.navegar("h1", { destino: "siguiente" }); // va por tablero-medios (paso 9 de 12)
    abrirLlamada("h2", "Ana", "2026-10-06T10:00:00Z"); sacarAcciones("h1");
    expect(h.navegar("h2", { destino: "siguiente" })).toStartWith("Seguimos donde quedamos. Cada punto es un tema");
    expect(sacarAcciones("h2")).toMatchObject([{ tipo: "guia", parte: "tablero-relevancia" }]);
    expect(h.navegar("h2", { destino: "siguiente" })).not.toContain("Seguimos donde quedamos");
  });
  test("«explícame la parte de Control» abre Control; los roles y «dónde están los borradores» (prueba de Gilberto, 6-oct)", async () => {
    sacarAcciones("h1");
    expect(await h.explicarPantalla("h1", { sobre: "la parte de control" })).toContain("Estás en Control");
    expect(sacarAcciones("h1")).toEqual([{ tipo: "navegar", vista: "control" }]);
    expect(await h.explicarPantalla("h1", { sobre: "qué hace un periodista" })).toContain("Como periodista verificas");
    expect(await h.explicarPantalla("h1", { sobre: "los borradores" })).toContain("Paquete y revisión");
    expect(sacarAcciones("h1")).toMatchObject([{ tipo: "guia", parte: "ficha-paquete" }]);
  });
  test("explicar_pantalla con una parte concreta la muestra en la página", async () => {
    sacarAcciones("h1");
    expect(await h.explicarPantalla("h1", { sobre: "la gráfica de publicaciones por tema" })).toContain("Economía");
    expect(sacarAcciones("h1")).toMatchObject([{ tipo: "guia", parte: "tablero-temas", vista: "tablero" }]);
  });
  test("abrir una sección devuelve su explicación; explicar_pantalla sabe qué es la plataforma", async () => {
    sacarAcciones("h1");
    expect(h.navegar("h1", { destino: "agenda" })).toContain("Estás en la agenda");
    sacarAcciones("h1");
    expect(await h.explicarPantalla("h1", { sobre: "plataforma" })).toContain("AgenteTVN es la mesa editorial");
  });
  test("preguntar_corpus: «¿cuál es la noticia del día?» sale de la agenda del motor, no de la búsqueda", async () => {
    const t = await h.preguntarCorpus("h1", { pregunta: "¿Cuál es la noticia del día?" });
    const primero = servicio.snapshot().eventos.length > 0;
    expect(primero && t.startsWith("La que más merece revisión hoy es «")).toBe(true);
    sacarAcciones("h1");
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
    expect(t.split(/\s+/).length).toBeLessThanOrEqual(60); // la voz dice poco; el detalle queda en el panel
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
