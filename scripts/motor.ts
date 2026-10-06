// ─────────────────────────────────────────────────────────────
// motor · del snapshot a la agenda: embeddings → temas → eventos → contexto → contradicciones → P → fichas base.
//   bun run motor              (escribe data/processed/{calidad.json, embeddings.json, eventos.json, fichas.jsonl})
// Determinista para un mismo snapshot y reglas (fecha de referencia = manifest.fecha_corte_UTC).
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "fs";
import { cargarSnapshot } from "../src/lib/motor/cargar";
import { aLista, coseno, embeber, MODELO, modeloDisponible } from "../src/lib/motor/embeddings";
import { clasificarKnn, clasificarTema, etiquetasConVector, SECCION_A_TEMA, temaPorPalabras, vectoresTemas } from "../src/lib/motor/temas";
import { agruparEventos } from "../src/lib/motor/eventos";
import { vincularContexto } from "../src/lib/motor/contexto";
import { detectarContradicciones, estadoEvidencia } from "../src/lib/motor/evidencia";
import { ordenar, puntuar } from "../src/lib/motor/puntaje";
import { esNoConfiable } from "../src/lib/motor/inyeccion";
import { leerScoring } from "../src/lib/motor/config";
import { nuevaNoticia } from "../src/lib/ingesta/comun";
import { escribirJson } from "../src/lib/ingesta/escribir";
import type { Evento, Ficha, Noticia } from "../src/lib/motor/contrato";

