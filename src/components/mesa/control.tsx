"use client";
import { useEffect, useState } from "react";
import { horaPanama, TEMA_LABEL } from "@/store/mesa";

const PRUEBAS = ["T01 Archivo con fechas inválidas y nulos", "T02 Tres registros del mismo evento", "T03 Noticia antigua recirculada", "T04 Cifra anual del Banco Mundial", "T05 Dos afirmaciones incompatibles", "T06 Consulta sin respuesta en el corpus", "T07 Fuente que exige ignorar instrucciones", "T08 Caso de prioridad alta", "T09 Brief editorial", "T10 Sin internet durante la demo"];

interface Control {
  manifest: { version: string; fecha_corte_UTC: string; cantidades: Record<string, number>; sha256: Record<string, string>; discrepancias_pdf: string[]; transformaciones: string[]; licencias: Record<string, string> };
  calidad: { errores: { archivo: string; fila: number; campo: string; motivo: string }[]; noticias_validas: number; indicadores_validos: number; indicadores_nulos: number } | null;
  motor: { modoIA: string; modelo: string | null; reglas: string; eventos: number; por_tema: Record<string, number>; rangos: Record<string, number>; ms: number } | null;
  reglas: { version: string; fecha: string; pesos: Record<string, number>; justificacion: string };
  benchmark: { split: string; filas: { metrica: string; ia: string; baseline: string; n: string }[] } | null;
  pruebas: { id: string; nombre: string; esperado: string; estado: string; resultado: string; commit?: string; fecha?: string; correccion?: string }[] | null;
  modo: string;
  decisiones: { id: string; titulo: string; alternativa: string; motivo: string; persona: string; createdAt: string }[];
  revisiones: number;
}

export function Control() {
  const [c, setC] = useState<Control | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetch("/api/control").then(async (r) => { if (!r.ok) throw new Error(`No cargó el control (${r.status}).`); setC(await r.json()); }).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="text-sm">{error}</p>;
  if (!c) return <p className="p-4 text-sm text-muted-foreground">Cargando…</p>;
  const pruebasPorId = new Map((c.pruebas ?? []).map((p) => [p.id, p]));
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Control y evaluación</h1>
        <p className="text-sm text-muted-foreground">Modo {c.modo}. {c.revisiones} decisiones de revisión guardadas.</p>
      </div>
      <Seccion titulo="Snapshot">
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
        ) : <p className="text-sm text-muted-foreground">Pendiente: corre bun run motor.</p>}
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
      <Seccion titulo="IA frente a baseline">
        {c.benchmark ? (
          <table className="w-full text-sm"><thead><tr className="border-b border-tinta text-left"><th className="py-1">Métrica</th><th>IA</th><th>Baseline</th><th>n</th></tr></thead><tbody>{c.benchmark.filas.map((f, i) => <tr key={i} className="border-b border-border"><td className="py-1">{f.metrica}</td><td>{f.ia}</td><td>{f.baseline}</td><td>{f.n}</td></tr>)}</tbody></table>
        ) : <p className="text-sm text-muted-foreground">Pendiente: bun run benchmark.</p>}
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
  return <section className="border-t border-tinta pt-3"><h2 className="mb-2 text-lg font-semibold">{titulo}</h2>{children}</section>;
}
function Tabla({ filas }: { filas: [string, string][] }) {
  return <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[220px_1fr]">{filas.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="break-all">{v}</dd></div>)}</dl>;
}
