// Enrutador del chat (el «router» que pidió Jeff): antes de buscar, decide si lo escrito es una consulta sobre las noticias
// o una conversación (saludo, gracias, quién eres, ayuda, «de qué trata esto»). Lo conversacional se
// contesta con texto fijo: no busca, no llama al LLM y no gasta tokens. Reglas a propósito: predecibles y auditables.
import { explicacionFija, PLATAFORMA, queHaceRol, type ContextoPantalla } from "../voz/catalogo";
import { buscarParte, pedidoFiltro, RECORRIDO_GUIA, type Demo } from "../voz/guia";

export type Intencion = { tipo: "consulta" } | { tipo: "agenda"; uno: boolean } | { tipo: "guia"; parte: string; recorrido?: boolean } | { tipo: "filtro"; demo: Demo } | { tipo: "conversacion"; motivo: "saludo" | "gracias" | "identidad" | "ayuda" | "pantalla" | "plataforma"; texto: string; sugerencias: string[] };

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

// «Estoy aquí, ¿qué se hace?» (sin tema): es la pantalla que tiene abierta.
const QUE_HAGO_AQUI = new RegExp(`${PRE}(ya )?(estoy (aqui|aca) )?(y )?(que se hace|que hago|que tengo que hacer|que debo hacer)( (aqui|aca))?$`);
// «¿Qué hace un periodista?», «yo entro como productor, ¿qué hago?»: el rol que se elige al entrar.
const PAL_ROL = new Set("editor editora periodista productor productora editores periodistas productores rol mi como soy entro entre yo un una que hace hago hacer debo tengo funcion sirve para creo es lo".split(" "));

/** Palabras de pregunta que no dicen de qué tema se trata (ya tokenizadas: sin tildes ni mayúsculas). */
const DE_PREGUNTA = new Set("son es fue fueron paso pasa ocurrio ocurre sabe saben dijo dicen dice hay hubo noticia noticias informacion tema temas cual cuales quien quienes donde cuando como hoy ayer ultimo ultima ultimos ultimas nuevo nueva reporta reportan explica explicame cuentame dime puedes quiero saber mas acerca".split(" "));

// La plataforma: «¿de qué trata AgenteTVN?», «¿para qué sirve esta plataforma?», «¿cómo funciona esto?».
const PLATAFORMA_RE = /\b(agente ?tvn|agentetvn|esta plataforma|la plataforma|esta app|la app|esta aplicacion|la aplicacion|esta herramienta|este sistema|la mesa editorial|esta mesa)\b/;
const QUE_ES = /\b(de que (se )?trata|que es|para que sirve|como funciona|que hace|explica|explicame|cuentame|de que va|en que consiste)\b/;
// La agenda del día: «¿cuál es la noticia del día?», «¿qué temas hay hoy?», «¿qué es lo más importante?», «los cinco temas».
const AGENDA = /\b(noticias? (del dia|de hoy|principal(es)?|mas importantes?|destacadas?)|(temas|titulares|titulos) (del dia|de hoy|principales|mas importantes|destacados)|(lo mas importante|lo principal|lo destacado)( de| del)? ?(hoy|dia)?|cinco temas|5 temas|que (temas|noticias) (hay|tenemos|merecen)|que merece(n)? (revision|atencion)|agenda (del dia|de hoy)|(de que|que) se (habla|esta hablando) hoy|que (paso|pasa) hoy|que hay (hoy|de nuevo))\b/;
// «¿Por qué…?» va a la regla de causalidad del motor y «la de ayer» no es la agenda de hoy (revisión de Codex).
const CAUSA_U_OTRO_DIA = /\b(por que|porque|causa|culpa|ayer|anoche|antier|antes de ayer|semana|mes|ano|pasad[oa]s?|anterior|manana)\b|\b(19|20)\d{2}\b|\b\d{1,2} de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b|\b\d{1,2}\/\d{1,2}\b/; // años y fechas, no cantidades («5 temas»)
const UNA = /\b(la noticia|el tema|lo mas importante|lo principal)\b/;
// «Explícame esto» dicho a su manera: habla de lo que tiene delante y no trae un tema propio.
const DELANTE = /\b(esto|aqui|aca|esta pantalla|esta seccion|esta pagina|lo que veo|lo que estoy viendo)\b/;
const RECORRIDO = /\b(recorrido|tour|paseo|guiame|guia me|ensename la plataforma|muestrame la plataforma|muestrame todo|ensename todo|como se usa)\b/;
const PAL_RECORRIDO = new Set("recorrido tour paseo guiame guia ensename muestrame todo plataforma hazme hacer haz hagamos dame un una por toda completo app aplicacion se usa usa".split(" "));
const EXPLICAR = /\b(explica|explicame|explicar|muestra|muestrame|ensename|que es|que son|que significa|que muestra|como (leo|se lee|funciona)|para que sirve|donde (esta|veo)|llevame|abre|ver)\b/;
const PAL_PARTE = new Set("tema numero uno primero primera principal del de portada agenda tablero control ficha pagina grafica grafico graficas parte seccion pantalla tabla barra boton cuadro panel la el los las esa ese esta este".split(" "));
const PAL_PLATAFORMA = new Set("agentetvn agente tvn plataforma app aplicacion herramienta sistema mesa editorial funciona sirve hace consiste va".split(" "));
const PAL_AGENDA = new Set("noticia noticias dia hoy tema temas titulares titulos importante importantes principal principales destacado destacada destacados destacadas cinco merecen merece revision atencion agenda habla hablando lo mas nuevo tenemos top".split(" "));
const RELLENO = new Set("dame muestrame ensename listame me te nos mi tu yo le les usted porfa porfavor necesito quiero puedes podrias explicar expliques explicame explica trata tratan esto aqui aca pantalla seccion pagina vale bueno pero entonces significa muestra veo viendo estoy hecho dime cuentame sobre favor oye jarvis ok bien mira".split(" "));

