"use client";
// Cliente de voz de Jarvis-TVN: WebRTC directo a OpenAI (la oferta pasa por /api/voz/offer con la sesión), pulsar para hablar,
// eventos turn.* del canal oai-events, acciones de Next (navegar/mostrar/colgada) y contexto de la pantalla.
// Reglas contra fugas de micrófono y carreras: una sola conexión a la vez (promesa compartida); cada intento tiene un número
// que colgar invalida (lo que llegue tarde se cierra); la intención de hablar se registra ANTES de esperar; el sondeo va de
// uno en uno y descarta respuestas de otra llamada.
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMesa, useMesa } from "@/store/mesa";
import { contextoDesdeMesa } from "@/lib/voz/catalogo";
import { debeColgar, siguiente, type EstadoVoz, type EventoVoz } from "./maquina";
import { esCelular } from "./panel";

type Opts = { onTranscripcion?: (quien: "persona" | "jarvis", texto: string) => void; onMostrar?: (pregunta: string, respuesta: unknown) => void; onAviso?: (texto: string) => void };
interface Conexion { pc?: RTCPeerConnection; mic?: MediaStream; ctx?: AudioContext; raf?: number; hilo?: string }

/** Cierra TODO lo de una conexión (micrófono, contexto, animación, WebRTC). Idempotente. */
function cerrarConexion(con: Conexion) {
  if (con.raf) cancelAnimationFrame(con.raf);
  con.pc?.close(); con.mic?.getTracks().forEach((t) => t.stop()); void con.ctx?.close().catch(() => null);
}

