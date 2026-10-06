"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Vista = "portada" | "agenda" | "tablero" | "ficha" | "control";
export type Rol = "editor" | "periodista" | "productor";
export const ROLES: { id: Rol; label: string }[] = [
  { id: "editor", label: "Editor/a" },
  { id: "periodista", label: "Periodista" },
  { id: "productor", label: "Productor/a digital" },
];
export interface Sesion { nombre: string; rol: Rol }

interface Mesa {
  vista: Vista;
  eventoId: string | null;
  sesion: Sesion | null;
  modoConsulta: "embeddings" | "bm25";
  chatAbierto: boolean;
  filtroTablero: { temas: string[] } | null; // filtro que el Tablero pasa a la Agenda
  irA: (v: Vista, eventoId?: string) => void;
  setFiltroTablero: (f: { temas: string[] } | null) => void;
  setSesion: (s: Sesion | null) => void;
  setModoConsulta: (m: "embeddings" | "bm25") => void;
  setChatAbierto: (a: boolean) => void;
}

export const useMesa = create<Mesa>()(
  persist(
    (set) => ({
      vista: "portada",
      eventoId: null,
      sesion: null,
      modoConsulta: "embeddings",
      chatAbierto: false,
      filtroTablero: null,
      setFiltroTablero: (filtroTablero) => set({ filtroTablero }),
      irA: (vista, eventoId) => set((s) => ({ vista, eventoId: eventoId ?? (vista === "ficha" ? s.eventoId : null) })),
      setSesion: (sesion) => set({ sesion }),
      setModoConsulta: (modoConsulta) => set({ modoConsulta }),
      setChatAbierto: (chatAbierto) => set({ chatAbierto }),
    }),
    { name: "agentetvn-mesa", partialize: (s) => ({ modoConsulta: s.modoConsulta }) }
  )
);

/** Rol y persona actuales (derivados de la sesión). */
export const useRol = () => useMesa((s) => s.sesion?.rol ?? "editor");
export const usePersona = () => useMesa((s) => s.sesion?.nombre ?? "");

export const horaPanama = (iso: string | null | undefined, conHora = true) =>
  iso
    ? new Intl.DateTimeFormat("es-PA", { timeZone: "America/Panama", day: "numeric", month: "short", year: "numeric", ...(conHora ? { hour: "numeric", minute: "2-digit" } : {}) }).format(new Date(iso))
    : "sin fecha";

export const TEMA_LABEL: Record<string, string> = {
  economia: "Economía",
  logistica_canal: "Logística y Canal",
  turismo: "Turismo",
  servicios_publicos: "Servicios públicos",
  eventos_naturales: "Eventos naturales",
  regulacion: "Regulación",
  deportes: "Deportes",
  otro: "Otro",
};
export const ESTADO_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  en_revision: "En revisión",
  requiere_evidencia: "Requiere evidencia",
  aprobado_borrador: "Aprobado como borrador",
  descartado: "Descartado",
};
export const EVIDENCIA_LABEL: Record<string, string> = { insuficiente: "Evidencia insuficiente", parcial: "Evidencia parcial", suficiente: "Suficiente para el borrador" };
export const TIPO_LABEL: Record<string, string> = { hecho_reportado: "Hecho reportado", declaracion: "Declaración", inferencia: "Inferencia", hipotesis: "Hipótesis" };

/** Springs de la casa (Apple): críticamente amortiguados; rebote solo con momento del usuario. */
export const SPRING = { type: "spring", bounce: 0, duration: 0.32 } as const;
export const SPRING_PANEL = { type: "spring", bounce: 0, duration: 0.28 } as const;
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
