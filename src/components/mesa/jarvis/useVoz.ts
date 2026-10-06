"use client";
// Cliente de voz de Jarvis-TVN: WebRTC directo a OpenAI (la oferta pasa por /api/voz/offer con la sesión). Un toque abre la
// conversación con el micrófono abierto y otro la cuelga; los turnos los marca la detección de voz del modelo (eventos turn.*).
// Acciones de Next (navegar/desplazar/mostrar/colgada) y contexto de la pantalla.
// Reglas contra fugas de micrófono y carreras: una sola conexión a la vez (promesa compartida); cada intento tiene un número
// que colgar invalida (lo que llegue tarde se cierra); el sondeo va de uno en uno y descarta respuestas de otra llamada.
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMesa, useMesa } from "@/store/mesa";
import { contextoDesdeMesa } from "@/lib/voz/catalogo";
import { debeColgar, siguiente, vozActiva, type EstadoVoz, type EventoVoz } from "./maquina";
import { esCelular } from "./panel";

type Opts = { onTranscripcion?: (quien: "persona" | "jarvis", texto: string) => void; onMostrar?: (pregunta: string, respuesta: unknown) => void; onAviso?: (texto: string) => void };
interface Conexion { pc?: RTCPeerConnection; mic?: MediaStream; ctx?: AudioContext; raf?: number; hilo?: string }

/** Cierra TODO lo de una conexión (micrófono, contexto, animación, WebRTC). Idempotente. */
function cerrarConexion(con: Conexion) {
  if (con.raf) cancelAnimationFrame(con.raf);
  con.pc?.close(); con.mic?.getTracks().forEach((t) => t.stop()); void con.ctx?.close().catch(() => null);
}

/** Mueve la página: «abajo»/«arriba» casi una pantalla, «inicio»/«final» hasta el borde. */
export function desplazar(direccion?: string) {
  const suave = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const paso = Math.round(window.innerHeight * 0.8);
  if (direccion === "inicio") window.scrollTo({ top: 0, behavior: suave });
  else if (direccion === "final") window.scrollTo({ top: document.documentElement.scrollHeight, behavior: suave });
  else if (direccion === "arriba" || direccion === "abajo") window.scrollBy({ top: direccion === "arriba" ? -paso : paso, behavior: suave });
}

