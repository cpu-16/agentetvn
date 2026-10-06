"use client";
// Cliente de voz de Jarvis-TVN: WebRTC directo a OpenAI (la oferta pasa por /api/voz/offer con la sesión), pulsar para hablar,
// eventos turn.* del canal oai-events, acciones de Next (navegar/mostrar/colgada) y contexto de la pantalla.
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMesa, useMesa } from "@/store/mesa";
import { contextoDesdeMesa } from "@/lib/voz/catalogo";
import { debeColgar, siguiente, type EstadoVoz, type EventoVoz } from "./maquina";
import { esCelular } from "./panel";

type Opts = { onTranscripcion?: (quien: "persona" | "jarvis", texto: string) => void; onMostrar?: (pregunta: string, respuesta: unknown) => void; onAviso?: (texto: string) => void };

export function useVoz(opts: Opts = {}) {
  const [estado, setEstado] = useState<EstadoVoz>("inactiva");
  const [nivel, setNivel] = useState(0);
  const r = useRef<{ pc?: RTCPeerConnection; mic?: MediaStream; audio?: HTMLAudioElement; hilo?: string; ctx?: AudioContext; ultima: number; enCurso: boolean; pulsando: boolean; roles: Record<string, string>; estado: EstadoVoz }>({ ultima: Date.now(), enCurso: false, pulsando: false, roles: {}, estado: "inactiva" });
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });
  const emitir = useCallback((ev: EventoVoz) => { r.current.estado = siguiente(r.current.estado, ev); setEstado(r.current.estado); }, []);

  const colgar = useCallback((motivo = "colgó") => {
    const c = r.current;
    if (c.hilo) void fetch(`/api/voz/colgar?hilo=${encodeURIComponent(c.hilo)}&motivo=${encodeURIComponent(motivo)}`, { method: "POST" }).catch(() => null);
    c.pc?.close(); c.mic?.getTracks().forEach((t) => t.stop()); void c.ctx?.close().catch(() => null);
    Object.assign(c, { pc: undefined, mic: undefined, hilo: undefined, ctx: undefined, enCurso: false, pulsando: false });
    setNivel(0); emitir({ tipo: "colgar" });
  }, [emitir]);

  const enviarContexto = useCallback(async () => {
    const c = r.current; if (!c.hilo) return;
    const s = useMesa.getState();
    await fetchMesa(`/api/voz/contexto?hilo=${encodeURIComponent(c.hilo)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(contextoDesdeMesa(s)) }).catch(() => null);
  }, []);

  const conectar = useCallback(async () => {
    const c = r.current;
    emitir({ tipo: "conectar" });
    try {
      const est = await (await fetchMesa("/api/voz/estado")).json();
      if (!est.disponible) { emitir({ tipo: "fallo" }); optsRef.current.onAviso?.(`${est.motivo ?? "La voz no está disponible ahora."} Puedes escribir tu pregunta.`); return false; }
      c.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      c.mic.getAudioTracks().forEach((t) => (t.enabled = false)); // pulsar para hablar: cerrado hasta que se presiona
      c.ctx = new AudioContext(); const an = c.ctx.createAnalyser(); c.ctx.createMediaStreamSource(c.mic).connect(an);
      const datos = new Uint8Array(an.fftSize);
      const medir = () => { if (!c.ctx) return; an.getByteTimeDomainData(datos); let m = 0; for (const v of datos) m = Math.max(m, Math.abs(v - 128)); setNivel(c.pulsando ? Math.min(1, Math.round((m / 64) * 10) / 10) : 0); requestAnimationFrame(medir); };
      requestAnimationFrame(medir);
      const pc = (c.pc = new RTCPeerConnection());
      c.mic.getTracks().forEach((t) => pc.addTrack(t, c.mic!));
      pc.ontrack = (e) => { try { if ("jitterBufferTarget" in e.receiver) (e.receiver as unknown as { jitterBufferTarget: number }).jitterBufferTarget = 200; } catch { /* opcional */ } c.audio!.srcObject = e.streams[0]; };
      const dc = pc.createDataChannel("oai-events");
      dc.onmessage = (m) => {
        const ev = JSON.parse(m.data); if (!ev.type?.startsWith("turn.")) return;
        const turno = ev.turn ?? {}; if (ev.type === "turn.created") c.roles[turno.id] = turno.role;
        const rol = (turno.role ?? c.roles[ev.turn_id]) === "user" ? "user" : "assistant";
        c.ultima = Date.now(); c.enCurso = ev.type === "turn.created";
        emitir({ tipo: ev.type === "turn.created" ? "turno_creado" : "turno_hecho", rol });
        if (ev.type === "turn.done" && turno.transcript) optsRef.current.onTranscripcion?.(rol === "user" ? "persona" : "jarvis", turno.transcript);
      };
      await pc.setLocalDescription(await pc.createOffer());
      const of = await fetchMesa("/api/voz/offer", { method: "POST", body: pc.localDescription!.sdp, headers: { "content-type": "application/sdp" } });
      if (!of.ok) { const j = await of.json().catch(() => ({})); colgar("no conectó"); emitir({ tipo: "fallo" }); optsRef.current.onAviso?.(j.error ?? "La voz no está disponible ahora. Puedes escribir tu pregunta."); return false; }
      c.hilo = of.headers.get("x-hilo") ?? undefined;
      await pc.setRemoteDescription({ type: "answer", sdp: await of.text() });
      emitir({ tipo: "conectada" }); c.ultima = Date.now();
      void enviarContexto();
      return true;
    } catch {
      colgar("falló el audio"); emitir({ tipo: "fallo" });
      optsRef.current.onAviso?.("No se pudo activar el micrófono o el audio. Revisa el permiso del micrófono o escribe tu pregunta.");
      return false;
    }
  }, [colgar, emitir, enviarContexto]);

  /** Se llama SÍNCRONO en pointerdown: iOS solo deja sonar audio creado y reproducido dentro del gesto. */
  const prepararAudio = useCallback(() => {
    const c = r.current; if (c.audio) return;
    c.audio = Object.assign(new Audio(), { autoplay: true }); c.audio.setAttribute("playsinline", ""); void c.audio.play().catch(() => null);
  }, []);

  const pulsar = useCallback(async () => {
    const c = r.current;
    if (!c.hilo && !(await conectar())) return; // la primera pulsación conecta dentro del gesto
    c.pulsando = true; c.mic?.getAudioTracks().forEach((t) => (t.enabled = true)); c.ultima = Date.now();
    navigator.vibrate?.(15);
    emitir({ tipo: "pulsar" });
  }, [conectar, emitir]);

  const soltar = useCallback(() => {
    const c = r.current; if (!c.pulsando) return;
    c.pulsando = false; c.mic?.getAudioTracks().forEach((t) => (t.enabled = false)); c.ultima = Date.now();
    emitir({ tipo: "soltar" });
  }, [emitir]);

  // Contexto de pantalla: cada cambio de vista, ficha, pestaña o filtro.
  useEffect(() => useMesa.subscribe((s, p) => { if (s.vista !== p.vista || s.eventoId !== p.eventoId || s.pantalla !== p.pantalla) void enviarContexto(); }), [enviarContexto]);

  // Acciones de Next (navegar, mostrar, colgada) y regla de cuelgue, cada segundo durante la llamada.
  useEffect(() => {
    const t = window.setInterval(async () => {
      const c = r.current; if (!c.hilo) return;
      const motivo = debeColgar({ oculta: document.visibilityState === "hidden", sesionVencida: !useMesa.getState().sesion, msSinActividad: Date.now() - c.ultima, enCurso: c.enCurso || c.pulsando });
      if (motivo) { colgar(motivo); optsRef.current.onAviso?.(`Colgué la voz: ${motivo}. Mantén presionado el orbe para hablar de nuevo.`); return; }
      const res = await fetchMesa(`/api/voz/acciones?hilo=${encodeURIComponent(c.hilo)}`).catch(() => null);
      if (!res) return;
      if (res.status === 404 || res.status === 401) { colgar("la llamada terminó"); return; }
      const { acciones } = await res.json();
      for (const a of acciones as { tipo: string; vista?: string; eventoId?: string; pregunta?: string; respuesta?: unknown; motivo?: string }[]) {
        c.ultima = Date.now();
        if (a.tipo === "navegar") { useMesa.getState().irA(a.vista as never, a.eventoId); if (esCelular(window.innerWidth)) useMesa.getState().setChatAbierto(false); }
        if (a.tipo === "mostrar") optsRef.current.onMostrar?.(a.pregunta ?? "", a.respuesta);
        if (a.tipo === "colgada") { colgar(a.motivo); optsRef.current.onAviso?.(`La llamada terminó: ${a.motivo}.`); }
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [colgar]);

  useEffect(() => () => colgar("cerró la página"), [colgar]);
  return { estado, nivel, prepararAudio, pulsar, soltar, colgar };
}
