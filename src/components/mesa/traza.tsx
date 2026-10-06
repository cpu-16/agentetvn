"use client";
// Cómo buscó Jarvis: la pregunta como vector, la similitud contra todo el corpus con su umbral, lo que se usó y lo que quedó
// fuera, y el tiempo de cada paso. Se dibuja con los datos reales de la consulta (respuesta.traza), no es decorado.
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface Traza {
  modo: "embeddings" | "bm25";
  modelo?: string; dim?: number; vector?: number[];
  comparadas: number; umbral?: number; margen?: number; sobreUmbral: number; k: number;
  histograma?: { desde: number; hasta: number; cuentas: number[] };
  mejores: { id: string; medio: string; titulo: string; score: number; usada: boolean }[];
  pasos: { paso: string; ms: number }[];
  regla?: string;
}

const num = (x: number, d = 2) => x.toLocaleString("es-PA", { minimumFractionDigits: d, maximumFractionDigits: d });
const ms = (x: number) => (x >= 1000 ? `${num(x / 1000, 1)} s` : `${Math.max(1, Math.round(x))} ms`);
const corto = (m?: string) => (m ?? "").split("/").pop()?.replace("multilingual-", "") ?? "";

/** Mientras busca: un campo de puntos que se recorre y el paso en curso (los tiempos reales llegan con la respuesta). */
export function TrazaBuscando({ modo }: { modo: "embeddings" | "bm25" }) {
  const [t, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT((x) => x + 1), 900); return () => clearInterval(i); }, []);
  const pasos = modo === "embeddings" ? ["Convirtiendo tu pregunta en un vector", "Comparándola con cada publicación del corte", "Quedándome con las que superan el umbral", "Redactando con citas"] : ["Buscando tus palabras en cada publicación", "Ordenando por coincidencia", "Redactando con citas"];
  return (
    <div className="traza rounded-md border border-azul/25 bg-[#f2f8fd] px-3 py-2.5" role="status" aria-live="polite">
      <div className="traza-campo" aria-hidden>{Array.from({ length: 60 }, (_, i) => <span key={i} style={{ animationDelay: `${(i % 20) * 45 + Math.floor(i / 20) * 120}ms` }} />)}</div>
      <p className="mt-2 text-xs font-medium text-tinta">{pasos[Math.min(t, pasos.length - 1)]}…</p>
    </div>
  );
}

