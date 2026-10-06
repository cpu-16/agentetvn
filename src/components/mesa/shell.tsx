"use client";
import { ROLES, horaPanama, useMesa } from "@/store/mesa";
import { cn } from "@/lib/utils";

export function Shell({ corteUTC, version, children }: { corteUTC?: string; version?: string; children: React.ReactNode }) {
  const { vista, rol, irA, setRol } = useMesa();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-tinta text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 lg:px-8">
          <button className="flex items-center gap-2.5 text-left" onClick={() => irA("agenda")}>
            <span className="block h-7 w-1.5 bg-senal" aria-hidden />
            <span>
              <span className="titular block text-lg font-bold leading-none">AgenteTVN</span>
              <span className="block text-[11px] text-white/70">De la señal a la decisión</span>
            </span>
          </button>
          <nav className="flex items-center gap-1 text-sm">
            {(["agenda", "control"] as const).map((v) => (
              <button key={v} onClick={() => irA(v)} className={cn("rounded-sm px-3 py-1.5", vista === v || (v === "agenda" && vista === "ficha") ? "bg-white/15 font-medium" : "text-white/75 hover:text-white")}>
                {v === "agenda" ? "Agenda" : "Control"}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-white/75">
            {corteUTC && (
              <span className="hidden sm:inline">
                Corte del snapshot {horaPanama(corteUTC)} {version ? `(${version})` : ""}
              </span>
            )}
            <label className="flex items-center gap-1.5">
              <span className="sr-only">Rol</span>
              <select value={rol} onChange={(e) => setRol(e.target.value as typeof rol)} className="rounded-sm border border-white/25 bg-transparent px-2 py-1 text-white [&>option]:text-tinta">
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 lg:px-8">{children}</main>
      <footer className="border-t border-border px-4 py-3 text-xs text-muted-foreground lg:px-8">Resultados para revisión humana. Nada se publica desde aquí.</footer>
    </div>
  );
}
