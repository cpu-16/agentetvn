"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { ROLES, SPRING, horaPanama, useMesa } from "@/store/mesa";
import { cn } from "@/lib/utils";

const NAV: { v: "portada" | "agenda" | "tablero" | "control"; label: string }[] = [
  { v: "portada", label: "Portada" },
  { v: "agenda", label: "Agenda" },
  { v: "tablero", label: "Tablero" },
  { v: "control", label: "Control" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const vista = useMesa((s) => s.vista);
  const sesion = useMesa((s) => s.sesion);
  const irA = useMesa((s) => s.irA);
  const cerrarSesion = useMesa((s) => s.cerrarSesion);
  const corteUTC = useMesa((s) => s.agenda?.corteUTC);
  const version = useMesa((s) => s.agenda?.version);
  const [errorSalir, setErrorSalir] = useState<string | null>(null);
  const activa = vista === "ficha" ? "agenda" : vista;
  const salir = async () => {
    setErrorSalir(null);
    try {
      const r = await fetch("/api/entrar", { method: "DELETE" });
      if (!r.ok) throw new Error(String(r.status));
      cerrarSesion("Saliste de la mesa.");
    } catch {
      setErrorSalir("No se pudo cerrar la sesión. Intenta otra vez.");
    }
  };
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-white focus:px-3 focus:py-2 focus:text-sm">Ir al contenido</a>
      <header className="vidrio-tinta sticky top-0 z-40 text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 lg:px-8">
          <button className="presionable flex items-center gap-3 text-left" onClick={() => irA("portada")} aria-label="AgenteTVN de TVN Media, ir a la portada">
            {/* el logo completo en blanco: el círculo de 28 px se perdía sobre la barra azul (pedido de Gilberto, 7-oct) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/tvn-media-blanco.png" alt="TVN Media" width={82} height={36} className="h-9 w-auto" />
            <span className="h-8 w-px bg-white/30" aria-hidden />
            <span>
              <span className="titular block text-lg font-bold leading-none">AgenteTVN</span>
              <span className="block text-[11px] text-white/70">Mesa editorial asistida</span>
            </span>
          </button>
          <nav className="relative flex items-center gap-1 text-sm" aria-label="Secciones">
            {NAV.map((n) => (
              <button key={n.v} onClick={() => irA(n.v)} aria-current={activa === n.v ? "page" : undefined} className={cn("presionable relative rounded-sm px-3 py-1.5", activa === n.v ? "font-medium text-white" : "text-white/70 hover:text-white")}>
                {activa === n.v && <motion.span layoutId="nav-activa" className="absolute inset-0 rounded-sm bg-white/15" transition={SPRING} aria-hidden />}
                <span className="relative">{n.label}</span>
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-white/75">
            {corteUTC && <span className="hidden md:inline">Datos al {horaPanama(corteUTC)}{version ? ` (${version})` : ""}</span>}
            {sesion && (
              <span className="flex items-center gap-2">
                <span className="hidden sm:inline">{sesion.nombre}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-tinta" title="Tu rol en la mesa">{ROLES.find((r) => r.id === sesion.rol)?.label}</span>
                <button onClick={salir} className="presionable rounded-sm border border-white/25 px-2 py-1 text-white hover:bg-white/10">Salir</button>
              </span>
            )}
          </div>
          {errorSalir && <p className="w-full text-xs text-[#ffb4bd]" role="alert">{errorSalir}</p>}
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 lg:px-8">{children}</main>
      <footer className="border-t border-border px-4 py-3 text-xs text-muted-foreground lg:px-8">
        <p>Resultados para revisión humana. Nada se publica desde aquí.</p>
        <p className="mt-1 text-[11px] text-muted-foreground/80">Prototipo del hackIAthon Panamá 2026 para TVN Media. Logos propiedad de TVN Media.</p>
      </footer>
    </div>
  );
}