const t0 = Date.now();
const log = (s: string) => console.log(`[motor +${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
const OUT = process.env.AGENTETVN_DATOS ?? "data/processed";
const cfg = leerScoring();
const snap = cargarSnapshot(OUT, { forzar: true });
// idempotencia: el motor parte del CSV crudo, no de su salida anterior
{
  const { validarNoticias } = await import("../src/lib/motor/validar");
  const { leerCsv } = await import("../src/lib/motor/cargar");
  snap.noticias = validarNoticias(leerCsv(`${OUT}/noticias.csv`)).validas;
}
const corte = snap.manifest.fecha_corte_UTC;

// 1 · calidad (T01)
escribirJson(`${OUT}/calidad.json`, { fecha: new Date().toISOString(), noticias_validas: snap.noticias.length, indicadores_validos: snap.indicadores.length, indicadores_nulos: snap.indicadores.filter((i) => i.valor === null).length, sismos: snap.sismos.length, errores: snap.errores });
log(`cargadas ${snap.noticias.length} noticias, ${snap.indicadores.length} indicadores, ${snap.sismos.length} sismos · ${snap.errores.length} errores separados`);

// 2 · sintéticas (marcadas) + detector de inyección
const sinteticas: Noticia[] = (JSON.parse(readFileSync("data/sinteticas.json", "utf8")) as { clave: string; titulo: string; descripcion: string; url: string; medio: string; fecha_publicacion: string }[]).map((s) =>
  nuevaNoticia({ titulo: s.titulo, descripcion: s.descripcion, url: s.url, medio: s.medio, idioma: "es", fecha_publicacion: s.fecha_publicacion, fecha_deteccion: null, fecha_extraccion: corte, origen: "sintetica", sintetica: true })
);
const noticias: Noticia[] = [...snap.noticias.filter((n) => !n.sintetica), ...sinteticas].map((n) => {
  const d = esNoConfiable(`${n.titulo} ${n.descripcion}`);
  return { ...n, no_confiable: d.no_confiable };
});
log(`${sinteticas.length} sintéticas añadidas · ${noticias.filter((n) => n.no_confiable).length} no confiables`);

// 3 · embeddings (IA) con fallback declarado
const porId = new Map(noticias.map((n) => [n.id_noticia, n]));
const vecs = new Map<string, Float32Array>();
let modoIA = "embeddings";
if (await modeloDisponible()) {
  const textos = noticias.map((n) => `${n.titulo}. ${n.descripcion}`.slice(0, 600));
  const v = await embeber(textos, "passage");
  noticias.forEach((n, i) => vecs.set(n.id_noticia, v[i]));
  escribirJson(`${OUT}/embeddings.json`, { modelo: MODELO, dim: v[0]?.length ?? 0, ids: noticias.map((n) => n.id_noticia), vectores: v.map(aLista) });
  log(`embeddings ${MODELO}: ${v.length} vectores`);
} else {
  modoIA = "lexico";
  log("modelo ausente: modo léxico (temas por palabras, eventos por Jaccard)");
}

// 4 · temas: kNN si hay ≥30 etiquetas humanas (con el vector precalculado), si no zero-shot por prototipos
const temasVec = modoIA === "embeddings" ? await vectoresTemas() : [];
const etiquetas = modoIA === "embeddings" ? etiquetasConVector({ ids: noticias.map((n) => n.id_noticia), vectores: noticias.map((n) => Array.from(vecs.get(n.id_noticia)!)) }) : [];
const usarKnn = etiquetas.length >= 30;
log(`temas: ${usarKnn ? `kNN con ${etiquetas.length} etiquetas humanas` : "zero-shot por prototipos (sin etiquetas suficientes)"}`);
const temaDe = new Map<string, { tema: string; confianza: number; por_revisar: boolean }>();
for (const n of noticias) {
  const base = temaPorPalabras(`${n.titulo} ${n.descripcion}`);
  const porSeccion = n.seccion ? SECCION_A_TEMA[n.seccion] : undefined;
  if (porSeccion === "deportes") {
    temaDe.set(n.id_noticia, { tema: "deportes", confianza: 1, por_revisar: false });
    continue;
  }
  if (modoIA === "embeddings") {
    const c = usarKnn ? clasificarKnn(vecs.get(n.id_noticia)!, etiquetas, 5, n.id_noticia) : clasificarTema(vecs.get(n.id_noticia)!, temasVec, cfg.temas);
    // si la IA duda y el baseline tiene señal clara, se usa el baseline pero queda «por revisar»
    temaDe.set(n.id_noticia, c.por_revisar && base ? { tema: base, confianza: c.confianza, por_revisar: true } : c);
  } else temaDe.set(n.id_noticia, { tema: base ?? "otro", confianza: base ? 0.5 : 0, por_revisar: !base });
}
const noticiasConTema = noticias.map((n) => ({ ...n, tema: temaDe.get(n.id_noticia)!.tema }));

// 5 · eventos y procedencias
const bases = agruparEventos(noticiasConTema, vecs, cfg.N);
log(`${bases.length} eventos de ${noticias.length} publicaciones`);

// 6 · novedad: ¿hay un evento más viejo semánticamente igual (segunda ola)?
const repVec = (b: (typeof bases)[number]) => vecs.get(b.representante);
const fechaEv = (b: (typeof bases)[number]) => b.fecha_original ?? porId.get(b.representante)!.fecha_deteccion ?? corte;
const novedadDe = (b: (typeof bases)[number]): "primera" | "segunda_ola" => {
  const v = repVec(b);
  if (!v) return "primera";
  return bases.some((o) => o !== b && fechaEv(o) < fechaEv(b) && repVec(o) && coseno(v, repVec(o)!) >= cfg.N.umbral_mismo_evento) ? "segunda_ola" : "primera";
};

// 7 · contexto, contradicciones, puntaje, estado
const eventos: Evento[] = bases.map((b) => {
  const pubs = b.ids_noticia.map((i) => porId.get(i)!);
  const rep = porId.get(b.representante)!;
  const t = temaDe.get(b.representante)!;
  const texto = pubs.map((p) => `${p.titulo} ${p.descripcion}`).join(" ");
  const contexto = vincularContexto(texto, t.tema, b.fecha_original ?? rep.fecha_deteccion, snap.indicadores, snap.sismos);
  const contradicciones = detectarContradicciones(pubs);
  const r = puntuar({ publicaciones: pubs, procedencias: b.procedencias, tema: t.tema, por_revisar: t.por_revisar, contexto, contradicciones, novedad: novedadDe(b), fecha_original: b.fecha_original, corteUTC: corte, indicadores: snap.indicadores, sismos: snap.sismos }, cfg);
  const { P, rango, primaria, ...componentes } = r;
  return { ...b, tema: t.tema, tema_confianza: t.confianza, por_revisar: t.por_revisar, contexto, contradicciones, componentes, P, rango, estado_evidencia: estadoEvidencia(r.E, b.procedencias, primaria, contradicciones, pubs.some((p) => p.descripcion.length > 20), cfg.E) };
});
const ordenados = ordenar(eventos);
escribirJson(`${OUT}/eventos.json`, ordenados);

// 8 · fichas base (sin borrador; el paquete se genera en la app) y noticias con tema/no_confiable
const fichas: Ficha[] = ordenados.map((e) => ({ id_caso: e.id, modalidad: "tvn", ids_fuente: e.ids_noticia, afirmaciones: [], citas: [...e.ids_noticia, ...e.contexto.indicadores, ...e.contexto.sismos], puntaje: e.P, componentes: e.componentes, estado_evidencia: e.estado_evidencia, borrador: null, estado_revision: "nuevo", persona_revisora: null, sintetica: e.ids_noticia.some((i) => porId.get(i)!.sintetica) || undefined }));
writeFileSync(`${OUT}/fichas.jsonl`, fichas.map((f) => JSON.stringify(f)).join("\n") + "\n");
escribirJson(`${OUT}/noticias-motor.json`, noticiasConTema.map((n) => ({ ...n, no_confiable: n.no_confiable })));
escribirJson(`${OUT}/motor-meta.json`, { fecha: new Date().toISOString(), modoIA, clasificador: usarKnn ? `knn k=5 sobre ${etiquetas.length} etiquetas humanas (leave-one-out para las etiquetadas)` : "zero-shot por prototipos", modelo: modoIA === "embeddings" ? MODELO : null, reglas: cfg.version, corteUTC: corte, eventos: eventos.length, por_tema: Object.fromEntries([...new Set(eventos.map((e) => e.tema))].map((t) => [t, eventos.filter((e) => e.tema === t).length])), rangos: { alto: eventos.filter((e) => e.rango === "alto").length, medio: eventos.filter((e) => e.rango === "medio").length, bajo: eventos.filter((e) => e.rango === "bajo").length }, ms: Date.now() - t0 });
log(`listo · top 5: ${ordenados.slice(0, 5).map((e) => `${e.P} ${e.tema} «${porId.get(e.representante)!.titulo.slice(0, 50)}»`).join(" | ")}`);
