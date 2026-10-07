"use client";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ESTADO_LABEL, SPRING, TIPO_LABEL, fetchMesa, horaPanama, useMesa, usePersona, useRol } from "@/store/mesa";
import { BotonCita } from "./citas";
import { cn } from "@/lib/utils";

export interface Afirmacion { texto: string; tipo: string; evidence_id: string; campo: string; alcance: string }
export interface Paquete { titulo: string; titulos?: string[]; enfoque: string; brief: Afirmacion[]; preguntas: string[]; verificaciones: string[]; guion: Afirmacion[]; copy: Afirmacion[]; leyenda: string; modo: string; persona?: string; updatedAt?: string; llm?: { modelo: string; ms: number; costo_usd: number | null; descartadas: string[] } }
export interface Revision { estado: string; persona: string | null; motivo: string | null; createdAt: string | null }
export interface RevisionHist { id: string; estado: string; persona: string; motivo: string | null; createdAt: string }

export const TRANSICIONES: Record<string, { a: string; label: string; motivo?: boolean; primario?: boolean }[]> = {
  nuevo: [{ a: "en_revision", label: "Tomar en revisión", primario: true }, { a: "descartado", label: "Descartar", motivo: true }],
  en_revision: [{ a: "aprobado_borrador", label: "Aprobar como borrador", primario: true }, { a: "requiere_evidencia", label: "Pedir evidencia", motivo: true }, { a: "descartado", label: "Descartar", motivo: true }],
  requiere_evidencia: [{ a: "en_revision", label: "Volver a revisión", primario: true }, { a: "descartado", label: "Descartar", motivo: true }],
  aprobado_borrador: [{ a: "en_revision", label: "Reabrir" }],
  descartado: [{ a: "en_revision", label: "Reabrir" }],
};
const palabras = (afs: Afirmacion[]) => afs.reduce((s, a) => s + a.texto.trim().split(/\s+/).filter(Boolean).length, 0);

function Afirmaciones({ lista, onCita, editable, onCambio }: { lista: Afirmacion[]; onCita: (id: string) => void; editable: boolean; onCambio: (i: number, texto: string) => void }) {
  return (
    <ul className="space-y-2">
      {lista.map((a, i) => (
        <li key={i} className={cn("bg-white px-3 py-2 text-sm", `tipo-${a.tipo}`)}>
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{TIPO_LABEL[a.tipo] ?? a.tipo}</span>
            <BotonCita id={a.evidence_id} campo={a.campo} onAbrir={onCita} />
          </div>
          {editable ? <textarea value={a.texto} onChange={(e) => onCambio(i, e.target.value)} rows={2} className="w-full rounded-sm border border-border p-2 text-sm" /> : <p>{a.texto}</p>}
        </li>
      ))}
    </ul>
  );
}

