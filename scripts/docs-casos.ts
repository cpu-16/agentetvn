// Genera docs/notion/05-casos-y-evidencias.md con ≥5 fichas trazables (incluida una sin evidencia suficiente y los casos sintéticos marcados).
import { writeFileSync, mkdirSync } from "fs";
import { stringify } from "csv-stringify/sync";
import { cargarSnapshot } from "../src/lib/motor/cargar";
import { generarPaquete } from "../src/lib/motor/paquete";
import { hora } from "../src/lib/motor/consulta";

const snap = cargarSnapshot("data/processed", { forzar: true });
const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
const esSint = (e: (typeof snap.eventos)[number]) => e.ids_noticia.some((i) => porId.get(i)?.sintetica);
const reales = snap.eventos.filter((e) => !esSint(e) && !["deportes", "otro"].includes(e.tema));
const elegidos = [
  reales.find((e) => e.contexto.indicadores.length) ?? reales[0], // económico con serie oficial (CU-02)
  snap.eventos.find((e) => esSint(e) && e.procedencias.some((p) => p.id === "agencia:EFE"))!, // agencia replicada (CU-03)
  reales.find((e) => e.rango === "alto" && e.estado_evidencia === "insuficiente")!, // alta prioridad, evidencia insuficiente
  snap.eventos.find((e) => e.contradicciones.length)!, // contradicción (CU-04)
  reales.find((e) => e.ids_noticia.length >= 3 && e.procedencias.length >= 2) ?? reales[1], // corroboración independiente
  snap.eventos.find((e) => e.no_confiable)!, // inyección (T07)
].filter((e, i, a) => e && a.indexOf(e) === i);
let md = `# Casos y evidencias · AgenteTVN (snapshot ${snap.manifest.version}, corte ${snap.manifest.fecha_corte_UTC})\n\nCada ficha: ID, fuentes, puntaje desglosado, estado de evidencia, borrador (extractivo) y persona revisora (se registra en la app; aquí el estado inicial).\n\n`;
for (const e of elegidos) {
  const rep = porId.get(e.representante)!;
  const p = generarPaquete(e, snap.noticias, snap.indicadores);
  const c = e.componentes;
  md += `## ${e.id} · ${rep.titulo}${esSint(e) ? " · **caso sintético (prueba)**" : ""}\n\n`;
  md += `- Tema: ${e.tema}${e.por_revisar ? " (por revisar)" : ""} · Rango: ${e.rango} · **P = ${e.P}** = 30×${c.R} + 25×${c.I} + 20×${c.U} + 15×${c.N} + 10×${c.E}\n`;
  md += `- R: ${c.explicacion.R} · I: ${c.explicacion.I} · U: ${c.explicacion.U} · N: ${c.explicacion.N} · E: ${c.explicacion.E}\n`;
  md += `- Estado de evidencia: **${e.estado_evidencia}** · Revisión: nuevo · Persona revisora: (pendiente)\n`;
  md += `- Fuentes (${e.ids_noticia.length}): ${e.ids_noticia.map((i) => { const n = porId.get(i)!; return `${n.id_noticia} [${n.medio}${n.no_confiable ? ", NO CONFIABLE" : ""}] ${n.url}`; }).join("; ")}\n`;
  md += `- Procedencias: ${e.procedencias.map((x) => `${x.nombre} (${x.ids_noticia.length})`).join(", ")}\n`;
  if (e.contexto.indicadores.length) md += `- Contexto oficial: ${e.contexto.indicadores.join(", ")} (Banco Mundial, contexto histórico)\n`;
  if (e.contradicciones.length) md += `- Contradicciones: ${e.contradicciones.map((x) => x.detalle).join(" | ")}\n`;
  md += `- Fecha original: ${hora(e.fecha_original)}\n`;
  md += `- Borrador (brief, ${p.brief.length} afirmaciones): ${p.brief.map((a) => `[${a.tipo} → ${a.evidence_id}:${a.campo}] ${a.texto}`).join(" ")}\n`;
  md += `- Verificaciones pendientes: ${p.verificaciones.join(" ")}\n\n`;
}
writeFileSync("docs/notion/05-casos-y-evidencias.md", md);
// hoja para elegir 5 temas a ciegas (Precision@5): sin P ni orden
mkdirSync("data/labels", { recursive: true });
const candidatos = reales.filter((e) => !e.por_revisar || true).slice(0, 60);
const mezcla = [...candidatos].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync("data/labels/cinco.csv", stringify(mezcla.map((e) => ({ id_evento: e.id, titulo: porId.get(e.representante)!.titulo, medio: porId.get(e.representante)!.medio, fecha: hora(e.fecha_original), elegido: "", revisado_por: "" })), { header: true }));
console.log(`${elegidos.length} fichas → docs/notion/05-casos-y-evidencias.md · hoja a ciegas: data/labels/cinco.csv (${mezcla.length} temas; marcar elegido=si en 5)`);