export function useVoz(opts: Opts = {}) {
  const [estado, setEstado] = useState<EstadoVoz>("inactiva");
  const [nivel, setNivel] = useState(0);
  const r = useRef({ intento: 0, conectando: null as Promise<boolean> | null, con: {} as Conexion, audio: undefined as HTMLAudioElement | undefined, quiereHablar: false, ultima: Date.now(), enCurso: false, roles: {} as Record<string, string>, estado: "inactiva" as EstadoVoz, sondeando: false });
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });
  const emitir = useCallback((ev: EventoVoz) => { r.current.estado = siguiente(r.current.estado, ev); setEstado(r.current.estado); }, []);

  const colgar = useCallback((motivo = "colgó") => {
    const c = r.current;
    c.intento++; // invalida cualquier conexión en curso: lo que llegue tarde se cierra al llegar
    c.conectando = null; c.quiereHablar = false; c.enCurso = false;
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
      con.mic.getAudioTracks().forEach((t) => (t.enabled = false)); // cerrado hasta confirmar que todavía quiere hablar
      con.ctx = new AudioContext(); const an = con.ctx.createAnalyser(); con.ctx.createMediaStreamSource(con.mic).connect(an);
      const datos = new Uint8Array(an.fftSize);
      const medir = () => { an.getByteTimeDomainData(datos); let m = 0; for (const v of datos) m = Math.max(m, Math.abs(v - 128)); setNivel(c.quiereHablar ? Math.min(1, Math.round((m / 64) * 10) / 10) : 0); con.raf = requestAnimationFrame(medir); };
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
        c.ultima = Date.now(); c.enCurso = ev.type === "turn.created";
        emitir({ tipo: ev.type === "turn.created" ? "turno_creado" : "turno_hecho", rol });
        if (ev.type === "turn.done" && turno.transcript) optsRef.current.onTranscripcion?.(rol === "user" ? "persona" : "jarvis", turno.transcript);
      };
      await pc.setLocalDescription(await pc.createOffer());
      if (!vigente()) return abortar();
      const of = await fetchMesa("/api/voz/offer", { method: "POST", body: pc.localDescription!.sdp, headers: { "content-type": "application/sdp" } });
      const hilo = of.headers.get("x-hilo") ?? undefined;
      if (!vigente()) { if (hilo) void fetch(`/api/voz/colgar?hilo=${encodeURIComponent(hilo)}&motivo=cancelada`, { method: "POST" }).catch(() => null); return abortar(); }
      if (!of.ok || !hilo) { const j = await of.json().catch(() => ({})); abortar(); emitir({ tipo: "fallo" }); optsRef.current.onAviso?.(j.error ?? "La voz no está disponible ahora. Puedes escribir tu pregunta."); return false; }
      con.hilo = hilo;
      await pc.setRemoteDescription({ type: "answer", sdp: await of.text() });
      if (!vigente()) { void fetch(`/api/voz/colgar?hilo=${encodeURIComponent(hilo)}&motivo=cancelada`, { method: "POST" }).catch(() => null); return abortar(); }
      c.con = con; c.ultima = Date.now();
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

  const pulsar = useCallback(async () => {
    const c = r.current;
    c.quiereHablar = true; // la intención se registra ANTES de esperar: si suelta mientras conecta, no se abre el micrófono
    if (!c.con.hilo) {
      c.conectando ??= conectar().finally(() => { c.conectando = null; });
      const ok = await c.conectando;
      if (!ok || !c.quiereHablar) return; // soltó o colgó mientras conectaba
    }
    c.con.mic?.getAudioTracks().forEach((t) => (t.enabled = true)); c.ultima = Date.now();
    navigator.vibrate?.(15);
    emitir({ tipo: "pulsar" });
  }, [conectar, emitir]);

  const soltar = useCallback(() => {
    const c = r.current;
    const hablaba = c.quiereHablar;
    c.quiereHablar = false;
    c.con.mic?.getAudioTracks().forEach((t) => (t.enabled = false)); // siempre, aunque todavía no hubiera pista
    if (hablaba) { c.ultima = Date.now(); emitir({ tipo: "soltar" }); }
  }, [emitir]);

  // Contexto de pantalla: cada cambio de vista, ficha, pestaña o filtro.
  useEffect(() => useMesa.subscribe((s, p) => { if (s.vista !== p.vista || s.eventoId !== p.eventoId || s.pantalla !== p.pantalla) void enviarContexto(); }), [enviarContexto]);

  // Regla de cuelgue y acciones de Next, cada segundo y de uno en uno.
  useEffect(() => {
    const t = window.setInterval(async () => {
      const c = r.current; const hilo = c.con.hilo;
      if (!hilo || c.sondeando) return;
      const motivo = debeColgar({ oculta: document.visibilityState === "hidden", sesionVencida: !useMesa.getState().sesion, msSinActividad: Date.now() - c.ultima, enCurso: c.enCurso || c.quiereHablar });
      if (motivo) { colgar(motivo); optsRef.current.onAviso?.(`Colgué la voz: ${motivo}. Mantén presionado para hablar de nuevo.`); return; }
      c.sondeando = true;
      try {
        const res = await fetchMesa(`/api/voz/acciones?hilo=${encodeURIComponent(hilo)}`);
        if (c.con.hilo !== hilo) return; // la llamada cambió mientras tanto: esta respuesta ya no vale
        if (res.status === 404 || res.status === 401 || res.status === 403) { colgar("la llamada terminó"); return; }
        if (!res.ok) return;
        const cuerpo = (await res.json().catch(() => null)) as { acciones?: { tipo: string; vista?: string; eventoId?: string; pregunta?: string; respuesta?: unknown; motivo?: string }[] } | null;
        if (c.con.hilo !== hilo || !Array.isArray(cuerpo?.acciones)) return;
        for (const a of cuerpo.acciones) {
          c.ultima = Date.now();
          if (a.tipo === "navegar") { useMesa.getState().irA(a.vista as never, a.eventoId); if (esCelular(window.innerWidth)) useMesa.getState().setChatAbierto(false); }
          if (a.tipo === "mostrar") optsRef.current.onMostrar?.(a.pregunta ?? "", a.respuesta);
          if (a.tipo === "colgada") { colgar(a.motivo); optsRef.current.onAviso?.(`La llamada terminó: ${a.motivo}.`); return; }
        }
      } catch { /* red caída: se reintenta en el próximo segundo; el puente corta por su lado si la página deja de consultar */ }
      finally { c.sondeando = false; }
    }, 1000);
    return () => window.clearInterval(t);
  }, [colgar]);

  useEffect(() => () => colgar("cerró la página"), [colgar]);
  return { estado, nivel, prepararAudio, pulsar, soltar, colgar };
}
