"use client";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { Medidor } from "./medidor";
import { Chips, type EventoResumen } from "./agenda";
import { itemEscalonado } from "./motion";
import { SPRING, horaPanama, useMesa } from "@/store/mesa";
import { Button } from "@/components/ui/button";

interface Agenda { corteUTC: string; version: string; eventos: EventoResumen[]; cinco: { evento: EventoResumen; razones: string[]; vacios: string[] }[] }

function Reloj() {
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    const primero = setTimeout(() => setAhora(new Date()), 0);
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => { clearTimeout(primero); clearInterval(t); };
  }, []);
  if (!ahora) return <span className="titular text-4xl font-semibold tabular-nums text-white/0">00:00:00</span>;
  const hora = new Intl.DateTimeFormat("es-PA", { timeZone: "America/Panama", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(ahora);
  const crudo = new Intl.DateTimeFormat("es-PA", { timeZone: "America/Panama", weekday: "long", day: "numeric", month: "long" }).format(ahora);
  const dia = crudo.charAt(0).toUpperCase() + crudo.slice(1);
  return (
    <span className="block">
      <span className="titular block text-4xl font-semibold leading-none tabular-nums sm:text-5xl">{hora}</span>
      <span className="mt-1 block text-sm text-white/70">{dia}, Panamá</span>
    </span>
  );
}

/** Cifra que cuenta una sola vez al entrar en pantalla. */
function Cifra({ n, etiqueta }: { n: number; etiqueta: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const enVista = useInView(ref, { once: true });
  const reducir = useReducedMotion();
  const [v, setV] = useState(reducir ? n : 0);
  useEffect(() => {
    if (!enVista || reducir) return;
    const c = animate(0, n, { duration: 0.9, ease: [0.23, 1, 0.32, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [enVista, n, reducir]);
  return (
    <span className="block">
      <span ref={ref} className="titular block text-4xl font-bold leading-none tabular-nums text-white sm:text-5xl">{v}</span>
      <span className="mt-1 block text-sm text-white/70">{etiqueta}</span>
    </span>
  );
}

export function Portada({ onCargada }: { onCargada?: (a: { corteUTC: string; version: string }) => void }) {
  const [data, setData] = useState<Agenda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const irA = useMesa((s) => s.irA);
  const reducir = useReducedMotion();

  useEffect(() => {
    fetch("/api/agenda").then(async (r) => {
      if (!r.ok) throw new Error(`La portada no cargó (${r.status}).`);
      const a = (await r.json()) as Agenda;
      setData(a);
      onCargada?.({ corteUTC: a.corteUTC, version: a.version });
    }).catch((e) => setError(e.message));
  }, [onCargada]);

  if (error) return <p className="rounded-sm border border-senal bg-white p-4 text-sm">{error}</p>;
  const publicaciones = data?.eventos.reduce((s, e) => s + e.publicaciones, 0) ?? 0;
  const procedencias = data ? new Set(data.eventos.flatMap((e) => e.procedencias.filter((p) => p.tipo !== "no_verificada").map((p) => p.nombre))).size : 0;
  const top = data ? data.eventos.filter((e) => !e.sintetica && !e.no_confiable).slice(0, 10) : [];
  const ticker = [...top, ...top];

  return (
    <div className="space-y-8">
      <section className="sangrado -mt-5 bg-tinta px-4 pb-8 pt-8 text-white lg:px-8">
        <div className="mx-auto max-w-[1336px]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <span className="al-aire text-white/90">Al aire</span>
              <h1 className="titular mt-3 text-4xl font-bold leading-[0.95] tracking-[-0.02em] sm:text-6xl">La mesa de la mañana</h1>
              <p className="mt-3 max-w-xl text-sm text-white/75 sm:text-base">Las señales del día ordenadas por puntaje de atención, con la evidencia que las respalda y lo que todavía falta comprobar. {data && <span>Corte del snapshot: {horaPanama(data.corteUTC)}</span>}</p>
            </div>
            <Reloj />
          </div>
          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/15 pt-6">
            <Cifra n={publicaciones} etiqueta="publicaciones" />
            <Cifra n={data?.eventos.length ?? 0} etiqueta="temas agrupados" />
            <Cifra n={procedencias} etiqueta="medios y agencias distintos" />
          </div>
        </div>
        {top.length > 0 && (
          <div className="ticker mt-6 border-y border-white/15 py-2 text-sm text-white/90" style={{ ["--ticker-dur" as string]: `${Math.max(40, top.length * 7)}s` }} aria-label="Titulares de mayor puntaje">
            <div className="ticker-pista">
              {ticker.map((e, i) => (
                <button key={`${e.id}-${i}`} className="ticker-item presionable" onClick={() => irA("ficha", e.id)} aria-hidden={i >= top.length}>
                  <span className="p">P {Math.round(e.P)}</span>
                  <span className="titular">{e.titulo}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="rotulo rotulo-tinta mb-2 inline-block">Pregunta del reto CU-01</p>
            <h2 className="titular text-2xl font-semibold">Cinco para hoy</h2>
            <p className="text-sm text-muted-foreground">Qué cinco temas merecen revisión para la agenda de Panamá, y por qué. El puntaje ordena; la evidencia decide si se puede escribir.</p>
          </div>
          <Button className="presionable bg-tinta text-white hover:bg-tinta/90" onClick={() => irA("agenda")}>Abrir la agenda</Button>
        </div>
        {!data ? (
          <p className="p-4 text-sm text-muted-foreground">Cargando la mesa…</p>
        ) : (
          <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {data.cinco.map((c, i) => (
              <motion.li key={c.evento.id} className="tarjeta flex flex-col rounded-sm border border-border bg-white p-4" {...itemEscalonado(i, reducir)}>
                <span className="titular text-3xl font-bold leading-none text-senal">{i + 1}</span>
                <button className="presionable mt-2 text-left" onClick={() => irA("ficha", c.evento.id)}>
                  <span className="titular text-[16px] font-semibold leading-snug">{c.evento.titulo}</span>
                </button>
                <div className="mt-3"><Medidor P={c.evento.P} rango={c.evento.rango} componentes={c.evento.componentes} /></div>
                <div className="mt-2"><Chips e={c.evento} compacto /></div>
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer text-acero">Por qué y qué falta</summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">{c.razones.map((r, j) => <li key={j}>{r}</li>)}</ul>
                  <p className="mt-1 font-medium">Vacíos</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{c.vacios.map((v, j) => <li key={j}>{v}</li>)}</ul>
                </details>
              </motion.li>
            ))}
          </ol>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { t: "Agenda", d: "La bandeja completa con el puntaje explicado, el estado de evidencia y las procedencias de cada tema.", v: "agenda" as const },
          { t: "Preguntar al agente", d: "Consultas en español sobre el snapshot: responde con citas o se abstiene y dice qué falta.", v: null },
          { t: "Control", d: "Snapshot con SHA-256, reglas, IA frente a baseline y las pruebas T01 a T10.", v: "control" as const },
        ].map((b) => (
          <motion.button key={b.t} className="tarjeta presionable rounded-sm border border-border bg-white p-4 text-left" onClick={() => (b.v ? irA(b.v) : useMesa.getState().setChatAbierto(true))} transition={SPRING}>
            <span className="titular block text-lg font-semibold">{b.t}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{b.d}</span>
          </motion.button>
        ))}
      </section>
    </div>
  );
}
