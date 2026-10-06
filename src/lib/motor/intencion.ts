// Enrutador del chat (el «router» que pidió Jeff): antes de buscar, decide si lo escrito es una consulta sobre las noticias
// o una conversación (saludo, gracias, quién eres, ayuda, «de qué trata esto»). Lo conversacional se
// contesta con texto fijo: no busca, no llama al LLM y no gasta tokens. Reglas a propósito: predecibles y auditables.
import { explicacionFija, type ContextoPantalla } from "../voz/catalogo";

export type Intencion = { tipo: "consulta" } | { tipo: "conversacion"; motivo: "saludo" | "gracias" | "identidad" | "ayuda" | "pantalla"; texto: string; sugerencias: string[] };

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:()"«»]/g, " ").replace(/\s+/g, " ").trim();
const SUGERENCIAS = ["¿Qué cinco temas merecen revisión hoy?", "¿Qué se sabe de la aprehensión de Enrique Lau?", "¿Cuál fue la inflación de Panamá en 2024?"];
const QUE_HAGO = "Busco en las noticias y los datos oficiales del corte de hoy y te respondo con citas, o te digo que no hay evidencia y qué falta.";

// Frases completas (ancladas): una pregunta con tema propio («¿qué modelo económico propone Mulino?», «la aprehensión de
// Enrique Lau, ¿de qué trata?») no se intercepta (revisión de Codex).
const PRE = "^(?:(?:oye|jarvis|bueno|y|a ver) )*";
const SALUDO = new RegExp(`${PRE}(hola|holi|hols|ola|buenas|buenos dias|buenas tardes|buenas noches|hey|ey|que tal|que xopa|xopa|saludos|hello|hi)( (jarvis|que tal|como estas|como vas))*$`);
const GRACIAS = new RegExp(`${PRE}(gracias|muchas gracias|mil gracias|ok|okay|okey|vale|listo|perfecto|genial|excelente|bien|chevere|dale|entendido)( (jarvis|gracias))*$`);
const IDENTIDAD = new RegExp(`${PRE}(quien eres( tu)?|que eres( tu)?|como te llamas|que modelo (eres|usas|utilizas)|que (ia|inteligencia artificial) (eres|usas|utilizas)|quien te (hizo|creo|programo|entreno))( jarvis)?$`);
const AYUDA = new RegExp(`${PRE}(ayuda|help|que puedes hacer|en que (me )?(puedes )?ayudar(me)?|como funcionas|como te uso|que (te )?puedo preguntar(te)?|para que sirves)( jarvis)?$`);
const PANTALLA = new RegExp(`${PRE}(esto |esta pantalla |esta seccion |esta pagina )?(de que (se )?trata|que es esto|esto que es|que estoy viendo|que significa esto|que significa esta (pantalla|seccion|pagina)|explicame (esto|esta pantalla|la pantalla|esta seccion|esta pagina)|que hay aqui|que muestra esta pantalla)( (esto|esta pantalla|esta seccion|esta pagina|aqui))?$`);

/** Palabras de pregunta que no dicen de qué tema se trata (ya tokenizadas: sin tildes ni mayúsculas). */
const DE_PREGUNTA = new Set("paso pasa ocurrio ocurre sabe saben dijo dicen dice hay hubo noticia noticias informacion tema temas cual cuales quien quienes donde cuando como hoy ayer ultimo ultima ultimos ultimas nuevo nueva reporta reportan explica explicame cuentame dime puedes quiero saber mas acerca".split(" "));

export function intencion(q: string, opts: { contexto?: ContextoPantalla | null } = {}): Intencion {
  const t = norm(q);
  const charla = (motivo: Exclude<Intencion, { tipo: "consulta" }>["motivo"], texto: string, sugerencias = SUGERENCIAS): Intencion => ({ tipo: "conversacion", motivo, texto, sugerencias });
  if (SALUDO.test(t)) return charla("saludo", "¡Hola! Soy Jarvis, el agente de la mesa. ¿Sobre qué tema quieres saber?");
  if (GRACIAS.test(t)) return charla("gracias", "Con gusto. Si quieres, pregúntame por otro tema del corte.");
  if (IDENTIDAD.test(t)) return charla("identidad", `Soy Jarvis, el agente de la mesa editorial de TVN. ${QUE_HAGO} No publico ni apruebo nada: eso lo decide una persona.`);
  if (AYUDA.test(t)) return charla("ayuda", `${QUE_HAGO} Puedes preguntarme por un tema, una persona, un lugar o un indicador de Panamá, y también qué significa la pantalla que tienes abierta.`);
  if (PANTALLA.test(t)) return charla("pantalla", explicacionFija(opts.contexto ?? { vista: "portada" }), SUGERENCIAS.slice(0, 1));
  return { tipo: "consulta" };
}

/** El tema de la pregunta no aparece en ninguna noticia (a menudo, un nombre mal oído por la voz: «Nickelau» por «Enrique Lau»):
 *  devuelve esas palabras para abstenerse diciéndolo, en vez de responder con lo que «suena parecido» por sentido. «» si no hay tema. */
export function temaDesconocido(tokens: string[], enCorpus: (t: string) => boolean): string | null {
  const tema = tokens.filter((x) => !DE_PREGUNTA.has(x));
  if (!tema.length) return tokens.length ? null : "";
  return tema.length <= 3 && !tema.some(enCorpus) ? tema.join(" ") : null;
}
