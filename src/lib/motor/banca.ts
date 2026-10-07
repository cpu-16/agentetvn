// Public-source sector bulletin. Facts come from the same evidence core as TVN.
import type { Afirmacion, BoletinBancario, Evento, Indicador, Noticia } from "./contrato";
import { afirmacionNoticia } from "./consulta";
import { generarPaquete } from "./paquete";
import { fuenteNoticia, fuentesDe, sostenida } from "./llm";
import { esNoConfiable } from "./inyeccion";
import { z } from "zod";

const LEYENDA = "Basado únicamente en titular/metadatos. Sectores e hipótesis por verificar. La aprobación humana no publica.";
const SECTORES: Record<string, string[]> = {
  economia: ["Actividad económica"], logistica_canal: ["Logística", "Transporte"],
  turismo: ["Turismo", "Hotelería"], servicios_publicos: ["Servicios públicos"],
  eventos_naturales: ["Infraestructura"], regulacion: ["Sectores regulados"],
};
const PREGUNTAS: [string, string, string] = [
  "¿Qué fuente primaria confirma la señal y su alcance sectorial?",
  "¿Qué exposición sectorial debe verificar el analista con datos públicos?",
  "¿Qué evidencia falta para establecer el horizonte y contrastar la hipótesis?",
];
const cortar = (s: string, n: number) => s.trim().split(/\s+/).slice(0, n).join(" ");
export function palabrasBoletin(b: BoletinBancario) {
  return [b.titulo, ...b.sectores, b.horizonte, ...b.hechos.map((a) => a.texto),
    ...b.hipotesis.map((a) => a.texto), ...b.faltantes, ...b.preguntas, b.leyenda]
    .join(" ").trim().split(/\s+/).filter(Boolean).length;
}
export function generarBoletin(ev: Evento, noticias: Noticia[], indicadores: Indicador[], huella: string): BoletinBancario {
  const base = generarPaquete(ev, noticias, indicadores);
  const factuales = base.brief.filter((a) => ["hecho_reportado", "declaracion"].includes(a.tipo));
  const pareja = ev.contradicciones[0] ? [ev.contradicciones[0].a, ev.contradicciones[0].b]
    .map((id) => noticias.find((n) => n.id_noticia === id && ev.ids_noticia.includes(id) && !n.no_confiable)).filter((n): n is Noticia => !!n).map(afirmacionNoticia) : [];
  const contexto = factuales.find((a) => a.alcance === "fila_indicador");
  const candidatas = [...pareja, ...factuales.filter((a) => a.alcance !== "fila_indicador")];
  const unicas = [...new Map(candidatas.map((a) => [a.evidence_id + ":" + a.campo, a])).values()].slice(0, contexto ? 2 : 3);
  const hechos = [...unicas, ...(contexto ? [contexto] : [])].map((a) => ({ ...a, texto: cortar(a.texto, 30) }));
  const b: BoletinBancario = {
    modalidad: "banca", eventoId: ev.id, huella, titulo: cortar(base.titulo || "Sin evidencia confiable", 15),
    sectores: SECTORES[ev.tema] ?? ["Sector por determinar"],
    horizonte: "Seguimiento del corte; duración del efecto por verificar.",
    hechos,
    hipotesis: hechos.length ? [{ ...hechos[0], tipo: "hipotesis",
      texto: "Hipótesis: esta señal podría afectar al sector; su efecto y magnitud requieren evidencia adicional." }] : [],
    faltantes: base.verificaciones.slice(0, 2).map((v) => cortar(v, 14)),
    preguntas: [...PREGUNTAS], abstener: !hechos.length, modo: "extractivo",
    leyenda: LEYENDA,
  };
  if (ev.contradicciones.length) b.faltantes.unshift("Hay versiones incompatibles: contrastar ambas con una fuente primaria antes de concluir.");
  b.faltantes = b.faltantes.slice(0, 3);
  while (palabrasBoletin(b) > 250 && b.hechos.length > 1) b.hechos.pop();
  if (palabrasBoletin(b) > 250) throw new Error("El boletín supera 250 palabras");
  return b;
}
const texto = z.string().min(1).max(2000).refine((s) => !!s.trim());
const afirmacion = z.object({ texto, tipo: z.enum(["hecho_reportado", "declaracion", "hipotesis"]),
  evidence_id: texto, campo: texto, alcance: z.enum(["titular_metadatos", "fila_indicador", "evento_usgs"]) });
