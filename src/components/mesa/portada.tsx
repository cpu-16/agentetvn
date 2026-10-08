"use client";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { Medidor } from "./medidor";
import { MesaRol } from "./mesa-rol";
import { Chips } from "./agenda";
import { itemEscalonado } from "./motion";
import { ROLES, SPRING, horaPanama, useMesa, useRol } from "@/store/mesa";
import { MESA } from "@/lib/roles";
import { Button } from "@/components/ui/button";

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

/** Cifra que cuenta una sola vez al entrar en pantalla; con movimiento reducido muestra el valor final de inmediato. */
function Cifra({ n, etiqueta, cargando }: { n: number; etiqueta: string; cargando: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const enVista = useInView(ref, { once: true });
  const reducir = useReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (cargando || !enVista || reducir) return;
    const c = animate(0, n, { duration: 0.9, ease: [0.23, 1, 0.32, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [enVista, n, reducir, cargando]);
  const mostrado = reducir ? n : v; // con movimiento reducido no hay conteo: el valor final se pinta directo
  return (
    <span className="block">
      <span ref={ref} className="titular block text-4xl font-bold leading-none tabular-nums text-white sm:text-5xl" aria-busy={cargando}>{cargando ? "—" : mostrado}</span>
      <span className="mt-1 block text-sm text-white/70">{etiqueta}</span>
    </span>
  );
}

export function Portada() {
  const data = useMesa((s) => s.agenda);
  const error = useMesa((s) => s.agendaError);
  const cargarAgenda = useMesa((s) => s.cargarAgenda);
  const irA = useMesa((s) => s.irA);
  const setChatAbierto = useMesa((s) => s.setChatAbierto);
  const reducir = useReducedMotion();
  const rol = useRol();
  const m = MESA[rol]; // la portada abre con la mesa de quien entró: cada rol ve su trabajo primero

  useEffect(() => { void cargarAgenda(); }, [cargarAgenda]);

  const cargando = !data;
  const resumen = data?.resumen; // misma definición que el tablero (resumenCorte): sin casos sintéticos ni fuentes no confiables
  const top = data ? data.eventos.filter((e) => !e.sintetica && !e.no_confiable).slice(0, 10) : [];
  const item = (e: (typeof top)[number], decorativo = false) => (
    <button key={`${e.id}-${decorativo ? "copia" : "lista"}`} className="ticker-item presionable" onClick={() => irA("ficha", e.id)} aria-hidden={decorativo || undefined} tabIndex={decorativo ? -1 : 0}>
      <span className="p">P {Math.round(e.P)}</span>
      <span className="titular">{e.titulo}</span>
    </button>
  );

  return (
    <div className="space-y-8">
      <section data-guia="portada-cifras" className="sangrado -mt-5 bg-tinta px-4 pb-8 pt-8 text-white lg:px-8" aria-busy={cargando}>
        <div className="mx-auto max-w-[1336px]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <span className="al-aire text-white/90">La mesa de la mañana · {ROLES.find((r) => r.id === rol)?.label}</span>
              <h1 className="titular mt-3 text-4xl font-bold leading-[0.95] tracking-[-0.02em] sm:text-6xl">{m.titulo}</h1>
              <p className="mt-3 max-w-xl text-sm text-white/75 sm:text-base">{m.bajada} {data && <span>Datos al {horaPanama(data.corteUTC)} (corte congelado del reto).</span>}</p>
            </div>
            <Reloj />
          </div>
          {error ? (
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-white/15 pt-6" role="alert">
              <p className="text-sm">{error}</p>
              <Button size="sm" variant="outline" className="presionable border-white/40 bg-transparent text-white hover:bg-white/10" onClick={() => cargarAgenda(true)}>Reintentar</Button>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/15 pt-6">
              <Cifra n={resumen?.publicaciones ?? 0} etiqueta="publicaciones" cargando={cargando} />
              <Cifra n={resumen?.eventos ?? 0} etiqueta="temas agrupados" cargando={cargando} />
              <Cifra n={resumen?.medios ?? 0} etiqueta="medios distintos" cargando={cargando} />
              {resumen && <p className="col-span-3 text-xs text-white/70">Sin contar {resumen.sinteticas} publicaciones de casos de prueba{resumen.noConfiablesReales ? ` ni ${resumen.noConfiablesReales} no confiables` : ""}; {resumen.agencias} agencia{resumen.agencias === 1 ? "" : "s"} identificada{resumen.agencias === 1 ? "" : "s"} en los textos.</p>}
            </div>
          )}
        </div>
        {top.length > 0 && (
          reducir ? (
            <nav className="ticker-estatico fino mt-6 border-y border-white/15 py-2 text-sm text-white/90" aria-label="Titulares de mayor puntaje">{top.map((e) => item(e))}</nav>
          ) : (
            <nav className="ticker mt-6 border-y border-white/15 py-2 text-sm text-white/90" style={{ ["--ticker-dur" as string]: `${Math.max(40, top.length * 7)}s` }} aria-label="Titulares de mayor puntaje">
              <div className="ticker-pista">
                {top.map((e) => item(e))}
                {top.map((e) => item(e, true))}
              </div>
            </nav>
          )
        )}
      </section>

      {data && !error && <MesaRol data={data} />}

      <section data-guia="portada-cinco" aria-labelledby="cinco-titulo">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="rotulo rotulo-tinta mb-2 inline-block">Cinco temas para la agenda de Panamá</p>
            <h2 id="cinco-titulo" className="titular text-2xl font-semibold">Cinco para hoy</h2>
            <p className="text-sm text-muted-foreground">Qué cinco temas merecen revisión para la agenda de Panamá, y por qué. El puntaje ordena; la evidencia dice qué falta verificar antes de afirmar el hecho.</p>
          </div>
          <Button className="presionable bg-azul text-white hover:bg-[#005fa3]" onClick={() => irA("agenda")}>Abrir la agenda</Button>
        </div>
        {error ? null : !data ? (
          <p className="p-4 text-sm text-muted-foreground" aria-live="polite">Cargando la mesa…</p>
        ) : (
          <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {data.cinco.map((c, i) => (
              <motion.li key={c.evento.id} className="tarjeta flex flex-col rounded-sm border border-border bg-white p-4" {...itemEscalonado(i, reducir)}>
                <span className="titular text-3xl font-bold leading-none text-azul" aria-hidden>{i + 1}</span>
                <button className="presionable mt-2 text-left" onClick={() => irA("ficha", c.evento.id)}>
                  <span className="sr-only">Tema {i + 1}: </span>
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

      <section className="grid gap-4 md:grid-cols-3" aria-label="Accesos">
        {[
          { t: "Agenda", d: "La bandeja completa con el puntaje explicado, el estado de evidencia y las procedencias de cada tema.", v: "agenda" as const },
          { t: "Preguntar al agente", d: "Consultas en español sobre las noticias del corte: responde con citas o se abstiene y dice qué falta.", v: null },
          { t: "Control", d: "Datos con huella SHA-256, reglas, búsqueda por sentido frente a búsqueda por palabras y las pruebas T01 a T10.", v: "control" as const },
        ].map((b) => (
          <motion.button key={b.t} className="tarjeta presionable rounded-sm border border-border bg-white p-4 text-left" onClick={() => (b.v ? irA(b.v) : setChatAbierto(true))} transition={SPRING}>
            <span className="titular block text-lg font-semibold">{b.t}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{b.d}</span>
          </motion.button>
        ))}
      </section>
    </div>
  );
}