export function intencion(q: string, opts: { contexto?: ContextoPantalla | null; tokens?: string[] } = {}): Intencion {
  const t = norm(q);
  const toks = opts.tokens ?? t.split(" ");
  const soloCon = (extra: Set<string>) => toks.every((x) => RELLENO.has(x) || DE_PREGUNTA.has(x) || extra.has(x)); // ¿trae un tema propio?
  const sinTema = soloCon(new Set());
  const charla = (motivo: Extract<Intencion, { tipo: "conversacion" }>["motivo"], texto: string, sugerencias = SUGERENCIAS): Intencion => ({ tipo: "conversacion", motivo, texto, sugerencias });
  // Guía: «__guia:<parte>» es el botón «Siguiente» del recorrido en el chat
  const boton = /^__guia:([a-z-]+)$/.exec(q.trim());
  if (boton && RECORRIDO_GUIA.includes(boton[1])) return { tipo: "guia", parte: boton[1], recorrido: true };
  if (RECORRIDO.test(t) && soloCon(PAL_RECORRIDO)) return { tipo: "guia", parte: RECORRIDO_GUIA[0], recorrido: true };
  const filtro = pedidoFiltro(q);
  if (filtro) return { tipo: "filtro", demo: filtro };
  const p = buscarParte(q, opts.contexto?.vista);
  if (p && EXPLICAR.test(t) && soloCon(new Set([...PAL_PARTE, ...p.claves.flatMap((c) => c.split(" "))]))) return { tipo: "guia", parte: p.id };
  if (/^(explicame|explica|ayudame|ayuda me)$/.test(t)) return charla("pantalla", explicacionFija(opts.contexto ?? { vista: "portada" }), ["Hazme un recorrido por la plataforma", "¿Cuál es la noticia del día?"]);
  if (SALUDO.test(t)) return charla("saludo", "¡Hola! Soy Jarvis, el agente de la mesa. ¿Sobre qué tema quieres saber?");
  if (GRACIAS.test(t)) return charla("gracias", "Con gusto. Si quieres, pregúntame por otro tema del corte.");
  if (IDENTIDAD.test(t)) return charla("identidad", `Soy Jarvis, el agente de la mesa editorial de TVN. ${QUE_HAGO} No publico ni apruebo nada: eso lo decide una persona.`);
  if (AYUDA.test(t)) return charla("ayuda", `${QUE_HAGO} Puedes preguntarme por un tema, una persona, un lugar o un indicador de Panamá, y también qué significa la pantalla que tienes abierta.`);
  const rol = queHaceRol(t);
  if (rol && soloCon(PAL_ROL)) return charla("ayuda", rol, ["Hazme un recorrido por la plataforma", "¿Cuál es la noticia del día?"]);
  if (QUE_HAGO_AQUI.test(t)) return charla("pantalla", explicacionFija(opts.contexto ?? { vista: "portada" }), ["Hazme un recorrido por la plataforma"]);
  if (PANTALLA.test(t) || (DELANTE.test(t) && QUE_ES.test(t) && sinTema)) return charla("pantalla", explicacionFija(opts.contexto ?? { vista: "portada" }), SUGERENCIAS.slice(0, 1));
  if (PLATAFORMA_RE.test(t) && (QUE_ES.test(t) || toks.length <= 3) && soloCon(PAL_PLATAFORMA)) return charla("plataforma", PLATAFORMA, ["¿Qué cinco temas merecen revisión hoy?", "¿Cuál es la noticia del día?"]);
  if (AGENDA.test(t) && soloCon(PAL_AGENDA) && !CAUSA_U_OTRO_DIA.test(t)) return { tipo: "agenda", uno: UNA.test(t) && !/cinco|5 |temas|noticias/.test(t) };
  return { tipo: "consulta" };
}

/** El tema de la pregunta no aparece en ninguna noticia (a menudo, un nombre mal oído por la voz: «Nickelau» por «Enrique Lau»):
 *  devuelve esas palabras para abstenerse diciéndolo, en vez de responder con lo que «suena parecido» por sentido. «» si no hay tema. */
export function temaDesconocido(tokens: string[], enCorpus: (t: string) => boolean): string | null {
  const tema = tokens.filter((x) => !DE_PREGUNTA.has(x));
  if (!tema.length) return tokens.length ? null : "";
  return tema.length <= 3 && !tema.some(enCorpus) ? tema.join(" ") : null;
}
