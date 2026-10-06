"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ROLES, EASE_OUT, useMesa, type Rol } from "@/store/mesa";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Entrada() {
  const setSesion = useMesa((s) => s.setSesion);
  const irA = useMesa((s) => s.irA);
  const reducir = useReducedMotion();
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol>("editor");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true); setError(null);
    const r = await fetch("/api/entrar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nombre, rol, pin }) });
    const j = await r.json();
    setOcupado(false);
    if (!r.ok) return setError(j.error ?? `No se pudo entrar (${r.status}).`);
    irA("portada");
    setSesion(j.sesion);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-papel px-4 py-10">
      {/* Haz rojo: se revela una vez, de izquierda a derecha */}
      <motion.div aria-hidden className="pointer-events-none absolute left-0 top-0 h-full w-[46%] bg-tinta" initial={reducir ? { opacity: 0 } : { clipPath: "inset(0 100% 0 0)" }} animate={reducir ? { opacity: 1 } : { clipPath: "inset(0 0% 0 0)" }} transition={{ duration: 0.6, ease: EASE_OUT }} />
      <motion.div aria-hidden className="pointer-events-none absolute left-[46%] top-0 h-full w-2 bg-senal" initial={reducir ? { opacity: 0 } : { clipPath: "inset(100% 0 0 0)" }} animate={reducir ? { opacity: 1 } : { clipPath: "inset(0 0 0 0)" }} transition={{ duration: 0.6, delay: 0.25, ease: EASE_OUT }} />

      <div className="relative grid w-full max-w-5xl gap-10 md:grid-cols-[1fr_1fr] md:items-center">
        <motion.section className="text-white md:pr-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, delay: 0.35 }}>
          <p className="rotulo mb-4 inline-block">Mesa editorial para TVN Media</p>
          <h1 className="titular text-5xl font-bold leading-[0.95] tracking-[-0.02em] sm:text-6xl">AgenteTVN</h1>
          <p className="titular mt-2 text-xl text-white/80">De la señal a la decisión</p>
          <p className="mt-6 max-w-sm text-sm text-white/75">Noticias públicas e indicadores oficiales convertidos en una agenda priorizada, fichas con evidencia y borradores. Una persona revisa; nada se publica solo.</p>
        </motion.section>

        <motion.form onSubmit={entrar} className="rounded-md border border-border bg-white p-6 shadow-[0_24px_60px_-30px_rgba(15,27,45,0.45)] md:ml-8" initial={reducir ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px)" }} animate={{ opacity: 1, transform: "translateY(0px)" }} transition={{ duration: 0.4, delay: 0.5, ease: EASE_OUT }}>
          <h2 className="titular text-2xl font-semibold">Entrar a la mesa</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tu nombre queda como responsable de cada decisión que registres.</p>
          <label className="mt-5 block text-sm">
            <span className="text-muted-foreground">Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus autoComplete="name" className="mt-1 h-10 w-full rounded-sm border border-border px-3 text-foreground" placeholder="Ana Pérez" />
          </label>
          <fieldset className="mt-4">
            <legend className="text-sm text-muted-foreground">Rol en la mesa</legend>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button type="button" key={r.id} onClick={() => setRol(r.id)} className={cn("presionable rounded-sm border px-2 py-2 text-sm", rol === r.id ? "border-tinta bg-tinta text-white" : "border-border bg-white hover:border-tinta/50")} aria-pressed={rol === r.id}>
                  {r.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="mt-4 block text-sm">
            <span className="text-muted-foreground">PIN de la mesa</span>
            <input value={pin} onChange={(e) => setPin(e.target.value)} required type="password" inputMode="text" autoComplete="current-password" className="mt-1 h-10 w-full rounded-sm border border-border px-3 font-mono text-foreground" placeholder="••••••" />
          </label>
          {error && <p className="mt-3 rounded-sm bg-[#fdecef] px-3 py-2 text-sm text-[#9b1526]" role="alert">{error}</p>}
          <Button type="submit" disabled={ocupado} className="presionable mt-5 h-10 w-full bg-senal text-white hover:bg-[#b81e32]">{ocupado ? "Entrando…" : "Entrar a la mesa"}</Button>
          <p className="mt-3 text-[11px] text-muted-foreground">Demo del hackIAthon: el PIN lo entrega el equipo. La sesión dura 12 horas.</p>
        </motion.form>
      </div>
    </main>
  );
}
