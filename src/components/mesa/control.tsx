"use client";
import { useEffect, useState } from "react";
import { fetchMesa, horaPanama, TEMA_LABEL } from "@/store/mesa";
import { Button } from "@/components/ui/button";

const PRUEBAS = ["T01 Archivo con fechas inválidas y nulos", "T02 Tres registros del mismo evento", "T03 Noticia antigua recirculada", "T04 Cifra anual del Banco Mundial", "T05 Dos afirmaciones incompatibles", "T06 Consulta sin respuesta en el corpus", "T07 Fuente que exige ignorar instrucciones", "T08 Caso de prioridad alta", "T09 Brief editorial", "T10 Sin internet durante la demo"];

interface F1 { macro_f1: number; exactitud: number }
interface PR { precision: number; recall: number; f1: number; tp: number; fp: number; fn: number }
interface Consultas { n: number; sustentadas: { ok: number; n: number; hit5: number }; contradiccion: { ok: number; n: number }; abstencion: { correctas: number; n: number; abstenciones_incorrectas: number; de_respondibles: number }; adversarial: { resistidos: number; n: number }; cobertura_citas: { con_cita: number; n: number }; ms: { mediana: number; p95: number } }
interface Benchmark { fecha: string; split: string; temas?: { n: number; etiquetadores: string[]; metodo?: string; zero_shot: F1 | null; knn_loo: F1 | null; baseline: F1 }; pares?: { n: number; umbral: number; ia: PR; baseline: PR }; consultas?: { embeddings: Consultas; bm25: Consultas } }

function Barra({ etiqueta, ia, base, n, formato = (x: number) => `${Math.round(x * 100)} %` }: { etiqueta: string; ia: number | null; base: number; n: string; formato?: (x: number) => string }) {
  const fila = (nombre: string, v: number | null, clase: string) => (
    <div className="grid grid-cols-[88px_1fr_56px] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{nombre}</span>
      <span className="h-2.5 overflow-hidden rounded-sm bg-papel"><span className={`block h-full ${clase}`} style={{ width: `${Math.max(2, Math.min(100, (v ?? 0) * 100))}%` }} /></span>
      <span className="tabular-nums">{v === null ? "sin dato" : formato(v)}</span>
    </div>
  );
  return (
    <div className="rounded-sm border border-border bg-white p-3">
      <p className="mb-2 text-sm font-medium">{etiqueta} <span className="font-normal text-muted-foreground">({n})</span></p>
      <div className="space-y-1.5">{fila("IA", ia, "bg-tinta")}{fila("Baseline", base, "bg-[oklch(0.72_0.08_250)]")}</div>
    </div>
  );
}

function SeccionIA({ b }: { b: Benchmark | null }) {
  if (!b) return <div className="rounded-sm border border-dashed border-border bg-white p-4 text-sm text-muted-foreground">Todavía no se ha corrido la comparación. El equipo técnico la genera con las mismas preguntas para los dos buscadores (comando: <code className="rounded-sm bg-papel px-1">bun run benchmark --split dev</code>).</div>;
  const c = b.consultas;
  const r = (x: number, y: number) => (y ? x / y : 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">La búsqueda por sentido (IA: embeddings locales) frente a la búsqueda por palabras (baseline: BM25 y palabras clave), con las mismas preguntas y las mismas etiquetas humanas. Conjunto {b.split === "dev" ? "de desarrollo" : "reservado"}, {horaPanama(b.fecha)}.</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {b.temas && <Barra etiqueta="Acierto al clasificar el tema (macro-F1)" ia={(b.temas.knn_loo ?? b.temas.zero_shot)?.macro_f1 ?? null} base={b.temas.baseline.macro_f1} n={`${b.temas.n} titulares etiquetados por ${b.temas.etiquetadores.join(", ")}${b.temas.knn_loo ? "; vecinos más cercanos, dejando uno fuera (kNN LOO)" : "; sin etiquetas de entrenamiento (zero-shot)"}`} />}
        {b.pares && <Barra etiqueta="Acierto al agrupar el mismo evento (F1 de pares)" ia={b.pares.ia.f1} base={b.pares.baseline.f1} n={`${b.pares.n} pares, umbral ${b.pares.umbral}`} />}
        {c && <Barra etiqueta="La evidencia esperada aparece entre las 5 primeras (Hit@5)" ia={r(c.embeddings.sustentadas.hit5, c.embeddings.sustentadas.n)} base={r(c.bm25.sustentadas.hit5, c.bm25.sustentadas.n)} n={`${c.embeddings.sustentadas.hit5}/${c.embeddings.sustentadas.n} frente a ${c.bm25.sustentadas.hit5}/${c.bm25.sustentadas.n}`} />}
        {c && <Barra etiqueta="Abstención correcta" ia={r(c.embeddings.abstencion.correctas, c.embeddings.abstencion.n)} base={r(c.bm25.abstencion.correctas, c.bm25.abstencion.n)} n={`${c.embeddings.abstencion.correctas}/${c.embeddings.abstencion.n}; abstenciones indebidas ${c.embeddings.abstencion.abstenciones_incorrectas}/${c.embeddings.abstencion.de_respondibles}`} />}
        {c && <Barra etiqueta="Resistencia a inyección" ia={r(c.embeddings.adversarial.resistidos, c.embeddings.adversarial.n)} base={r(c.bm25.adversarial.resistidos, c.bm25.adversarial.n)} n={`${c.embeddings.adversarial.resistidos}/${c.embeddings.adversarial.n} ataques resistidos`} />}
        {c && <Barra etiqueta="Cobertura de citas" ia={r(c.embeddings.cobertura_citas.con_cita, c.embeddings.cobertura_citas.n)} base={r(c.bm25.cobertura_citas.con_cita, c.bm25.cobertura_citas.n)} n={`${c.embeddings.cobertura_citas.con_cita}/${c.embeddings.cobertura_citas.n} afirmaciones con cita`} />}
      </div>
      {c && <p className="text-xs text-muted-foreground">Tiempo por consulta: por sentido, la mitad responde en {c.embeddings.ms.mediana} ms o menos (el 95 % en {c.embeddings.ms.p95} ms; mediana y p95); por palabras, {c.bm25.ms.mediana} ms y {c.bm25.ms.p95} ms. Numeradores y denominadores completos en el archivo benchmark-{b.split}.json del repositorio.</p>}
    </div>
  );
}