export function useVoz(opts: Opts = {}) {
  const [estado, setEstado] = useState<EstadoVoz>("inactiva");
  const [nivel, setNivel] = useState(0);
  const r = useRef({ intento: 0, conectando: null as Promise<boolean> | null, con: {} as Conexion, audio: undefined as HTMLAudioElement | undefined, ultima: Date.now(), roles: {} as Record<string, string>, estado: "inactiva" as EstadoVoz, sondeando: false });
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });
  const emitir = useCallback((ev: EventoVoz) => { r.current.estado = siguiente(r.current.estado, ev); setEstado(r.current.estado); }, []);

  const colgar = useCallback((motivo = "colgó") => {
    const c = r.current;
    c.intento++; // invalida cualquier conexión en curso: lo que llegue tarde se cierra al llegar
    c.conectando = null;
    if (c.con.hilo) void fetch(`/api/voz/colgar?hilo=${encodeURIComponent(c.con.hilo)}&motivo=${encodeURIComponent(motivo)}`, { method: "POST" }).catch(() => null);
    cerrarConexion(c.con); c.con = {};
    setNivel(0); emitir({ tipo: "colgar" });
  }, [emitir]);

  const enviarContexto = useCallback(async () => {
    const hilo = r.current.con.hilo; if (!hilo) return;
    await fetchMesa(`/api/voz/contexto?hilo=${encodeURIComponent(hilo)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(contextoDesdeMesa(useMesa.getState())) }).catch(() => null);
  }, []);

  const conectar = useCallback(async (): Promise<boolean> => {
    const c = r.current;
    const mio = ++c.intento;
    const vigente = () => c.intento === mio;
    const con: Conexion = {};
    const abortar = () => { cerrarConexion(con); return false; };
    emitir({ tipo: "conectar" });
    try {
      const est = await (await fetchMesa("/api/voz/estado")).json();
      if (!vigente()) return abortar();
      if (!est.disponible) { emitir({ tipo: "fallo" }); optsRef.current.onAviso?.(`${est.motivo ?? "La voz no está disponible ahora."} Puedes escribir tu pregunta.`); return false; }
      con.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!vigente()) return abortar();
      con.mic.getAudioTracks().forEach((t) => (t.enabled = false)); // cerrado hasta que la llamada quede conectada
      con.ctx = new AudioContext(); const an = con.ctx.createAnalyser(); con.ctx.createMediaStreamSource(con.mic).connect(an);
      const datos = new Uint8Array(an.fftSize);
      const medir = () => { an.getByteTimeDomainData(datos); let m = 0; for (const v of datos) m = Math.max(m, Math.abs(v - 128)); setNivel(c.con === con ? Math.min(1, Math.round((m / 64) * 10) / 10) : 0); con.raf = requestAnimationFrame(medir); };
      con.raf = requestAnimationFrame(medir);
      const pc = (con.pc = new RTCPeerConnection());
      con.mic.getTracks().forEach((t) => pc.addTrack(t, con.mic!));
      pc.ontrack = (e) => { try { if ("jitterBufferTarget" in e.receiver) (e.receiver as unknown as { jitterBufferTarget: number }).jitterBufferTarget = 200; } catch { /* opcional */ } c.audio ??= Object.assign(new Audio(), { autoplay: true }); c.audio.srcObject = e.streams[0]; };
      const dc = pc.createDataChannel("oai-events");
      dc.onmessage = (m) => {
        if (!vigente()) return;
        let ev: { type?: string; turn?: { id?: string; role?: string; transcript?: string }; turn_id?: string };
        try { ev = JSON.parse(m.data); } catch { return; }
        if (!ev.type?.startsWith("turn.")) return;
        const turno = ev.turn ?? {}; if (ev.type === "turn.created" && turno.id) c.roles[turno.id] = turno.role ?? "";
        const rol = (turno.role ?? c.roles[ev.turn_id ?? ""]) === "user" ? "user" : "assistant";
        c.ultima = Date.now();
        emitir({ tipo: ev.type === "turn.created" ? "turno_creado" : "turno_hecho", rol });
        if (ev.type === "turn.done" && turno.transcript) {
          const quien = rol === "user" ? "persona" : "jarvis";
          optsRef.current.onTranscripcion?.(quien, turno.transcript);
          if (con.hilo) void fetchMesa(`/api/voz/turno?hilo=${encodeURIComponent(con.hilo)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quien, texto: turno.transcript }) }).catch(() => null);
        }
      };
      await pc.setLocalDescription(await pc.createOffer());
      if (!vigente()) return abortar();
      const of = await fetchMesa("/api/voz/offer", { method: "POST", body: pc.localDescription!.sdp, headers: { "content-type": "application/sdp" } });
      const hilo = of.headers.get("x-hilo") ?? undefined;
      if (!vigente()) { if (hilo) void fetch(`/api/voz/colgar?hilo=${encodeURIComponent(hilo)}&motivo=cancelada`, { method: "POST" }).catch(() => null); return abortar(); }
      if (!of.ok || !hilo) { const j = await of.json().catch(() => ({})); abortar(); if (!vigente()) return false; emitir({ tipo: "fallo" }); optsRef.current.onAviso?.(j.error ?? "La voz no está disponible ahora. Puedes escribir tu pregunta."); return false; }
      con.hilo = hilo;
      await pc.setRemoteDescription({ type: "answer", sdp: await of.text() });
      if (!vigente()) { void fetch(`/api/voz/colgar?hilo=${encodeURIComponent(hilo)}&motivo=cancelada`, { method: "POST" }).catch(() => null); return abortar(); }
      c.con = con; c.ultima = Date.now();
      con.mic.getAudioTracks().forEach((t) => (t.enabled = true));
      navigator.vibrate?.(15);
      emitir({ tipo: "conectada" });
      void enviarContexto();
      return true;
    } catch {
      abortar();
      if (vigente()) { emitir({ tipo: "fallo" }); optsRef.current.onAviso?.("No se pudo activar el micrófono o el audio. Revisa el permiso del micrófono o escribe tu pregunta."); }
      return false;
    }
  }, [emitir, enviarContexto]);

  /** Se llama SÍNCRONO en pointerdown/keydown: iOS solo deja sonar audio creado y reproducido dentro del gesto. */
  const prepararAudio = useCallback(() => {
    const c = r.current; if (c.audio) return;
    c.audio = Object.assign(new Audio(), { autoplay: true }); c.audio.setAttribute("playsinline", ""); void c.audio.play().catch(() => null);
  }, []);

  /** Un toque: si no hay llamada, la abre con el micrófono abierto; si la hay (o está conectando), cuelga. */
  const alternar = useCallback(async () => {
    const c = r.current;
    if (vozActiva(c.estado)) { colgar("colgó"); return; }
    const p = (c.conectando = conectar());
    await p.finally(() => { if (c.conectando === p) c.conectando = null; }); // un intento viejo no borra la promesa del nuevo
  }, [conectar, colgar]);

  // Contexto de pantalla: cada cambio de vista, ficha, pestaña o filtro.
  // «atrás» vuelve a la pantalla anterior, la haya abierto la voz o la persona.
  const anterior = useRef<{ vista: string; eventoId: string | null } | null>(null);
  useEffect(() => useMesa.subscribe((s, p) => {
    if (s.vista !== p.vista || s.eventoId !== p.eventoId) anterior.current = { vista: p.vista, eventoId: p.eventoId };
    if (s.vista !== p.vista || s.eventoId !== p.eventoId || s.pantalla !== p.pantalla) void enviarContexto();
  }), [enviarContexto]);

  // Regla de cuelgue y acciones de Next, cada segundo y de uno en uno.
  useEffect(() => {
    const t = window.setInterval(async () => {
      const c = r.current; const hilo = c.con.hilo;
      if (!hilo) return;
      // los plazos se evalúan cada segundo aunque una consulta de acciones siga pendiente (revisión de Codex)
      const motivo = debeColgar({ oculta: document.visibilityState === "hidden", sesionVencida: !useMesa.getState().sesion, msSinActividad: Date.now() - c.ultima, enCurso: c.estado === "pensando" || c.estado === "hablando" });
      if (motivo) { colgar(motivo); optsRef.current.onAviso?.(`Colgué porque ${motivo}. Toca el orbe para hablar otra vez.`); return; }
      if (c.sondeando) return;
      c.sondeando = true;
      try {
        const res = await fetchMesa(`/api/voz/acciones?hilo=${encodeURIComponent(hilo)}`);
        if (c.con.hilo !== hilo) return; // la llamada cambió mientras tanto: esta respuesta ya no vale
        if (res.status === 404 || res.status === 401 || res.status === 403) { colgar("la llamada terminó"); return; }
        if (!res.ok) return;
        const cuerpo = (await res.json().catch(() => null)) as { acciones?: { tipo: string; vista?: string; eventoId?: string; direccion?: string; pregunta?: string; respuesta?: unknown; motivo?: string }[] } | null;
        if (c.con.hilo !== hilo || !Array.isArray(cuerpo?.acciones)) return;
        for (const a of cuerpo.acciones) {
          c.ultima = Date.now();
          if (a.tipo === "navegar") { useMesa.getState().irA(a.vista as never, a.eventoId); window.scrollTo({ top: 0 }); if (esCelular(window.innerWidth)) useMesa.getState().setChatAbierto(false); }
          if (a.tipo === "atras" && anterior.current) { useMesa.getState().irA(anterior.current.vista as never, anterior.current.eventoId ?? undefined); window.scrollTo({ top: 0 }); }
          if (a.tipo === "desplazar") desplazar(a.direccion);
          if (a.tipo === "mostrar") optsRef.current.onMostrar?.(a.pregunta ?? "", a.respuesta);
          if (a.tipo === "colgada") { colgar(a.motivo); optsRef.current.onAviso?.(`La llamada terminó: ${a.motivo}. Toca el orbe para hablar otra vez.`); return; }
        }
      } catch { /* red caída: se reintenta en el próximo segundo; el puente corta por su lado si la página deja de consultar */ }
      finally { c.sondeando = false; }
    }, 1000);
    return () => window.clearInterval(t);
  }, [colgar]);

  useEffect(() => () => colgar("cerró la página"), [colgar]);
  return { estado, nivel, prepararAudio, alternar, colgar };
}