const esquema = z.object({
  modalidad: z.literal("banca"), eventoId: texto, huella: texto, titulo: texto,
  sectores: z.array(texto).min(1).max(4), horizonte: texto,
  hechos: z.array(afirmacion).max(8), hipotesis: z.array(afirmacion).max(4),
  faltantes: z.array(texto).min(1).max(6), preguntas: z.tuple([texto, texto, texto]),
  abstener: z.boolean(), modo: z.literal("extractivo"), leyenda: z.literal(LEYENDA),
});
// El reto pide un boletín de entorno, nunca consejo de compra, venta o inversión (revisión de Cursor, 7-oct)
const CONSEJO = /\b(compren|comprar|vendan|vender|inviert[ae]n?|invertir|conviene (comprar|vender|invertir|entrar|salir)|recomendamos|recomiendo|recomendaci[oó]n de (compra|venta|inversi[oó]n)|sobreponderar|infraponderar|tomar ganancias)\b/i;
export function validarBoletin(value: unknown, ev: Evento, noticias: Noticia[], indicadores: Indicador[], huella: string):
  { ok: true; boletin: BoletinBancario } | { ok: false; error: string } {
  const parsed = esquema.safeParse(value);
  if (!parsed.success) return { ok: false, error: "Formato bancario inválido: se requieren exactamente tres preguntas y campos completos." };
  const b = parsed.data;
  if (b.eventoId !== ev.id || b.huella !== huella) return { ok: false, error: "El boletín pertenece a otro evento o snapshot." };
  if (palabrasBoletin(b) > 250) return { ok: false, error: "El boletín completo supera 250 palabras." };
  const base = generarPaquete(ev, noticias, indicadores);
  const pubs = noticias.filter((n) => ev.ids_noticia.includes(n.id_noticia) && !n.no_confiable);
  // Original publication text only: contradiction summaries mix both sources and cannot be a citation basis.
  const context = base.brief.filter((a) => a.alcance !== "titular_metadatos");
  const fuentes = new Map([...pubs.map((n) => fuenteNoticia(n)), ...fuentesDe(context, new Map())].map((f) => [f.id, f]));
  const campos = new Map<string, Set<string>>(pubs.map((n) => [n.id_noticia, new Set(["titulo", ...(n.descripcion?.trim() ? ["descripcion"] : [])])]));
  for (const a of context) campos.set(a.evidence_id, new Set([...(campos.get(a.evidence_id) ?? []), a.campo]));
  if (b.abstener !== (b.hechos.length === 0)) return { ok: false, error: "Abstención inconsistente con los hechos disponibles." };
  for (const a of [...b.hechos, ...b.hipotesis]) {
    const f = fuentes.get(a.evidence_id);
    if (!f || !campos.get(a.evidence_id)?.has(a.campo) || a.alcance !== f.alcance || sostenida(a.texto, f.texto))
      return { ok: false, error: "Una afirmación no está respaldada por una cita permitida del evento." };
  }
  if (b.hechos.some((a) => !["hecho_reportado", "declaracion"].includes(a.tipo)) ||
    b.hipotesis.some((a) => a.tipo !== "hipotesis" || !a.texto.startsWith("Hipótesis:")))
    return { ok: false, error: "Los hechos y las hipótesis deben estar separados y marcados." };
  const libres = [b.titulo, ...b.sectores, b.horizonte, ...b.faltantes, ...b.preguntas, b.leyenda];
  if (libres.some((t) => esNoConfiable(t).no_confiable)) return { ok: false, error: "El boletín contiene instrucciones no permitidas." };
  const todo = [...fuentes.values()].map((f) => f.texto).join("\n");
  // El título y los hechos pueden citar lo que dice la fuente («quiero invertir en Panamá»); lo demás no puede aconsejar
  const consejo = (t: string) => { const m = CONSEJO.exec(t); return m ? m[0].toLowerCase() : null; };
  const ajeno = (t: string) => { const m = consejo(t); return !!m && !todo.toLowerCase().includes(m); };
  if (libres.slice(1).some(consejo) || b.hipotesis.some((a) => consejo(a.texto)) || ajeno(b.titulo) || b.hechos.some((a) => ajeno(a.texto)))
    return { ok: false, error: "El boletín no puede recomendar compra, venta ni inversión." };
  const normal = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");
  if (sostenida(b.titulo, todo) || (b.abstener ? b.titulo !== "Sin evidencia confiable"
    : !pubs.some((n) => normal(n.titulo).includes(normal(b.titulo)))))
    return { ok: false, error: "El título debe ser un fragmento de un titular confiable del evento." };
  if (b.preguntas.some((q) => sostenida(q, todo, { pregunta: true })))
    return { ok: false, error: "Una pregunta incluye datos no presentes en las fuentes." };
  return { ok: true, boletin: b };
}