export function PaqueteYRevision({ eventoId, paquete, revision, historial, onCita, onCambio }: { eventoId: string; paquete: Paquete | null; revision: Revision; historial: RevisionHist[]; onCita: (id: string) => void; onCambio: () => void }) {
  const persona = usePersona();
  const rol = useRol();
  const reducir = useReducedMotion();
  const [p, setP] = useState<Paquete | null>(paquete);
  const [editando, setEditando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const nombre = persona.trim();
  const actualizarEstadoEvento = useMesa((s) => s.actualizarEstadoEvento);
  const sinRed = "No hubo conexión. Revisa la red e intenta otra vez.";

  const generar = async (regenerar = false) => {
    setOcupado(true); setMsg(null);
    try {
      const r = await fetchMesa(`/api/eventos/${eventoId}/paquete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ regenerar }) });
      if (!r.ok) return setMsg(r.status === 401 ? "Pasaron las 12 horas de la sesión; entra de nuevo." : "No se pudo generar el paquete. Avisa al equipo técnico.");
      setP(await r.json()); setEditando(false); onCambio();
    } catch { setMsg(sinRed); } finally { setOcupado(false); }
  };
  const guardar = async () => {
    if (!p) return;
    setOcupado(true);
    try {
      const r = await fetchMesa(`/api/eventos/${eventoId}/paquete`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ paquete: p }) });
      setMsg(r.ok ? "Edición guardada." : "No se guardó la edición. Avisa al equipo técnico.");
      if (r.ok) { setEditando(false); onCambio(); }
    } catch { setMsg(sinRed); } finally { setOcupado(false); }
  };
  const revisar = async (estado: string, exigeMotivo?: boolean) => {
    if (exigeMotivo && !motivo.trim()) return setMsg(`${ESTADO_LABEL[estado]} necesita un motivo.`);
    setOcupado(true);
    try {
      const r = await fetchMesa(`/api/eventos/${eventoId}/revision`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ estado, motivo: motivo.trim() || null }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setMsg(j.error ?? "No se pudo guardar el estado. Avisa al equipo técnico.");
      setMotivo(""); setMsg(`Estado guardado: ${ESTADO_LABEL[estado]}. ${j.nota ?? ""}`); actualizarEstadoEvento(eventoId, estado); onCambio();
    } catch { setMsg(sinRed); } finally { setOcupado(false); }
  };
  const cambiarLista = (clave: "brief" | "guion" | "copy") => (i: number, texto: string) => setP((q) => q && { ...q, [clave]: q[clave].map((a, j) => (j === i ? { ...a, texto } : a)) });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section>
        {!p ? (
          <div className="rounded-sm border border-dashed border-border bg-white p-6 text-sm">
            <p className="mb-3">Todavía no hay paquete para este tema. Se compone solo con afirmaciones citadas de las noticias del corte.</p>
            <Button onClick={() => generar()} disabled={ocupado} aria-busy={ocupado} variant={rol === "productor" ? "default" : "outline"}>{ocupado ? "Preparando el borrador…" : "Generar paquete"}</Button>
            {ocupado && <p role="status" className="mt-2 text-xs">Con IA tarda cerca de un minuto. Si sales, el trabajo sigue y queda guardado.</p>}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{p.modo === "llm" && p.llm ? `Borrador de IA, listo en ${Math.round(p.llm.ms / 1000)} s. Cada frase que ves se sostuvo en su cita; no sustituye la revisión humana.${p.llm.descartadas.length ? ` ${p.llm.descartadas.length} frase${p.llm.descartadas.length > 1 ? "s no se mostraron porque no coincidían" : " no se mostró porque no coincidía"} con su fuente.` : ""}` : p.modo === "extractivo" ? "Compuesto solo con afirmaciones citadas" : `Modo ${p.modo}`}</span>
              {ocupado && <span role="status" className="font-medium text-foreground">Preparando el borrador; con IA tarda cerca de un minuto. Si sales, el trabajo sigue y queda guardado.</span>}
              {p.updatedAt && <span>guardado {horaPanama(p.updatedAt)}{p.persona ? ` por ${p.persona}` : ""}</span>}
              <span className="ml-auto flex gap-2">
                {editando ? <Button size="sm" onClick={guardar} disabled={ocupado}>Guardar edición</Button> : <Button size="sm" variant="outline" onClick={() => setEditando(true)}>Editar</Button>}
                <Button size="sm" variant="ghost" onClick={() => generar(true)} disabled={ocupado}>Regenerar</Button>
              </span>
            </div>
            <div>
              <h3 className="text-sm text-muted-foreground">Título propuesto</h3>
              {editando ? <input value={p.titulo} onChange={(e) => setP({ ...p, titulo: e.target.value })} className="w-full rounded-sm border border-border bg-white p-2 text-lg" /> : <p className="titular text-xl font-semibold">{p.titulo}</p>}
            </div>
            {!!p.titulos?.length && (
              <div className={cn("rounded-sm border p-3", rol === "productor" ? "border-azul bg-[#eef6fc]" : "border-border")}>
                <h3 className="text-sm font-medium">Propuestas de titular para web y redes</h3>
                <p className="text-[11px] text-muted-foreground">La IA propone; cada una se comprobó contra las fuentes del tema. Elige una y guárdala: sigue sujeta a revisión.</p>
                <ol className="mt-2 space-y-1.5">
                  {p.titulos.map((t) => (
                    <li key={t} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="titular flex-1 font-semibold">{t}</span>
                      <Button size="sm" variant="outline" className="presionable h-7 px-2 text-xs" disabled={ocupado || p.titulo === t} onClick={() => { setP({ ...p, titulo: t }); setEditando(true); }}>{p.titulo === t ? "En uso" : "Usar"}</Button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div>
              <h3 className="text-sm text-muted-foreground">Enfoque de interés público</h3>
              {editando ? <textarea value={p.enfoque} onChange={(e) => setP({ ...p, enfoque: e.target.value })} rows={2} className="w-full rounded-sm border border-border bg-white p-2 text-sm" /> : <p className="text-sm">{p.enfoque}</p>}
            </div>
            <div>
              <h3 className="mb-1 text-sm text-muted-foreground">Brief y resumen web ({palabras(p.brief)} de 250 palabras)</h3>
              <Afirmaciones lista={p.brief} onCita={onCita} editable={editando} onCambio={cambiarLista("brief")} />
            </div>
            <div>
              <h3 className="mb-1 text-sm text-muted-foreground">Tres preguntas de investigación</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm">{p.preguntas.map((q, i) => <li key={i}>{editando ? <input value={q} onChange={(e) => setP({ ...p, preguntas: p.preguntas.map((x, j) => (j === i ? e.target.value : x)) })} className="w-full rounded-sm border border-border bg-white p-1" /> : q}</li>)}</ol>
            </div>
            <div>
              <h3 className="mb-1 text-sm text-muted-foreground">Verificaciones pendientes</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">{p.verificaciones.map((v, i) => <li key={i}>{v}</li>)}</ul>
            </div>
            <div>
              <h3 className="mb-1 text-sm text-muted-foreground">Guion de 45 a 60 segundos ({palabras(p.guion)} palabras)</h3>
              <Afirmaciones lista={p.guion} onCita={onCita} editable={editando} onCambio={cambiarLista("guion")} />
            </div>
            <div>
              <h3 className="mb-1 text-sm text-muted-foreground">Copy para redes ({palabras(p.copy)} de 80 palabras)</h3>
              <Afirmaciones lista={p.copy} onCita={onCita} editable={editando} onCambio={cambiarLista("copy")} />
            </div>
            <p className="rounded-sm bg-[#fff8e1] px-3 py-2 text-xs text-[#7a5600]">{p.leyenda}</p>
          </div>
        )}
      </section>
      <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
        <div className="rounded-sm border border-tinta bg-white p-4">
          <h3 className="titular text-lg font-semibold">Revisión</h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">Estado actual:
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={revision.estado} className="chip font-medium" initial={reducir ? { opacity: 0 } : { opacity: 0, transform: "translateY(-4px)" }} animate={{ opacity: 1, transform: "translateY(0px)" }} exit={reducir ? { opacity: 0 } : { opacity: 0, transform: "translateY(4px)" }} transition={SPRING}>{ESTADO_LABEL[revision.estado]}</motion.span>
            </AnimatePresence>
            {revision.persona && <span className="text-muted-foreground">({revision.persona}, {horaPanama(revision.createdAt)})</span>}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Responsable: <span className="font-medium text-foreground">{nombre}</span> (de tu sesión)</p>
          <label className="mt-2 block text-xs text-muted-foreground">Motivo (obligatorio para descartar o pedir evidencia)
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="mt-1 w-full rounded-sm border border-border p-2 text-sm text-foreground" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {(TRANSICIONES[revision.estado] ?? []).map((t) => (
              <Button key={t.a} size="sm" className="presionable" variant={t.primario && rol === "editor" ? "default" : "outline"} disabled={ocupado} onClick={() => revisar(t.a, t.motivo)}>{t.label}</Button>
            ))}
          </div>
          <p className="mt-3 text-xs font-medium text-senal">Aprobar como borrador no publica nada.</p>
          {msg && <p className="mt-2 text-xs" role="status">{msg}</p>}
        </div>
        {historial.length > 0 && (
          <div className="rounded-sm border border-border bg-white p-4 text-sm">
            <h3 className="mb-2 font-medium">Historial</h3>
            <ol className="space-y-1.5 text-xs">
              {historial.map((h) => (
                <li key={h.id}><span className="font-medium">{ESTADO_LABEL[h.estado]}</span> por {h.persona}, {horaPanama(h.createdAt)}{h.motivo ? `. Motivo: ${h.motivo}` : ""}</li>
              ))}
            </ol>
          </div>
        )}
      </aside>
    </div>
  );
}
