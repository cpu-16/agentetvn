"use client";
// La mesa de cada rol en la portada: lo que le toca hoy, con la acción que le corresponde. Mismo filtro que el chat y Jarvis.
import { motion, useReducedMotion } from "framer-motion";
import { Chips } from "./agenda";
import { itemEscalonado } from "./motion";
import type { AgendaDatos } from "./tipos";
import { ESTADO_LABEL, ROLES, useMesa, useRol } from "@/store/mesa";
import { MESA, accionSugerida, cuentasMesa, tocaA } from "@/lib/roles";
import { Button } from "@/components/ui/button";

const PREGUNTAS: Record<string, string[]> = {
  editor: ["¿Qué me toca hoy?", "¿Cuál es la noticia del día?"],
  periodista: ["¿Qué me toca hoy?", "¿Qué falta verificar del tema uno?"],
  productor: ["¿Qué me toca hoy?", "Prepárame los titulares del tema uno"],
};

export function MesaRol({ data }: { data: AgendaDatos }) {
  const rol = useRol();
  const irA = useMesa((s) => s.irA);
  const pedirAlChat = useMesa((s) => s.pedirAlChat);
  const reducir = useReducedMotion();
  const m = MESA[rol];
  const lista = tocaA(rol, data.eventos);
  const falta = new Map(data.cinco.map((c) => [c.evento.id, c.vacios.join(", ")]));
  const porId = new Map(data.eventos.map((e) => [e.id, e]));
  const abrir = (id: string) => irA("ficha", id); // la ficha abre en la pestaña del rol (MESA[rol].pestana)

  return (
    <section data-guia="portada-mesa" aria-labelledby="mesa-rol-titulo" className="rounded-sm border border-tinta/20 border-l-4 border-l-azul bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="rotulo rotulo-tinta mb-2 inline-block">Tu mesa · {ROLES.find((r) => r.id === rol)?.label}</p>
          <h2 id="mesa-rol-titulo" className="titular text-2xl font-semibold">{m.titulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{m.bajada}</p>
        </div>
        <dl className="grid grid-cols-3 gap-4 text-center">
          {cuentasMesa(rol, data.eventos).map((c) => (
            <div key={c.etiqueta} className="min-w-[88px]">
              <dt className="sr-only">{c.etiqueta}</dt>
              <dd className="titular text-3xl font-bold leading-none text-tinta tabular-nums">{c.n}</dd>
              <dd className="mt-1 text-[11px] leading-tight text-muted-foreground">{c.etiqueta}</dd>
            </div>
          ))}
        </dl>
      </div>
      {lista.length ? (
        <ol className="mt-4 divide-y divide-border border-y border-border">
          {lista.map((e, i) => {
            const r = porId.get(e.id)!;
            return (
              <motion.li key={e.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center" {...itemEscalonado(i, reducir)}>
                <div>
                  <button className="presionable text-left" onClick={() => abrir(e.id)}>
                    <span className="titular text-[15px] font-semibold leading-snug">{e.titulo}</span>
                  </button>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="chip tinta">P {Math.round(e.P)}</span>
                    <span className="chip gris">{ESTADO_LABEL[e.estado_revision] ?? e.estado_revision}</span>
                    <Chips e={r} compacto />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {rol === "periodista" && falta.get(e.id) ? `Falta: ${falta.get(e.id)}` : rol === "productor" ? "Propuestas de titular, resumen web, guion y copy con su cita; sujetos a revisión." : `Sugerencia: ${accionSugerida(e)}`}
                  </p>
                </div>
                <Button size="sm" className="presionable justify-self-start bg-azul text-white hover:bg-[#005fa3] sm:justify-self-end" onClick={() => abrir(e.id)}>{m.accion}</Button>
              </motion.li>
            );
          })}
        </ol>
      ) : <p className="mt-4 text-sm text-muted-foreground">{m.vacio}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Pregúntale al agente:</span>
        {PREGUNTAS[rol].map((q) => <button key={q} className="presionable rounded-full border border-border px-2.5 py-1 hover:border-tinta" onClick={() => pedirAlChat(q)}>{q}</button>)}
      </div>
    </section>
  );
}
