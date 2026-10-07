"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BotonCita } from "./citas";
import { TRANSICIONES, type RevisionHist } from "./paquete";
import { ESTADO_LABEL, fetchMesa, horaPanama, usePersona } from "@/store/mesa";
import type { BoletinBancario, EstadoRevision } from "@/lib/motor/contrato";

interface Detalle {
  boletin: BoletinBancario | null;
  revision: { id: string | null; estado: EstadoRevision; persona: string | null; motivo: string | null; createdAt: string | null; vigente: boolean };
  historial: RevisionHist[];
}
export function BancaYRevision({ eventoId, onCita }: { eventoId: string; onCita: (id: string) => void }) {
  const [d, setD] = useState<Detalle | null>(null);
  const [p, setP] = useState<BoletinBancario | null>(null);
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [fuentesRevisadas, setFuentesRevisadas] = useState(false);
  const persona = usePersona();
  const alive = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const url = "/api/eventos/" + encodeURIComponent(eventoId) + "/banca";
  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    fetchMesa(url, { signal: abort.signal }).then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "No se pudo cargar el boletín.");
      if (alive.current) { setD(j); setP(j.boletin); }
    }).catch((e) => { if (alive.current && e.name !== "AbortError") setMsg("No se pudo cargar el boletín. Reintenta."); });
    return () => { alive.current = false; abort.abort(); controller.current?.abort(); };
  }, [url]);
  const enviar = async (path: string, method: string, body: unknown) => {
    setOcupado(true); setMsg(null);
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetchMesa(path, { method, signal: abort.signal, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await response.json();
      if (!alive.current) return;
      if (!response.ok) return setMsg(j.error || "No se guardó el cambio.");
      const next = j.detalle ?? j;
      setD(next); setP(next.boletin); setEditando(false); setFuentesRevisadas(false);
      setMsg(j.nota ?? "Cambio guardado. La revisión bancaria es independiente.");
    } catch (e) { if (alive.current && (e as Error).name !== "AbortError") setMsg("No hubo conexión. Reintenta."); }
    finally { if (alive.current) setOcupado(false); }
  };
  const revisar = (estado: string, exigeMotivo?: boolean) => {
    if (exigeMotivo && !motivo.trim()) return setMsg("Esta decisión necesita un motivo.");
    if (estado === "aprobado_borrador" && (editando || !fuentesRevisadas)) return setMsg("Guarda el borrador y confirma la revisión de sus citas.");
    void enviar(url + "/revision", "POST", { estado, motivo: motivo.trim() || null, version: p?.updatedAt,
      revisionId: d?.revision.id, fuentesRevisadas });
  };
  const texto = (key: "titulo" | "horizonte", label: string) => p && <div>
    <h3 className="text-sm text-muted-foreground">{label}</h3>
    {editando ? <input aria-label={label} value={p[key]} onChange={(e) => setP({ ...p, [key]: e.target.value })} className="w-full rounded-sm border p-2" /> : <p className="text-sm">{p[key]}</p>}
  </div>;
  const palabras = p ? [p.titulo, ...p.sectores, p.horizonte, ...p.hechos.map((a) => a.texto),
    ...p.hipotesis.map((a) => a.texto), ...p.faltantes, ...p.preguntas, p.leyenda].join(" ").trim().split(/\s+/).filter(Boolean).length : 0;
  return <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
    <section className="space-y-4">
      <h2 className="titular text-xl font-semibold">Boletín para análisis bancario</h2>
      <p className="text-sm text-muted-foreground">Señales públicas para revisar sectores, horizonte y evidencia pendiente.</p>
      {!d && msg && <Button variant="outline" onClick={() => void enviar(url, "GET", undefined)}>Reintentar carga</Button>}
      {!p ? <Button disabled={ocupado || !d} onClick={() => void enviar(url, "POST", {})}>{ocupado ? "Preparando…" : "Generar boletín"}</Button> : <>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs">{palabras} de 250 palabras</span>
          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => editando
            ? void enviar(url, "PUT", { boletin: p, version: p.updatedAt }) : setEditando(true)}>{editando ? "Guardar edición" : "Editar"}</Button>
          <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => void enviar(url, "POST", { regenerar: true })}>Regenerar</Button>
        </div>
        {p.abstener && <p role="status" className="text-senal">Sin evidencia confiable: el boletín se abstiene.</p>}
        {texto("titulo", "Título")}
        <div><h3 className="text-sm text-muted-foreground">Sectores a verificar</h3><p className="text-sm">{p.sectores.join(", ")}</p></div>
        {texto("horizonte", "Horizonte por verificar")}
        {(["hechos", "hipotesis"] as const).map((key) => <div key={key}>
          <h3 className="mb-2 font-medium">{key === "hechos" ? "Hechos citados" : "Hipótesis por verificar"}</h3>
          <ul className="space-y-2">{p[key].map((a, i) => <li key={i} className="rounded-sm bg-white p-3 text-sm">
            {editando ? <textarea aria-label={(key === "hechos" ? "Hecho " : "Hipótesis ") + (i + 1)} value={a.texto} rows={2}
              onChange={(e) => setP({ ...p, [key]: p[key].map((x, n) => n === i ? { ...x, texto: e.target.value } : x) })} className="w-full border p-2" /> : a.texto}
            <BotonCita id={a.evidence_id} campo={a.campo} onAbrir={onCita} />
          </li>)}</ul>
        </div>)}
        <div><h3 className="font-medium">Evidencia faltante</h3><ul className="list-disc pl-5 text-sm">{p.faltantes.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
        <div><h3 className="font-medium">Tres preguntas para el analista</h3><ol className="list-decimal space-y-1 pl-5 text-sm">
          {p.preguntas.map((q, i) => <li key={i}>{editando ? <input aria-label={"Pregunta " + (i + 1)} value={q} onChange={(e) => {
            const questions = [...p.preguntas] as [string, string, string]; questions[i] = e.target.value; setP({ ...p, preguntas: questions });
          }} className="w-full border p-2" /> : q}</li>)}
        </ol></div>
        <p className="rounded-sm bg-[#fff8e1] p-3 text-xs">{p.leyenda}</p>
      </>}
    </section>
    <aside className="space-y-4">
      <div className="rounded-sm border border-tinta bg-white p-4">
        <h3 className="titular text-lg font-semibold">Revisión bancaria</h3>
        <p className="text-sm">Estado: {ESTADO_LABEL[d?.revision.estado ?? "nuevo"]}</p>
        {d?.revision.estado === "en_revision" && !d.revision.vigente && d.historial.some((h) => h.estado === "aprobado_borrador") &&
          <p className="mt-2 text-xs">La aprobación anterior corresponde a otra versión. Revisa el borrador actual.</p>}
        <p className="mt-2 text-xs">Responsable: {persona}</p>
        <label className="mt-3 block text-xs">Motivo
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="mt-1 w-full border p-2" />
        </label>
        <label className="mt-3 flex gap-2 text-xs">
          <input type="checkbox" checked={fuentesRevisadas} disabled={!p || editando || ocupado} onChange={(e) => setFuentesRevisadas(e.target.checked)} />
          Revisé las citas, el horizonte y el texto exacto de este borrador.
        </label>
        <div className="mt-3 flex flex-wrap gap-2">{(TRANSICIONES[d?.revision.estado ?? "nuevo"] ?? []).map((t) =>
          <Button key={t.a} size="sm" variant="outline" disabled={ocupado || !d} onClick={() => revisar(t.a, t.motivo)}>{t.label}</Button>)}</div>
        <p className="mt-3 text-xs font-medium">Aprobar como borrador no publica ni inicia una operación bancaria.</p>
        {msg && <p role="status" className="mt-2 text-xs">{msg}</p>}
      </div>
      {!!d?.historial.length && <div className="rounded-sm border bg-white p-4">
        <h3 className="font-medium">Historial bancario por versión</h3>
        <ol className="space-y-2 text-xs">{d.historial.map((h) => <li key={h.id}>{ESTADO_LABEL[h.estado]} por {h.persona}, {horaPanama(h.createdAt)}{h.motivo ? ". " + h.motivo : ""}</li>)}</ol>
      </div>}
    </aside>
  </div>;
}
