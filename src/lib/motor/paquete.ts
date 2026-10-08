// Paquete editorial TVN (T09) · composición extractiva: cada frase sale de una afirmación con cita. Sin LLM no hay invención posible.
import type { Afirmacion, Evento, Indicador, Noticia, Paquete } from "./contrato";
import { leerTemas } from "./config";
import { faltaPorEvidencia } from "./evidencia";
import { afirmacionesExtracto, afirmacionIndicador, afirmacionNoticia, LEYENDA } from "./consulta";
import { INDICADORES } from "../ingesta/bancomundial";

const palabras = (afs: Afirmacion[]) => afs.reduce((s, a) => s + a.texto.split(/\s+/).length, 0);
const ENFOQUE: Record<string, string> = {
  economia: "qué significa para el bolsillo y el empleo de la gente, con el dato oficial al lado",
  logistica_canal: "qué cambia para el comercio, los puertos y el Canal, y quién lo confirma",
  turismo: "qué efecto tiene en visitantes, empleo turístico y temporada",
  servicios_publicos: "a quién le afecta el servicio y qué responde la institución responsable",
  eventos_naturales: "qué ocurrió, dónde, y qué dicen las fuentes oficiales (Sinaproc, USGS)",
  regulacion: "qué cambia con la norma, a quién obliga y desde cuándo",
};
const PREGUNTAS: Record<string, string[]> = {
  economia: ["¿Qué fuente oficial confirma la cifra y con qué período de referencia?", "¿Cómo se compara con los años anteriores de la serie oficial?", "¿Quién gana y quién pierde con este cambio?"],
  logistica_canal: ["¿Qué dice la ACP o la autoridad competente en su comunicado oficial?", "¿Qué volumen o monto está en juego y desde cuándo rige?", "¿Qué sectores dependen de esta decisión?"],
  turismo: ["¿Qué cifra oficial de la ATP respalda el anuncio?", "¿Es un evento puntual o una tendencia?", "¿Qué impacto tiene en empleo y ocupación hotelera?"],
  servicios_publicos: ["¿Cuántas personas están afectadas y por cuánto tiempo?", "¿Qué responde la institución responsable y qué plazo da?", "¿Hay antecedentes del mismo problema?"],
  eventos_naturales: ["¿Qué confirma la fuente oficial (Sinaproc, USGS, IMHPA) sobre magnitud y daños?", "¿Hay personas afectadas o es solo un registro instrumental?", "¿Qué zonas siguen en riesgo?"],
  regulacion: ["¿Cuál es el texto exacto de la norma y en qué etapa está?", "¿Quiénes quedan obligados y desde cuándo?", "¿Qué gremios o instituciones ya se pronunciaron?"],
};
const generica = ["¿Qué fuente primaria confirma el hecho?", "¿Desde cuándo y a quién afecta?", "¿Qué falta verificar antes de publicar?"];