export function TrazaBusqueda({ traza, llmMs, abierta }: { traza: Traza; llmMs?: number; abierta: boolean }) {
  const reducir = useReducedMotion();
  if (traza.regla) return <p className="traza flex items-start gap-2 rounded-md border border-azul/25 bg-[#f2f8fd] px-3 py-2 text-xs text-tinta"><span className="mt-1 inline-block size-2 flex-none rounded-full bg-tinta" aria-hidden /><span><span className="font-medium">Sin búsqueda por sentido.</span> {traza.regla}</span></p>;
  const emb = traza.modo === "embeddings";
  const usadas = traza.mejores.filter((m) => m.usada).length;
  const h = traza.histograma;
  const max = h ? Math.max(...h.cuentas, 1) : 1;
  const x = (s: number) => (h ? Math.min(100, Math.max(0, ((s - h.desde) / (h.hasta - h.desde || 1)) * 100)) : 0);
  const resumen = emb
    ? `Por sentido: ${traza.comparadas.toLocaleString("es-PA")} publicaciones comparadas, ${traza.sobreUmbral} sobre el umbral, ${usadas} usada${usadas === 1 ? "" : "s"}`
    : `Por palabras: ${traza.comparadas.toLocaleString("es-PA")} publicaciones revisadas, ${usadas} usadas`;
  const entra = (i: number) => (reducir ? {} : { initial: { opacity: 0, transform: "translateY(4px)" }, animate: { opacity: 1, transform: "translateY(0px)" }, transition: { duration: 0.22, delay: i * 0.12, ease: [0.23, 1, 0.32, 1] as const } });
  return (
    <details className="traza group rounded-md border border-azul/25 bg-[#f2f8fd] text-xs" open={abierta}>
      <summary className="presionable flex min-h-11 cursor-pointer sm:min-h-9 list-none items-center gap-2 px-3 py-1.5 font-medium text-tinta [&::-webkit-details-marker]:hidden">
        <span className="inline-block size-2 rounded-full bg-azul" aria-hidden />
        <span className="flex-1">{resumen}</span>
        <span className="text-muted-foreground transition-transform group-open:rotate-90" aria-hidden>▸</span>
      </summary>
      <div className="space-y-3 px-3 pb-3">
        {emb && traza.vector && (
          <motion.div {...entra(0)}>
            <p className="mb-1 text-[11px] text-muted-foreground">1 · Tu pregunta como vector ({corto(traza.modelo)}, {traza.dim} dimensiones; se ven las primeras {traza.vector.length})</p>
            <div className="traza-vector" aria-hidden>
              {traza.vector.map((v, i) => <span key={i} style={{ background: v >= 0 ? "var(--azul)" : "#7a8da3", opacity: Math.min(1, 0.18 + Math.abs(v) * 9), transform: `scaleY(${Math.min(1, 0.25 + Math.abs(v) * 10)})`, animationDelay: reducir ? undefined : `${i * 12}ms` }} />)}
            </div>
          </motion.div>
        )}
        {emb && h && traza.umbral !== undefined && (
          <motion.div {...entra(1)}>
            <p className="mb-1 text-[11px] text-muted-foreground">2 · Similitud con cada una de las {traza.comparadas.toLocaleString("es-PA")} publicaciones</p>
            <div className="relative h-16" role="img" aria-label={`Distribución de similitud: ${traza.sobreUmbral} publicaciones superan el umbral de ${num(traza.umbral)}; se usaron las ${usadas} más parecidas.`}>
              <div className="absolute inset-x-0 bottom-0 flex h-full items-end gap-px">
                {h.cuentas.map((c, i) => {
                  const desde = h.desde + ((h.hasta - h.desde) * i) / h.cuentas.length;
                  return <span key={i} className={cn("traza-barra flex-1 rounded-t-[1px]", desde + (h.hasta - h.desde) / h.cuentas.length > traza.umbral! ? "bg-azul" : "bg-[#b9c7d6]")} style={{ height: `${c ? Math.max(4, Math.sqrt(c / max) * 100) : 0}%`, animationDelay: reducir ? undefined : `${120 + i * 14}ms` }} />;
                })}
              </div>
              <div className="absolute inset-y-0 border-l-2 border-dashed border-tinta" style={{ left: `${x(traza.umbral)}%` }} aria-hidden>
                <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded-sm bg-white/90 px-1 text-[10px] font-medium text-tinta">umbral {num(traza.umbral)}</span>
              </div>
              {traza.margen !== undefined && traza.mejores[0] && usadas > 0 && <div className="absolute inset-y-0 bg-azul/15" style={{ left: `${x(traza.mejores[0].score - traza.margen)}%`, right: `${100 - x(traza.mejores[0].score)}%` }} aria-hidden />}
              {traza.mejores.filter((m) => m.usada).map((m) => <span key={m.id} className="traza-marca" style={{ left: `${x(m.score)}%` }} aria-hidden />)}
            </div>
            <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground" aria-hidden><span>{num(h.desde)} menos parecida</span><span>más parecida {num(h.hasta)}</span></div>
          </motion.div>
        )}
        <motion.div {...entra(2)}>
          <p className="mb-1 text-[11px] text-muted-foreground">{emb ? `3 · Las más parecidas. Se usan las que superan el umbral y quedan a ${num(traza.margen ?? 0)} o menos de la mejor (azul); las grises quedaron fuera` : "Las de más coincidencia (azul: usadas; gris: quedaron fuera)"}</p>
          <ol className="space-y-1">
            {traza.mejores.map((m) => (
              <li key={m.id} className={cn("grid grid-cols-[3.2rem_1fr] items-center gap-2", !m.usada && "opacity-60")}>
                <span className="relative h-4 overflow-hidden rounded-sm bg-[#dde6ef]">
                  <span className={cn("traza-puntaje absolute inset-y-0 left-0", m.usada ? "bg-azul" : "bg-[#9fb0c2]")} style={{ width: `${emb && h ? Math.max(6, x(m.score)) : Math.max(6, (m.score / (traza.mejores[0]?.score || 1)) * 100)}%` }} />
                  <span className={cn("relative block px-1 text-[10px] font-semibold tabular-nums leading-4", m.usada ? "text-white" : "text-tinta")}>{num(m.score, emb ? 3 : 1)}</span>
                </span>
                <span className="line-clamp-2 sm:truncate" title={m.titulo}><span className="sr-only">{m.usada ? "Usada: " : "Quedó fuera: "}</span><span className="font-medium">{m.medio}</span> · {m.titulo}</span>
              </li>
            ))}
          </ol>
        </motion.div>
        <motion.ol {...entra(3)} className="flex flex-wrap items-center gap-1 text-[11px]" aria-label="Pasos y tiempos">
          {traza.pasos.map((p) => <li key={p.paso} className="rounded-full bg-white px-2 py-0.5 ring-1 ring-border"><span className="text-muted-foreground">{p.paso}</span> <span className="font-semibold tabular-nums">{ms(p.ms)}</span></li>)}
          {llmMs !== undefined && <li className="rounded-full bg-white px-2 py-0.5 ring-1 ring-border"><span className="text-muted-foreground">redactar con citas</span> <span className="font-semibold tabular-nums">{ms(llmMs)}</span></li>}
        </motion.ol>
      </div>
    </details>
  );
}
