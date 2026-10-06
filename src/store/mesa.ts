"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Vista = "agenda" | "ficha" | "control";
export type Rol = "editor" | "periodista" | "productor";
export const ROLES: { id: Rol; label: string }[] = [
  { id: "editor", label: "Editor/a" },
  { id: "periodista", label: "Periodista" },
  { id: "productor", label: "Productor/a digital" },
];

interface Mesa {
  vista: Vista;
  eventoId: string | null;
  rol: Rol;
  persona: string;
  modoConsulta: "embeddings" | "bm25";
  irA: (v: Vista, eventoId?: string) => void;
  setRol: (r: Rol) => void;
  setPersona: (p: string) => void;
  setModoConsulta: (m: "embeddings" | "bm25") => void;
}

export const useMesa = create<Mesa>()(
  persist(
    (set) => ({
      vista: "agenda",
      eventoId: null,
      rol: "editor",
      persona: "",
      modoConsulta: "embeddings",
      irA: (vista, eventoId) => set((s) => ({ vista, eventoId: eventoId ?? (vista === "ficha" ? s.eventoId : null) })),
      setRol: (rol) => set({ rol }),
      setPersona: (persona) => set({ persona }),
      setModoConsulta: (modoConsulta) => set({ modoConsulta }),
    }),
    { name: "agentetvn-mesa", partialize: (s) => ({ rol: s.rol, persona: s.persona, modoConsulta: s.modoConsulta }) }
  )
);

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