export function generarPaquete(ev: Evento, noticias: Noticia[], indicadores: Indicador[]): Paquete {
  const porId = new Map(noticias.map((n) => [n.id_noticia, n]));
  const pubs = ev.ids_noticia.map((i) => porId.get(i)!).filter((n) => n && !n.no_confiable);
  const tema = leerTemas().find((t) => t.id === ev.tema);
  if (!pubs.length) {
    // sin publicaciones confiables no hay paquete: abstención explícita
    const leyenda = "Sin publicaciones confiables en este evento: no se genera paquete. Revisar la fuente marcada como no confiable.";
    return { titulo: "", enfoque: "", brief: [], preguntas: [], verificaciones: [leyenda], guion: [], copy: [], leyenda, modo: "extractivo" };
  }
  const rep = pubs.find((p) => p.id_noticia === ev.representante) ?? pubs[0]; // representante siempre permitido
  const permitidos = new Set(pubs.map((p) => p.id_noticia));
  const contradicciones = ev.contradicciones.filter((c) => permitidos.has(c.a) && permitidos.has(c.b));
  const procedencias = ev.procedencias.map((p) => ({ ...p, ids_noticia: p.ids_noticia.filter((i) => permitidos.has(i)) })).filter((p) => p.ids_noticia.length);
  const hechos: Afirmacion[] = [...pubs.slice(0, 3).map(afirmacionNoticia), ...pubs.slice(0, 2).flatMap((p) => afirmacionesExtracto(p))];
  const contexto: Afirmacion[] = ev.contexto.indicadores
    .map((id) => {
      const [pais, ind, anio] = id.split(":");
      return indicadores.find((i) => i.pais_iso3 === pais && i.indicador_id === ind && i.anio === Number(anio));
    })
    .filter((i): i is Indicador => !!i)
    .flatMap((i) => [afirmacionIndicador(i), { texto: `Esa cifra es anual (${i.anio}) y sirve de contexto; no describe la situación de hoy.`, tipo: "inferencia" as const, evidence_id: `${i.pais_iso3}:${i.indicador_id}:${i.anio}`, campo: "anio", alcance: "fila_indicador" as const }]);
  const procedencia: Afirmacion = {
    texto: `Procedencias identificadas: ${procedencias.map((p) => `${p.nombre} (${p.ids_noticia.length})`).join(", ")}; ${pubs.length} publicación(es) confiables.`,
    tipo: "inferencia",
    evidence_id: rep.id_noticia,
    campo: "medio",
    alcance: "titular_metadatos",
  };
  const hipotesis: Afirmacion[] = contradicciones.flatMap((c) => [
    { texto: `Las versiones no coinciden: ${c.detalle}. Verificación pendiente.`, tipo: "hipotesis" as const, evidence_id: c.a, campo: c.campo.split("/")[0], alcance: "titular_metadatos" as const },
    { texto: `Segunda versión citada: ${porId.get(c.b)?.medio ?? c.b}.`, tipo: "hipotesis" as const, evidence_id: c.b, campo: c.campo.split("/").pop()!, alcance: "titular_metadatos" as const },
  ]);
  let brief = [...hechos, ...contexto, procedencia, ...hipotesis];
  while (palabras(brief) > 250 && brief.length > 1) brief = brief.slice(0, -1);
  if (palabras(brief) > 250) brief = [{ ...brief[0], texto: brief[0].texto.split(/\s+/).slice(0, 245).join(" ") + "…" }];
  const verificaciones = [
    ...faltaPorEvidencia(ev),
    ...procedencias.filter((p) => p.tipo === "no_verificada").map((p) => `${p.ids_noticia.length} publicación(es) con titular copiado sin agencia: confirmar independencia.`),
    ...contradicciones.map((c) => `Contradicción: ${c.detalle}.`),
    ...(ev.ids_noticia.length > pubs.length ? [`${ev.ids_noticia.length - pubs.length} publicación(es) excluida(s) por contenido no confiable.`] : []),
    "Leer la nota completa: todo lo anterior se basa únicamente en titular/metadatos.",
  ];
  // guion de 45–60 s ≈ 110–150 palabras leídas: se llena con hechos citados hasta el tope, nunca con relleno
  let guion: Afirmacion[] = [];
  for (const a of [...hechos, ...contexto.slice(0, 1), ...(hipotesis[0] ? [hipotesis[0]] : []), procedencia]) {
    if (palabras([...guion, a]) > 150) break;
    guion.push(a);
  }
  if (!guion.length) guion = hechos.slice(0, 1);
  if (palabras(guion) < 110) verificaciones.push(`Guion incompleto (${palabras(guion)} palabras citadas; 45 s requieren ~110): faltan hechos con cita, no se rellena.`);
  const tituloCopy = rep.titulo.split(/\s+/).length > 60 ? rep.titulo.split(/\s+/).slice(0, 60).join(" ") + "…" : rep.titulo;
  const copy: Afirmacion[] = [{ texto: `${tituloCopy}. ${contexto.length ? "Con el dato oficial, en la nota." : "Qué se sabe y qué falta confirmar, en la nota."}`, tipo: "hecho_reportado", evidence_id: rep.id_noticia, campo: "titulo", alcance: "titular_metadatos" }];
  return {
    titulo: rep.titulo,
    enfoque: `Interés público (${tema?.nombre ?? ev.tema}): ${ENFOQUE[ev.tema] ?? "qué se sabe, quién lo dice y qué falta confirmar"}.`,
    brief,
    preguntas: PREGUNTAS[ev.tema] ?? generica,
    verificaciones,
    guion,
    copy,
    leyenda: LEYENDA,
    modo: "extractivo",
  };
}

export { INDICADORES };
