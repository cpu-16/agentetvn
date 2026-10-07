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
const MONTADA: Record<string, string> = { tablero: '[data-guia="tablero-filtros"]', ficha: '[data-guia="ficha-pestanas"]' };

export async function mostrarGuia(g: Guia) {
  const s = useMesa.getState();
  if (g.vista !== s.vista || (g.eventoId && g.eventoId !== s.eventoId)) s.irA(g.vista as never, g.eventoId);
  if (esCelular(window.innerWidth)) s.setChatAbierto(false); // en el celular la hoja taparía lo que se muestra
  if (g.demo) {
    await esperar(MONTADA[g.vista] ?? `[data-guia="${g.ancla}"]`);
    await new Promise((r) => window.setTimeout(r, 120)); // la pantalla recién montada ya escucha las órdenes
    useMesa.getState().ordenar(g.demo);
  }
  const el = await esperar(`[data-guia="${g.ancla}"]`);
  if (!el) return;
  const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reducir ? "auto" : "smooth", block: el.offsetHeight > window.innerHeight * 0.7 ? "start" : "center" });
  el.classList.remove("guia-foco"); void el.offsetWidth; el.classList.add("guia-foco");
  window.setTimeout(() => el.classList.remove("guia-foco"), 5000);
}
