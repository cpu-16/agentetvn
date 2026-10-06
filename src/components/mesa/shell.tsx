"use client";
import { motion } from "framer-motion";
import { ROLES, SPRING, horaPanama, useMesa } from "@/store/mesa";
import { cn } from "@/lib/utils";

const NAV: { v: "portada" | "agenda" | "tablero" | "control"; label: string }[] = [
  { v: "portada", label: "Portada" },
  { v: "agenda", label: "Agenda" },
  { v: "tablero", label: "Tablero" },
  { v: "control", label: "Control" },
];

export function Shell({ corteUTC, version, children }: { corteUTC?: string; version?: string; children: React.ReactNode }) {
  const { vista, sesion, irA, setSesion, setChatAbierto } = useMesa();
  const activa = vista === "ficha" ? "agenda" : vista;
  const salir = async () => {
    await fetch("/api/entrar", { method: "DELETE" });
    setChatAbierto(false);
    setSesion(null);
    irA("portada");
  };
  return (
    <div className="flex min-h-screen flex-col">
      <header className="vidrio-tinta sticky top-0 z-40 text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 lg:px-8">
          <button className="presionable flex items-center gap-2.5 text-left" onClick={() => irA("portada")}>
            <span className="block h-7 w-1.5 bg-senal" aria-hidden />
            <span>
              <span className="titular block text-lg font-bold leading-none">AgenteTVN</span>
              <span className="block text-[11px] text-white/70">Mesa editorial para TVN Media</span>
            </span>
          </button>
          <nav className="relative flex items-center gap-1 text-sm" aria-label="Secciones">
            {NAV.map((n) => (
              <button key={n.v} onClick={() => irA(n.v)} className={cn("presionable relative rounded-sm px-3 py-1.5", activa === n.v ? "font-medium text-white" : "text-white/70 hover:text-white")}>
                {activa === n.v && <motion.span layoutId="nav-activa" className="absolute inset-0 rounded-sm bg-white/15" transition={SPRING} aria-hidden />}
                <span className="relative">{n.label}</span>
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-white/75">
            {corteUTC && <span className="hidden md:inline">Corte del snapshot {horaPanama(corteUTC)}{version ? ` (${version})` : ""}</span>}
            {sesion && (
              <span className="flex items-center gap-2">
                <span className="hidden sm:inline">{sesion.nombre}, {ROLES.find((r) => r.id === sesion.rol)?.label.toLowerCase()}</span>
                <button onClick={salir} className="presionable rounded-sm border border-white/25 px-2 py-1 text-white hover:bg-white/10">Salir</button>
              </span>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 lg:px-8">{children}</main>
      <footer className="border-t border-border px-4 py-3 text-xs text-muted-foreground lg:px-8">Resultados para revisión humana. Nada se publica desde aquí.</footer>
    </div>
  );
}
