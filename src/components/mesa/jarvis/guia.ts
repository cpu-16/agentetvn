"use client";
// Ejecuta en la página una parte de la guía: navega, espera a que la pantalla cargue, aplica la demostración (pestaña o
// filtro del tablero), baja hasta la parte y la resalta unos segundos. La usan el chat y la voz.
import { useMesa } from "@/store/mesa";
import type { Guia } from "@/lib/motor/consulta";
import { esCelular } from "./panel";

/** Espera a que exista el elemento (las pantallas cargan datos): hasta 4 s. */
function esperar(selector: string, ms = 4000): Promise<HTMLElement | null> {
  const fin = Date.now() + ms;
  return new Promise((ok) => {
    const mirar = () => { const el = document.querySelector<HTMLElement>(selector); if (el || Date.now() > fin) ok(el); else window.setTimeout(mirar, 120); };
    mirar();
  });
}
/** Qué marca que la pantalla de destino ya montó (la ficha, la del tema pedido: no la que se está yendo). */
const montada = (g: Guia) => g.vista === "tablero" ? '[data-guia="tablero-filtros"]' : g.vista === "ficha" ? `[data-guia="ficha-pestanas"][data-evento="${g.eventoId ?? ""}"]` : `[data-guia="${g.ancla}"]`;
let ejecucion = 0; // cada guía nueva (o «Nueva conversación») invalida la anterior

export function cancelarGuia() { ejecucion++; }

export async function mostrarGuia(g: Guia) {
  const mia = ++ejecucion;
  const s = useMesa.getState();
  if (g.vista !== s.vista || (g.eventoId && g.eventoId !== s.eventoId)) s.irA(g.vista as never, g.eventoId);
  if (esCelular(window.innerWidth)) s.setChatAbierto(false); // en el celular la hoja taparía lo que se muestra
  const vigente = () => mia === ejecucion && useMesa.getState().vista === g.vista && (!g.eventoId || useMesa.getState().eventoId === g.eventoId);
  if (g.demo) {
    const lista = await esperar(montada(g));
    if (!lista || !vigente()) return;
    await new Promise((r) => window.setTimeout(r, 250)); // la pantalla recién montada (y su transición) ya escucha las órdenes
    if (!vigente()) return;
    useMesa.getState().ordenar(g.demo);
  }
  const el = await esperar(`[data-guia="${g.ancla}"]`);
  if (!el || !vigente()) return;
  const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reducir ? "auto" : "smooth", block: el.offsetHeight > window.innerHeight * 0.7 ? "start" : "center" });
  el.classList.remove("guia-foco"); void el.offsetWidth; el.classList.add("guia-foco");
  window.setTimeout(() => el.classList.remove("guia-foco"), 5000);
}
