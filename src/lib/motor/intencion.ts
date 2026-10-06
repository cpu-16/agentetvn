// Enrutador del chat (el «router» que pidió Jeff): antes de buscar, decide si lo escrito es una consulta sobre las noticias
// o una conversación (saludo, gracias, quién eres, ayuda, «de qué trata esto», algo demasiado vago). Lo conversacional se
// contesta con texto fijo: no busca, no llama al LLM y no gasta tokens. Reglas a propósito: predecibles y auditables.
import { explicacionFija, type ContextoPantalla } from "../voz/catalogo";

export type Intencion = { tipo: "consulta" } | { tipo: "conversacion"; motivo: "saludo" | "gracias" | "identidad" | "ayuda" | "pantalla" | "vaga"; texto: string; sugerencias: string[] };

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:()"«»]/g, " ").replace(/\s+/g, " ").trim();
const SUGERENCIAS = ["¿Qué cinco temas merecen revisión hoy?", "¿Qué se sabe de la aprehensión de Enrique Lau?", "¿Cuál fue la inflación de Panamá en 2024?"];
const QUE_HAGO = "Busco en las noticias y los datos oficiales del corte de hoy y te respondo con citas, o te digo que no hay evidencia y qué falta.";

const SALUDO = /^(hola|holi|hols|ola|buenas|buenos dias|buenas tardes|buenas noches|hey|ey|que tal|que xopa|xopa|saludos|hello|hi)( (jarvis|que tal|como estas|como vas))*$/;
const GRACIAS = /^(gracias|muchas gracias|mil gracias|ok|okay|okey|vale|listo|perfecto|genial|excelente|bien|chevere|dale|entendido)( (jarvis|gracias))*$/;
const IDENTIDAD = /\b(quien eres|que eres|como te llamas|que modelo|que ia|que inteligencia artificial|quien te (hizo|creo|programo|entreno))\b/;
const AYUDA = /^(ayuda|help)$|\b(que puedes hacer|en que (me )?(puedes )?ayudar|como funcionas|como te uso|que (te )?puedo preguntar|para que sirves)\b/;
const PANTALLA = /\b(de que (se )?trata( esto| esta pantalla| esta seccion| esta pagina)?|que es esto|esto que es|que estoy viendo|que significa (esto|esta pantalla)|explicame (esto|esta pantalla|la pantalla|esta seccion|esta pagina)|que hay aqui|que muestra (esto|esta pantalla))$/;

/** `enCorpus(token)`: ¿la palabra aparece en alguna publicación? (para detectar consultas vagas o con errores de tipeo). */
export function intencion(q: string, opts: { tokens: string[]; enCorpus: (t: string) => boolean; contexto?: ContextoPantalla | null }): Intencion {
  const t = norm(q);
  const charla = (motivo: Exclude<Intencion, { tipo: "consulta" }>["motivo"], texto: string, sugerencias = SUGERENCIAS): Intencion => ({ tipo: "conversacion", motivo, texto, sugerencias });
  if (SALUDO.test(t)) return charla("saludo", `¡Hola! Soy Jarvis, el agente de la mesa. ${QUE_HAGO} ¿Sobre qué tema quieres saber?`);
  if (GRACIAS.test(t)) return charla("gracias", "Con gusto. Si quieres, pregúntame por otro tema del corte.");
  if (IDENTIDAD.test(t)) return charla("identidad", `Soy Jarvis, el agente de la mesa editorial de TVN. ${QUE_HAGO} No publico ni apruebo nada: eso lo decide una persona.`);
  if (AYUDA.test(t)) return charla("ayuda", `${QUE_HAGO} Puedes preguntarme por un tema, una persona, un lugar o un indicador de Panamá, y también qué significa la pantalla que tienes abierta.`);
  if (PANTALLA.test(t)) return charla("pantalla", explicacionFija(opts.contexto ?? { vista: "portada" }), SUGERENCIAS.slice(0, 1));
  if (!opts.tokens.length || (opts.tokens.length <= 2 && !opts.tokens.some(opts.enCorpus)))
    return charla("vaga", "No encontré de qué tema me hablas en las noticias del corte. Prueba con un nombre, un lugar o un tema, por ejemplo:");
  return { tipo: "consulta" };
}