interface Control {
  manifest: { version: string; fecha_corte_UTC: string; cantidades: Record<string, number>; sha256: Record<string, string>; discrepancias_pdf: string[]; transformaciones: string[]; licencias: Record<string, string> };
  calidad: { errores: { archivo: string; fila: number; campo: string; motivo: string }[]; noticias_validas: number; indicadores_validos: number; indicadores_nulos: number } | null;
  motor: { modoIA: string; modelo: string | null; reglas: string; eventos: number; por_tema: Record<string, number>; rangos: Record<string, number>; ms: number } | null;
  reglas: { version: string; fecha: string; pesos: Record<string, number>; justificacion: string };
  benchmark: Benchmark | null;
  pruebas: { id: string; nombre: string; esperado: string; estado: string; resultado: string; commit?: string; fecha?: string; correccion?: string }[] | null;
  modo: string;
  decisiones: { id: string; titulo: string; alternativa: string; motivo: string; persona: string; createdAt: string }[];
  revisiones: number;
}

export function Control() {
  const [c, setC] = useState<Control | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cargar = () => fetchMesa("/api/control").then(async (r) => { if (!r.ok) throw new Error("No se pudo cargar el control. Avisa al equipo técnico."); setC(await r.json()); }).catch((e) => setError(e instanceof TypeError ? "No hubo conexión. Revisa la red e intenta otra vez." : e.message));
  useEffect(() => { void cargar(); }, []);
  const reintentar = () => { setError(null); void cargar(); };
  if (error) return <div className="flex flex-wrap items-center gap-3 text-sm" role="alert"><p>{error}</p><Button size="sm" variant="outline" onClick={reintentar}>Reintentar</Button></div>;
  if (!c) return <p className="p-4 text-sm text-muted-foreground" aria-live="polite">Cargando…</p>;
  const pruebasPorId = new Map((c.pruebas ?? []).map((p) => [p.id, p]));
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Control y evaluación</h1>
        <p className="text-sm text-muted-foreground">{c.modo === "offline" ? "Funciona sin internet (modo offline)" : `Modo ${c.modo}`}. {c.revisiones} decisiones de revisión guardadas.</p>
      </div>
      <Seccion titulo="Datos del corte (snapshot)">
        <Tabla filas={[["Versión", c.manifest.version], ["Fecha de corte (UTC)", c.manifest.fecha_corte_UTC], ["Corte en hora Panamá", horaPanama(c.manifest.fecha_corte_UTC)], ...Object.entries(c.manifest.cantidades).map(([k, v]) => [k, String(v)] as [string, string]), ...Object.entries(c.manifest.sha256).map(([k, v]) => [`SHA-256 ${k}`, `${v.slice(0, 16)}…`] as [string, string])]} />
        <h3 className="mt-3 text-sm font-medium">Discrepancias del PDF del reto</h3>
        <ul className="list-disc pl-5 text-sm">{c.manifest.discrepancias_pdf.map((d, i) => <li key={i}>{d}</li>)}</ul>
        <h3 className="mt-3 text-sm font-medium">Transformaciones</h3>
        <ul className="list-disc pl-5 text-sm">{c.manifest.transformaciones.map((d, i) => <li key={i}>{d}</li>)}</ul>
      </Seccion>
      <Seccion titulo="Calidad de carga (T01)">
        {c.calidad ? (
          <>
            <p className="text-sm">{c.calidad.noticias_validas} noticias válidas, {c.calidad.indicadores_validos} celdas de indicadores ({c.calidad.indicadores_nulos} nulas conservadas). {c.calidad.errores.length} errores separados.</p>
            {c.calidad.errores.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs">{c.calidad.errores.slice(0, 30).map((e, i) => <li key={i}>{e.archivo} fila {e.fila}, {e.campo}: {e.motivo}</li>)}</ul>}
          </>
        ) : <p className="text-sm text-muted-foreground">Pendiente: el equipo técnico aún no corrió el motor sobre este corte.</p>}
      </Seccion>
      <Seccion titulo="Motor e IA">
        {c.motor ? (
          <Tabla filas={[["Modo IA", c.motor.modoIA], ["Modelo", c.motor.modelo ?? "ninguno (léxico)"], ["Reglas", c.motor.reglas], ["Eventos", String(c.motor.eventos)], ["Por tema", Object.entries(c.motor.por_tema).map(([t, n]) => `${TEMA_LABEL[t] ?? t} ${n}`).join(", ")], ["Rangos", `alto ${c.motor.rangos.alto}, medio ${c.motor.rangos.medio}, bajo ${c.motor.rangos.bajo}`], ["Tiempo del lote", `${c.motor.ms} ms`]]} />
        ) : <p className="text-sm text-muted-foreground">Pendiente.</p>}
      </Seccion>
      <Seccion titulo={`Reglas de puntaje ${c.reglas.version} (${c.reglas.fecha})`}>
        <p className="text-sm">P = {Object.entries(c.reglas.pesos).map(([k, v]) => `${v}${k}`).join(" + ")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{c.reglas.justificacion}</p>
      </Seccion>
      <Seccion titulo="Búsqueda por sentido frente a búsqueda por palabras (IA frente a baseline)">
        <SeccionIA b={c.benchmark} />
      </Seccion>
      <Seccion titulo="Pruebas de aceptación T01 a T10">
        <ul className="escaleta rounded-sm border border-border bg-white text-sm">
          {PRUEBAS.map((p) => {
            const id = p.slice(0, 3);
            const r = pruebasPorId.get(id);
            return (
              <li key={id} className="grid gap-x-4 gap-y-1 px-3 py-2 sm:grid-cols-[320px_1fr]">
                <span className="font-medium">{p}</span>
                <span>
                  <span className={r ? (r.estado === "pasa" ? "text-verde" : "text-senal") : "text-muted-foreground"}>{r ? `${r.estado}, ${r.resultado}${r.commit ? ` (commit ${r.commit.slice(0, 7)})` : ""}${r.fecha ? `, ${horaPanama(r.fecha)}` : ""}` : "pendiente"}</span>
                  {r?.esperado && <span className="block text-xs text-muted-foreground">Esperado: {r.esperado}</span>}
                  {r?.correccion && <span className="block text-xs">Corrección: {r.correccion}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </Seccion>
      <Seccion titulo="Decisiones registradas">
        {c.decisiones.length ? <ul className="space-y-2 text-sm">{c.decisiones.map((d) => <li key={d.id}><span className="font-medium">{d.titulo}</span> ({d.persona}, {horaPanama(d.createdAt)}). Alternativa descartada: {d.alternativa}. Motivo: {d.motivo}</li>)}</ul> : <p className="text-sm text-muted-foreground">Las decisiones de diseño están en docs/notion/02-plan-y-decisiones.md y en Notion.</p>}
      </Seccion>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const guia = titulo.startsWith("Datos del corte") ? "control-datos" : titulo.startsWith("Reglas de puntaje") ? "control-reglas" : titulo.startsWith("Búsqueda por sentido") ? "control-ia" : titulo.startsWith("Pruebas de aceptación") ? "control-pruebas" : titulo.startsWith("Decisiones") ? "control-decisiones" : undefined;
  return <section data-guia={guia} className="border-t border-tinta pt-3"><h2 className="mb-2 text-lg font-semibold">{titulo}</h2>{children}</section>;
}
function Tabla({ filas }: { filas: [string, string][] }) {
  return <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[220px_1fr]">{filas.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="break-all">{v}</dd></div>)}</dl>;
}
