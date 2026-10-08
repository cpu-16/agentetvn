// Enrutador del chat (el «router» que pidió Jeff): antes de buscar, decide si lo escrito es una consulta sobre las noticias
// o una conversación (saludo, gracias, quién eres, ayuda, «de qué trata esto»). Lo conversacional se
// contesta con texto fijo: no busca, no llama al LLM y no gasta tokens. Reglas a propósito: predecibles y auditables.
import { explicacionFija, PLATAFORMA, queHaceRol, type ContextoPantalla } from "../voz/catalogo";
import { buscarParte, pedidoFiltro, RECORRIDO_GUIA, type Demo } from "../voz/guia";

export type Intencion = { tipo: "ajustar" } | { tipo: "consulta" } | { tipo: "agenda"; uno: boolean } | { tipo: "mesa" } | { tipo: "verificar" | "titulares"; n: number | null } | { tipo: "guia"; parte: string; recorrido?: boolean } | { tipo: "filtro"; demo: Demo } | { tipo: "conversacion"; motivo: "saludo" | "gracias" | "identidad" | "ayuda" | "pantalla" | "plataforma"; texto: string; sugerencias: string[] };

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
const PAL_ROL = new Set("editor editora periodista productor productora editores periodistas productores analista analistas bancario bancaria rol mi como soy entro entre yo un una que hace hago hacer debo tengo funcion sirve para creo es lo".split(" "));

// La mesa del rol: «¿qué me toca hoy?», «mis pendientes», «¿por dónde empiezo?».
const MESA_RE = /\b(que me toca|que (tengo|hay) (pendiente|por hacer)|mis pendientes|mi mesa|mi cola|que hago hoy|por donde (empiezo|arranco)|que debo hacer hoy|que tengo que hacer hoy)\b/;
const PAL_MESA = new Set("que me toca toca hoy a mi tengo hay pendiente pendientes por hacer mis mesa cola hago donde empiezo arranco debo tengo que hacer y ahora".split(" "));
// «¿Qué falta verificar del tema uno?» y «prepárame los titulares del tema dos»: el tema es el de la ficha abierta o el número de «Cinco para hoy».
const VERIFICAR_RE = /\b(que (falta|hay que|debo|tengo que|queda por) (verificar|comprobar|confirmar|chequear)|que falta por (verificar|comprobar|confirmar)|pendientes de verificar|que le falta)\b/;
const TITULARES_RE = /\b(titulares|titulos|titular|titulo)\b/;
const PIDE_TITULARES = /\b(prepara|preparame|propon|proponme|propones|sugiere|sugiereme|sugieres|dame|genera|generame|hazme|haz|escribe|escribeme|redacta|redactame|ideas|opciones|propuestas|alternativas)\b/;
const NUMERO: Record<string, number> = { uno: 0, "1": 0, primero: 0, primer: 0, primera: 0, dos: 1, "2": 1, segundo: 1, segunda: 1, tres: 2, "3": 2, tercero: 2, tercer: 2, tercera: 2, cuatro: 3, "4": 3, cuarto: 3, cuarta: 3, cinco: 4, "5": 4, quinto: 4, quinta: 4 };
const PAL_TEMA_N = new Set("seis siete ocho nueve diez 6 7 8 9 10 tema numero noticia ficha este esta ese esa del de la el los las para uno primero primer primera dos segundo segunda tres tercero tercer tercera cuatro cuarto cuarta cinco quinto quinta 1 2 3 4 5 verificar comprobar confirmar chequear falta hay que debo tengo queda por pendientes le titulares titulos titular titulo prepara preparame propon proponme propones sugiere sugiereme sugieres dame genera generame hazme haz escribe escribeme redacta redactame ideas opciones propuestas alternativas unos unas tres web redes".split(" "));
/** «del tema uno», «la noticia número dos», «el primer tema» → 0, 1, 0; null si no nombra un número de tema («dos titulares» no cuenta). */
const numeroTema = (t: string) => {
  const m = /\b(?:tema|noticia|ficha)(?: numero)? (\S+)/.exec(t) ?? /\b(primer|primero|primera|segundo|segunda|tercer|tercero|tercera|cuarto|cuarta|quinto|quinta) (?:tema|noticia)\b/.exec(t);
  if (!m) return null;
  return m[1] in NUMERO ? NUMERO[m[1]] : /^(\d+|seis|siete|ocho|nueve|diez|sexto|septimo|octavo|noveno|decimo)$/.test(m[1]) ? -1 : null; // -1: nombra un tema que no está entre los cinco
};

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
  // Imperativo al inicio + objeto editorial: una consulta sobre noticias no modifica nada.
  const orden = /^(?:(?:oye|jarvis|por favor|porfa) )*(?:cambia|quita|elimina|borra|agrega|anade|reemplaza|acorta|hazlo|no digas|haz (?:el|la|los|las) (?:titulo|titular|guion|copy|brief|resumen|borrador|paquete))\b/; // «haz el guion más corto» sí; «haz un resumen de…» sigue siendo consulta
  const objeto = /\b(titulo|titular|guion|copy|brief|resumen|borrador|paquete|frase)\b/;
  if (opts.contexto?.eventoId && orden.test(t) && objeto.test(t)) return { tipo: "ajustar" };
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
  if (MESA_RE.test(t) && soloCon(PAL_MESA)) return { tipo: "mesa" };
  if (VERIFICAR_RE.test(t) && soloCon(PAL_TEMA_N)) return { tipo: "verificar", n: numeroTema(t) };
  if (TITULARES_RE.test(t) && PIDE_TITULARES.test(t) && !AGENDA.test(t) && soloCon(PAL_TEMA_N)) return { tipo: "titulares", n: numeroTema(t) }; // «dame los titulares de hoy» es la agenda
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
