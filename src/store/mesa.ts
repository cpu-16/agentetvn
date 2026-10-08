"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgendaDatos } from "@/components/mesa/tipos";

export type Vista = "portada" | "agenda" | "tablero" | "ficha" | "control";
export type Rol = "editor" | "periodista" | "productor" | "analista";
export const ROLES: { id: Rol; label: string }[] = [
  { id: "editor", label: "Editor/a" },
  { id: "periodista", label: "Periodista" },
  { id: "productor", label: "Productor/a digital" },
  { id: "analista", label: "Analista bancario/a" },
];
export interface Sesion { nombre: string; rol: Rol }

export const AVISO_SESION_VENCIDA = "Pasaron las 12 horas de la sesión; entra de nuevo.";

interface Mesa {
  vista: Vista;
  eventoId: string | null;
  sesion: Sesion | null;
  avisoSesion: string | null; // se muestra en la pantalla de entrada (sesión vencida, salida)
  modoConsulta: "embeddings" | "bm25";
  chatAbierto: boolean;
  agenda: AgendaDatos | null; // una sola carga compartida por portada, agenda y chat
  agendaError: string | null;
  agendaCargando: boolean;
  filtroTablero: { ids: string[]; descripcion: string } | null; // conjunto exacto de eventos que el Tablero pasa a la Agenda
  pantalla: { pestana?: "evidencia" | "paquete"; filtrosAgenda?: string; filtroTablero?: string }; // lo que Jarvis necesita para «explícame esta pantalla»
  setPantalla: (p: Partial<Mesa["pantalla"]>) => void;
  /** Órdenes de Jarvis a una pantalla (demostraciones de la guía): cambiar de pestaña o filtrar el tablero. `n` cambia en cada orden. */
  orden: ({ n: number } & ({ tipo: "pestana"; pestana: "evidencia" | "paquete" } | { tipo: "filtroTablero"; temas?: string[]; medio?: string; limpiar?: boolean })) | null;
  ordenar: (o: { tipo: "pestana"; pestana: "evidencia" | "paquete" } | { tipo: "filtroTablero"; temas?: string[]; medio?: string; limpiar?: boolean }) => void;
  irA: (v: Vista, eventoId?: string) => void;
  setFiltroTablero: (f: { ids: string[]; descripcion: string } | null) => void;
  setSesion: (s: Sesion | null) => void;
  cerrarSesion: (aviso?: string | null) => void;
  setModoConsulta: (m: "embeddings" | "bm25") => void;
  setChatAbierto: (a: boolean) => void;
  /** Pregunta que otra pantalla le pasa al chat («¿Qué me toca hoy?» desde la mesa del rol); el chat la envía y la limpia. */
  preguntaPendiente: string | null;
  pedirAlChat: (q: string | null) => void;
  cargarAgenda: (forzar?: boolean) => Promise<AgendaDatos | null>;
  actualizarEstadoEvento: (id: string, estado: string) => void;
  /** Sube cuando el chat le cambió el borrador a la ficha abierta (Jarvis ajustó el paquete): la ficha se recarga. */
  versionFicha: number;
  refrescarFicha: () => void;
}

export const useMesa = create<Mesa>()(
  persist(
    (set, get) => ({
      vista: "portada",
      eventoId: null,
      sesion: null,
      avisoSesion: null,
      modoConsulta: "embeddings",
      chatAbierto: false,
      preguntaPendiente: null,
      pedirAlChat: (q) => set(q ? { preguntaPendiente: q, chatAbierto: true } : { preguntaPendiente: null }),
      agenda: null,
      agendaError: null,
      agendaCargando: false,
      filtroTablero: null,
      pantalla: {},
      setPantalla: (p) => set((s) => ({ pantalla: { ...s.pantalla, ...p } })),
      orden: null,
      ordenar: (o) => set((s) => ({ orden: { ...o, n: (s.orden?.n ?? 0) + 1 } as Mesa["orden"] })),
      setFiltroTablero: (filtroTablero) => set({ filtroTablero }),
      irA: (vista, eventoId) => set((s) => ({ vista, eventoId: eventoId ?? (vista === "ficha" ? s.eventoId : null) })),
      setSesion: (sesion) => set({ sesion, avisoSesion: null }),
      cerrarSesion: (aviso = null) => set({ sesion: null, avisoSesion: aviso, chatAbierto: false, vista: "portada", eventoId: null }),
      setModoConsulta: (modoConsulta) => set({ modoConsulta }),
      setChatAbierto: (chatAbierto) => set({ chatAbierto }),
      cargarAgenda: async (forzar = false) => {
        const s = get();
        if (s.agenda && !forzar) return s.agenda;
        if (s.agendaCargando && !forzar) return s.agenda;
        set({ agendaCargando: true, agendaError: null });
        try {
          const r = await fetchMesa("/api/agenda");
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const a = (await r.json()) as AgendaDatos;
          set({ agenda: a, agendaCargando: false });
          return a;
        } catch {
          set({ agendaError: "No se pudo cargar la mesa. Avisa al equipo técnico.", agendaCargando: false });
          return null;
        }
      },
      versionFicha: 0,
      refrescarFicha: () => set((s) => ({ versionFicha: s.versionFicha + 1 })),
      actualizarEstadoEvento: (id, estado) =>
        set((s) => (s.agenda ? { agenda: { ...s.agenda, eventos: s.agenda.eventos.map((e) => (e.id === id ? { ...e, estado_revision: estado } : e)), cinco: s.agenda.cinco.map((c) => (c.evento.id === id ? { ...c, evento: { ...c.evento, estado_revision: estado } } : c)) } } : {})),
    }),
    { name: "agentetvn-mesa", partialize: (s) => ({ modoConsulta: s.modoConsulta }) }
  )
);

/** fetch de la mesa: un 401 en cualquier llamada cierra la sesión en el cliente y muestra la entrada con el aviso. */
export async function fetchMesa(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const r = await fetch(input, init);
  if (r.status === 401 && useMesa.getState().sesion) useMesa.getState().cerrarSesion(AVISO_SESION_VENCIDA);
  return r;
}

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
  pieza_lista: "Pieza lista",
  descartado: "Descartado",
};
export const EVIDENCIA_LABEL: Record<string, string> = { insuficiente: "Evidencia insuficiente", parcial: "Evidencia parcial", suficiente: "Suficiente para el borrador" };
export const TIPO_LABEL: Record<string, string> = { hecho_reportado: "Hecho reportado", declaracion: "Declaración", inferencia: "Inferencia", hipotesis: "Hipótesis" };

/** Springs de la casa (Apple): críticamente amortiguados; rebote solo con momento del usuario. */
export const SPRING = { type: "spring", bounce: 0, duration: 0.32 } as const;
export const SPRING_PANEL = { type: "spring", bounce: 0, duration: 0.28 } as const;
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
