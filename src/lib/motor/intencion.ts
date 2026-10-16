// Enrutador del chat (el «router» que pidió Jeff): antes de buscar, decide si lo escrito es una consulta sobre las noticias
// o una conversación (saludo, gracias, quién eres, ayuda, «de qué trata esto»). Lo conversacional se
// contesta con texto fijo: no busca, no llama al LLM y no gasta tokens. Reglas a propósito: predecibles y auditables.
import { explicacionFija, PLATAFORMA, queHaceRol, type ContextoPantalla } from "../voz/catalogo";
import { buscarParte, pedidoFiltro, RECORRIDO_GUIA, type Demo } from "../voz/guia";

export type Intencion = { tipo: "ajustar" } | { tipo: "consulta" } | { tipo: "agenda"; uno: boolean } | { tipo: "mesa" } | { tipo: "verificar" | "titulares"; n: number | null; tema?: string; borrador?: boolean } | { tipo: "guia"; parte: string; recorrido?: boolean } | { tipo: "filtro"; demo: Demo } | { tipo: "conversacion"; motivo: "saludo" | "gracias" | "identidad" | "ayuda" | "pantalla" | "plataforma"; texto: string; sugerencias: string[] };

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:()"«»“”…]/g, " ").replace(/\s+/g, " ").trim();
const SUGERENCIAS = ["¿Qué cinco temas merecen revisión hoy?", "¿Qué se sabe de la aprehensión de Enrique Lau?", "¿Cuál fue la inflación de Panamá en 2024?"];
const QUE_HAGO = "Busco en las noticias y los datos oficiales del corte de hoy y te respondo con citas, o te digo que no hay evidencia y qué falta.";

// Frases completas (ancladas): una pregunta con tema propio («¿qué modelo económico propone Mulino?», «la aprehensión de
// Enrique Lau, ¿de qué trata?») no se intercepta.
const PRE = "^(?:(?:oye|jarvis|bueno|y|a ver) )*";
// muletillas antes de una orden («a ver, cambia el titular», «mira, publícalo»)
const MULETILLA = "(?:(?:oye|jarvis|por favor|porfa|a ver|mira|bueno|este|no|dale|ok|ey|y|pues) )*";
// una pregunta («¿qué publica TVN en redes?», «¿qué significa “bájale el tono”?») o un pedido de información («lo que pasó en Colón»,
// «quiero saber…») nunca es una orden de editar, publicar ni un pedido de borrador (revisión de Codex y Cursor, 15-oct)
const PREGUNTA = new RegExp(`^${MULETILLA}(que(?! (salga|se publique|lo publiques|lo saques|lo subas))|quien|quienes|cual|cuales|como|donde|cuando|cuanto|cuantos|cuantas|por que|significa|es cierto)\\b`); // «dale, que salga al aire» es orden
const INFO = /\b(saber|lo que (paso|dijo|dicen|hizo|hicieron|se sabe)|que (paso|dijo|dicen|hizo))\b/;
/** Sin lo citado: «"Cambia el titular" fue la instrucción» no es una orden; «reemplaza en el copy «presuntamente» por…» sí. */
const sinCitas = (q: string) => q.replace(/["“«][^"”»]*["”»]/g, " ");
const SALUDO = new RegExp(`${PRE}(hola|holi|hols|ola|buenas|buenos dias|buenas tardes|buenas noches|hey|ey|que tal|que xopa|xopa|saludos|hello|hi)( (jarvis|que tal|como estas|como vas))*$`);
const GRACIAS = new RegExp(`${PRE}(gracias|muchas gracias|mil gracias|ok|okay|okey|vale|listo|perfecto|genial|excelente|bien|chevere|dale|entendido)( (jarvis|gracias))*$`);
const IDENTIDAD = new RegExp(`${PRE}(quien eres( tu)?|que eres( tu)?|como te llamas|que modelo (eres|usas|utilizas)|que (ia|inteligencia artificial) (eres|usas|utilizas)|quien te (hizo|creo|programo|entreno))( jarvis)?$`);
const AYUDA = new RegExp(`${PRE}(ayuda|help|que puedes hacer|en que (me )?(puedes )?ayudar(me)?|como funcionas|como te uso|que (te )?puedo preguntar(te)?|para que sirves)( jarvis)?$`);
const PANTALLA = new RegExp(`${PRE}(esto |esta pantalla |esta seccion |esta pagina )?(de que (se )?trata|que es esto|esto que es|que estoy viendo|que significa esto|que significa esta (pantalla|seccion|pagina)|explicame (esto|esta pantalla|la pantalla|esta seccion|esta pagina)|que hay aqui|que muestra esta pantalla)( (esto|esta pantalla|esta seccion|esta pagina|aqui))?$`);

// «Estoy aquí, ¿qué se hace?» (sin tema): es la pantalla que tiene abierta.
const QUE_HAGO_AQUI = new RegExp(`${PRE}(ya )?(estoy (aqui|aca) )?(y )?(que se hace|que hago|que tengo que hacer|que debo hacer)( (aqui|aca))?$`);
// «¿Qué hace un periodista?», «yo entro como productor, ¿qué hago?»: el rol que se elige al entrar.
const PAL_ROL = new Set("editor editora periodista productor productora editores periodistas productores analista analistas bancario bancaria rol mi como soy entro entre yo un una que hace hago hacer debo tengo funcion sirve para creo es lo".split(" "));

// «Publícalo», «¿lo puedes aprobar?»: no busca noticias (el 15-oct leía titulares al azar); «¿qué publicó TVN?» sigue siendo consulta.
const PUBLICA_YA = new RegExp(`^${MULETILLA}(publical[oa]|publica (la|el|esa|ese|esta|este) (nota|borrador|paquete|pieza|guion)|apruebal[oa]|apruebame|aprueba (la|el|esa|ese|esta|este) (nota|borrador|paquete|pieza)|mandal[oa]|subel[oa]|envial[oa]|dejalo publicado|no (lo |la )?publiques)\\b`);
// «sube esa nota a la web», «que salga al aire»: la orden al inicio («Mulino dijo que lo van a publicar al aire» es noticia)
const AL_AIRE = new RegExp(`^${MULETILLA}(que salga|sube|subelo|subela|subir|manda|mandalo|mandala|ponlo|ponla|dejalo|dejala|sacalo|sacala|publica|publicalo|publicala|envialo|enviala)\\b.*\\b(al aire|a redes|a la web|en redes|en la web)\\b`);
const PUBLICAR = /\b(publica\w*|publiques|publiquemos|aprueba\w*|aprobar\w*|aprobemos|mandal[oa]|envial[oa]|subel[oa]|compartel[oa]|posteal[oa])\b/;
const PAL_PUBLICAR = new Set("publica publicalo publicala publicar publicarlo publicarla publicas publiquemos aprueba apruebalo apruebala aprobar aprobarlo aprobarla apruebas aprobemos lo la ya ahora el este esta borrador paquete guion tema de una vez puede se en redes web numero uno dos tres cuatro cinco mandalo mandala envialo enviala subelo subela compartelo compartela postealo posteala puedo podemos al aire no publiques".split(" "));
// La mesa del rol: «¿qué me toca hoy?», «mis pendientes», «¿por dónde empiezo?».
const MESA_RE = /\b(que (tengo|debo|me toca) (que )?decidir|que me queda( a mi)?( por)? (resolver|hacer|decidir)|(temas|cosas) que me (asignaron|tocan|toca)|que me toca|que (tengo|hay) (pendiente|por hacer)|mis pendientes|mi mesa|mi cola|que hago hoy|por donde (empiezo|arranco)|que debo hacer hoy|que tengo que hacer hoy)\b/;
const PAL_MESA = new Set("editor editora periodista productor productora analista rol mio mia mios mias ya entre entro queda resolver temas cosas asignaron tocan cuales son decidir que me toca toca hoy a mi tengo hay pendiente pendientes por hacer mis mesa cola hago donde empiezo arranco debo tengo que hacer y ahora".split(" "));
// «¿Qué falta verificar del tema uno?» y «prepárame los titulares del tema dos»: el tema es el de la ficha abierta o el número de «Cinco para hoy».
const VERIFICAR_RE = /\b(que (falta|hay que|debo|tengo que|queda por) (verificar|comprobar|confirmar|chequear)|que falta por (verificar|comprobar|confirmar)|pendientes de verificar|que le falta|que no (esta|estan) (verificad|confirmad)[oa]s?|sin (verificar|confirmar)|(nos|me|le) queda por (verificar|comprobar|confirmar|chequear)|pendientes? (de|por) (verificar|comprobar|confirmar|chequear)|no (esta|estan) corroborad[oa]s?)\b/;
const TITULARES_RE = /\b(titulares|titulos|titular|titulo)\b/;
const PIDE_TITULARES = /\b(prepara|preparame|propon|proponme|propones|sugiere|sugiereme|sugieres|dame|genera|generame|hazme|haz|escribe|escribeme|redacta|redactame|ideas|opciones|propuestas|alternativas)\b/;
const NUMERO: Record<string, number> = { uno: 0, "1": 0, primero: 0, primer: 0, primera: 0, dos: 1, "2": 1, segundo: 1, segunda: 1, tres: 2, "3": 2, tercero: 2, tercer: 2, tercera: 2, cuatro: 3, "4": 3, cuarto: 3, cuarta: 3, cinco: 4, "5": 4, quinto: 4, quinta: 4 };
const PAL_TEMA_N = new Set("seis siete ocho nueve diez 6 7 8 9 10 tema numero noticia ficha este esta ese esa del de la el los las para uno primero primer primera dos segundo segunda tres tercero tercer tercera cuatro cuarto cuarta cinco quinto quinta 1 2 3 4 5 verificar comprobar confirmar chequear falta hay que debo tengo queda por pendientes le titulares titulos titular titulo prepara preparame propon proponme propones sugiere sugiereme sugieres dame genera generame hazme haz escribe escribeme redacta redactame ideas opciones propuestas alternativas unos unas tres web redes".split(" "));
// «Quiero un borrador del tema uno», «prepárame la nota de Enrique Lau», «arma el paquete de lo de Vietnam» (15-oct: iban a la búsqueda).
const BORRADOR_RE = /\b(borrador(es)?|paquete|pieza|guion|copy)\b/;
const NOTA_CREAR = /\b(prepara|preparame|preparar|preparas|arma|armame|armar|hazme|redacta|redactame|redactar|redactas|escribe|escribeme|escribir|genera|generame|generar)\b.*\bnota\b/; // «dame la nota» puede ser la noticia; «redáctame la nota» es el borrador
const PIDE_BORRADOR = /\b(preparar|armar|redactar|escribir|generar|hacer|preparas|armas|redactas|haces|generas|escribes|quiero|necesito|prepara|preparame|arma|armame|hazme|haz|redacta|redactame|escribe|escribeme|dame|genera|generame|trae|traeme|abre|abreme)\b/;
// palabras del pedido (no del tema): lo que queda después de quitarlas es el nombre del tema («enrique lau», «vietnam»)
const PAL_TRABAJO = new Set([...PAL_TEMA_N, ..."borrador borradores paquete nota pieza quiero necesito arma armame trae traeme abre abreme lo caso asunto verificado verificada verificados verificadas confirmado confirmada confirmados confirmadas corroborado corroborada todavia aun nos tenemos pendiente queda no esta estan sin cuales son guion copy resumen preparar armar redactar escribir generar hacer preparas armas redactas haces generas escribes puedes podrias me".split(" ")]);
/** «del tema uno», «la noticia número dos», «el primer tema» → 0, 1, 0; null si no nombra un número de tema («dos titulares» no cuenta). */
const numeroTema = (t: string) => {
  const a = /\b(?:tema|noticia|ficha)(?: numero)? (\S+)/.exec(t), b = /\b(primer|primero|primera|segundo|segunda|tercer|tercero|tercera|cuarto|cuarta|quinto|quinta) (?:tema|noticia)\b/.exec(t);
  const m = a && (a[1] in NUMERO || /^\d+$/.test(a[1])) ? a : b ?? a; // «del quinto tema siguen…»: «tema siguen» no es un número
  if (!m) return null;
  return m[1] in NUMERO ? NUMERO[m[1]] : /^(\d+|seis|siete|ocho|nueve|diez|sexto|septimo|octavo|noveno|decimo)$/.test(m[1]) ? -1 : null; // -1: nombra un tema que no está entre los cinco
};

/** Palabras de pregunta que no dicen de qué tema se trata (ya tokenizadas: sin tildes ni mayúsculas). */
const DE_PREGUNTA = new Set("son es fue fueron paso pasa ocurrio ocurre sabe saben dijo dicen dice hay hubo noticia noticias informacion tema temas cual cuales quien quienes donde cuando como hoy ayer ultimo ultima ultimos ultimas nuevo nueva reporta reportan explica explicame cuentame dime puedes quiero saber mas acerca".split(" "));

// La plataforma: «¿de qué trata AgenteTVN?», «¿para qué sirve esta plataforma?», «¿cómo funciona esto?».
const PLATAFORMA_RE = /\b(agente ?tvn|agentetvn|esta plataforma|la plataforma|esta app|la app|esta aplicacion|la aplicacion|esta herramienta|este sistema|la mesa editorial|esta mesa)\b/;
const QUE_ES = /\b(de que (se )?trata|que es|que dice|para que sirve|como funciona|que hace|explica|explicame|cuentame|de que va|en que consiste)\b/;
// La agenda del día: «¿cuál es la noticia del día?», «¿qué temas hay hoy?», «¿qué es lo más importante?», «los cinco temas».
const AGENDA = /\b(noticias? (del dia|de hoy|principal(es)?|mas importantes?|destacadas?)|(temas|titulares|titulos) (del dia|de hoy|principales|mas importantes|destacados)|(lo mas importante|lo principal|lo destacado)( de| del)? ?(hoy|dia)?|cinco temas|5 temas|que (temas|noticias) (hay|tenemos|merecen)|que merece(n)? (revision|atencion)|agenda (del dia|de hoy)|(de que|que) se (habla|esta hablando) hoy|que (paso|pasa) hoy|que hay (hoy|de nuevo))\b/;
// «Dame los temas para la agenda», «¿qué hay para hoy?», «¿qué deberíamos cubrir?» (15-oct: iban a la búsqueda o a explicar la Agenda).
const AGENDA_MAS = /\b(temas (para|de) (la )?agenda|(que hay|que tenemos) para hoy|que (deberiamos|debemos|hay que|vamos a|podemos|conviene) cubrir|arma(me)? la agenda|(dame|dime|cuales son) los temas|que (cubrimos|cubro|sacamos|llevamos) hoy|que (noticias|temas) (arrancamos|empezamos|abrimos)|(moviendo|mueve) la agenda|ponme al dia|lo (mas importante|principal) (de|del) (hoy|dia))\b/;
const PAL_AGENDA_MAS = new Set("arrancamos empezamos abrimos moviendo mueve agenda ponme al dia deberiamos debemos hay vamos podemos conviene cubrir cubrimos cubro sacamos llevamos arma armame dame dime cuales son".split(" "));
// «¿Por qué…?» va a la regla de causalidad del motor y «la de ayer» no es la agenda de hoy.
const CAUSA_U_OTRO_DIA = /\b(por que|porque|causa|culpa|ayer|anoche|antier|antes de ayer|semana|mes|ano|pasad[oa]s?|anterior|manana)\b|\b(19|20)\d{2}\b|\b\d{1,2} de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b|\b\d{1,2}\/\d{1,2}\b/; // años y fechas, no cantidades («5 temas»)
// «¿Qué cinco temas merecen revisión… y por qué?» (CU-01 del reto): el «por qué» final pide justificar el orden, y la agenda ya da la razón de cada puntaje.
const Y_POR_QUE = / y por que$/;
const ELEGIR = /\b(merecen?|cinco temas|5 temas|prioriza\w*|prioridad(es)?)\b/; // solo al pedir elegir temas: «¿qué pasó hoy y por qué?» sigue en la regla de causalidad
const EXPLIC = /\bexplic\w*/g;
const SECCION = /\b(portada|agenda|tablero|control)\b/;
const PRIMERA_PARTE: Record<string, string> = { portada: "portada-cifras", agenda: "agenda-lista", tablero: "tablero-resumen", control: "control-datos" };
const PAL_SECCION = new Set("portada agenda tablero control explicame muestrame ensename abre abreme ve vete ir llevame que es hay dice seccion parte pantalla la el los las del de en esa ese esta este".split(" "));
const MAS = new RegExp(`${PRE}(explicame|dime|cuentame|dame)( un poco)? mas( detalles?| sobre (esto|eso)| de (esto|eso))?$|^mas detalles?$`);
const UNA = /\b(la noticia|el tema|lo mas importante|lo principal)\b/;
// «Explícame esto» dicho a su manera: habla de lo que tiene delante y no trae un tema propio.
const DELANTE = /\b(esto|aqui|aca|esta pantalla|esta seccion|esta pagina|esta parte|lo que veo|lo que estoy viendo)\b/;
const RECORRIDO = /\b(recorrido|tour|paseo|guiame|guia me|ensename la plataforma|muestrame la plataforma|muestrame todo|ensename todo|como se usa)\b/;
const PAL_RECORRIDO = new Set("recorrido tour paseo guiame guia ensename muestrame todo plataforma hazme hacer haz hagamos dame un una por toda completo app aplicacion se usa usa".split(" "));
const EXPLICAR = /\b(explica|explicame|explicar|muestra|muestrame|ensename|que es|que son|que significa|que muestra|como (leo|se lee|funciona)|para que sirve|donde (esta|veo)|llevame|abre|ver)\b/;
const PAL_PARTE = new Set("tema numero uno primero primera principal del de portada agenda tablero control ficha pagina grafica grafico graficas parte seccion pantalla tabla barra boton cuadro panel la el los las esa ese esta este".split(" "));
const PAL_PLATAFORMA = new Set("agentetvn agente tvn plataforma app aplicacion herramienta sistema mesa editorial funciona sirve hace consiste va".split(" "));
const PAL_AGENDA = new Set("panama noticia noticias dia hoy tema temas titulares titulos importante importantes principal principales destacado destacada destacados destacadas cinco merecen merece revision atencion agenda habla hablando lo mas nuevo tenemos top".split(" "));
const RELLENO = new Set("ver ey hey pues dale okey listo ponme dime ahi entonces dame muestrame ensename listame me te nos mi tu yo le les usted porfa porfavor necesito quiero puedes podrias explicar expliques explicame explica trata tratan esto aqui aca pantalla seccion pagina parte vale bueno pero entonces significa muestra veo viendo estoy hecho dime cuentame sobre favor oye jarvis ok bien mira toque toco marque seleccione elegi escogi".split(" "));

// Imperativo al inicio + objeto editorial: una consulta sobre noticias no modifica nada.
const CLITICOS = "agregale|anadele|quitale|cambiale|ponle|bajale|subele|acortale|acortalo|acortala|dejalo|dejala|reescribelo|reescribela|simplificalo|simplificala";
const CLITICO = new RegExp(`\\b(${CLITICOS})\\b`);
// «mira, al guion agrégale…», «ese titular suena muy fuerte, bájale el tono»: la parte al inicio y el verbo poco después
const ORDEN_OBJ = new RegExp(`^${MULETILLA}(?:al|a la|el|la|los|las|ese|esa|este|esta) (?:titulo|titular|titulares|guion|copy|brief|resumen|borrador|paquete)(?: \\S+){0,3} (?:${CLITICOS})\\b`);
const ORDEN = new RegExp(`^${MULETILLA}(?:cambia|cambiale|quita|quitale|elimina|borra|agrega|agregale|anade|ponle|reemplaza|acorta|acortale|hazlo|no digas|haz (?:el|la|los|las) (?:titulo|titular|guion|copy|brief|resumen|borrador|paquete))\\b`); // «haz el guion más corto» sí; «haz un resumen de…» sigue siendo consulta
const OBJETO = /\b(titulo|titular|guion|copy|brief|resumen|borrador|paquete|frase)\b/;
/** «haz el guion más corto», «quita la mención a Crítica del copy»: una orden de cambio al borrador (sirve con la ficha abierta). */
// «Hazlo más corto» sin decir qué parte: se pregunta en vez de dejar que la IA cambie todo el paquete.
const SIN_PARTE = new RegExp(`^${MULETILLA}(hazlo|hazla|dejalo|dejala|ponlo|ponla|acortalo|acortala|resumelo|resumela|cambialo|cambiala)\\b`);
// una pregunta («¿cambia el titular cuando…?»), una cita o «lo que pasó» nunca editan (revisión de Codex y Cursor, 15-oct)
export const esOrdenDeCambio = (q: string) => { const t = norm(sinCitas(q)); return (ORDEN.test(t) || ORDEN_OBJ.test(t)) && OBJETO.test(t) && !INFO.test(t) && !PREGUNTA.test(t) && !sinCitas(q).includes("?"); };

export function intencion(q: string, opts: { contexto?: ContextoPantalla | null; tokens?: string[] } = {}): Intencion {
  const t = norm(q).replace(EXPLIC, "explicame"); // «explicam», «explicar», «explicacion»: el mismo pedido (prueba de Gilberto, 8-oct)
  if (opts.contexto?.eventoId && esOrdenDeCambio(q)) return { tipo: "ajustar" };
  // un verbo de cambio suelto en medio de la frase («en el debate dijeron bájale el tono al guion»): se pregunta, no se edita
  if (opts.contexto?.eventoId && CLITICO.test(t) && OBJETO.test(t) && !q.includes("?")) return { tipo: "conversacion", motivo: "ayuda", texto: "¿Quieres que cambie el borrador? Dímelo como orden, por ejemplo: «haz el guion más corto» o «cambia el titular por uno más suave».", sugerencias: ["Haz el guion más corto"] };
  const toks = (opts.tokens ?? t.split(" ")).map((x) => (/^explic/.test(x) ? "explicame" : x));
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
  // «explícame más»: con una ficha abierta va al motor sobre ese tema (Opus redacta con sus citas); si no, explica la pantalla entera
  if (MAS.test(t)) return opts.contexto?.eventoId ? { tipo: "consulta" } : charla("pantalla", explicacionFija(opts.contexto ?? { vista: "portada" }), SUGERENCIAS.slice(0, 1));
  if (/^(explicame|explica|ayudame|ayuda me)$/.test(t)) return charla("pantalla", explicacionFija(opts.contexto ?? { vista: "portada" }), ["Hazme un recorrido por la plataforma", "¿Cuál es la noticia del día?"]);
  if (SALUDO.test(t)) return charla("saludo", "¡Hola! Soy Jarvis, el agente de la mesa. ¿Sobre qué tema quieres saber?");
  if (GRACIAS.test(t)) return charla("gracias", "Con gusto. Si quieres, pregúntame por otro tema del corte.");
  if (IDENTIDAD.test(t)) return charla("identidad", `Soy Jarvis, el agente de la mesa editorial de TVN. ${QUE_HAGO} No publico ni apruebo nada: eso lo decide una persona.`);
  if (AYUDA.test(t)) return charla("ayuda", `${QUE_HAGO} Puedes preguntarme por un tema, una persona, un lugar o un indicador de Panamá, y también qué significa la pantalla que tienes abierta.`);
  const ordenPublicar = !INFO.test(t) && (PUBLICA_YA.test(t) || AL_AIRE.test(t) || (PUBLICAR.test(t) && soloCon(new Set([...PAL_PUBLICAR, ...toks.filter((x) => PUBLICAR.test(x))]))));
  if (ordenPublicar && sinCitas(q) === q && (!PREGUNTA.test(t) || /\b(puedes|podrias|puede|puedo|podemos|publicas|publicamos|apruebas|aprobamos)\b/.test(t))) return charla("identidad", "Yo no publico ni apruebo nada: preparo el borrador con sus citas. Lo aprueba una persona con el botón de la ficha, y aprobar todavía no lo publica.", ["¿Qué me toca hoy?"]);
  if (MESA_RE.test(t) && soloCon(PAL_MESA)) return { tipo: "mesa" };
  if (SIN_PARTE.test(t) && !OBJETO.test(t)) return charla("ayuda", "¿Qué parte cambio: el guion, el copy, el resumen o los titulares?", ["Haz el guion más corto"]);
  // el trabajo de un tema: por número, el de la ficha abierta o por nombre («lo de Enrique Lau»); el nombre se resuelve en el servicio y, si no hay tema, se busca como siempre
  const trabajo = VERIFICAR_RE.test(t) ? "verificar" : (TITULARES_RE.test(t) && PIDE_TITULARES.test(t) && !AGENDA.test(t)) || (BORRADOR_RE.test(t) && PIDE_BORRADOR.test(t)) || NOTA_CREAR.test(t) || (/\bpropuestas\b/.test(t) && soloCon(PAL_TEMA_N)) ? "titulares" : null;
  // una orden de cambio sin ficha abierta no es un pedido de borrador («haz el guion más corto» abría «Un cortometraje…»)
  if (esOrdenDeCambio(q)) return charla("ayuda", "Para cambiar un borrador, primero abro la ficha del tema. Dime cuál: por ejemplo, el tema uno.", ["Abre el tema número uno"]);
  if (trabajo && !INFO.test(t)) {
    const borrador = trabajo === "titulares" && (BORRADOR_RE.test(t) || NOTA_CREAR.test(t));
    const n = numeroTema(t); // el número manda: «qué datos del quinto tema siguen sin confirmar» es el tema cinco
    if (n !== null) return { tipo: trabajo, n, ...(borrador && { borrador }) };
    const tema = toks.filter((x) => !RELLENO.has(x) && !DE_PREGUNTA.has(x) && !PAL_TRABAJO.has(x));
    if (!tema.length) return { tipo: trabajo, n: null, ...(borrador && { borrador }) }; // el de la ficha abierta (si no hay, el servicio pregunta cuál)
    // por nombre, aunque diga «este tema de Vietnam»; «¿qué borrador hay de…?» es pregunta de noticias, «¿qué falta verificar de Lau?» y «¿qué titulares propones…?» son trabajo
    if (tema.length <= 6 && sinCitas(q) === q && (trabajo === "verificar" || TITULARES_RE.test(t) || !PREGUNTA.test(t))) return { tipo: trabajo, n: null, tema: tema.join(" "), ...(borrador && { borrador }) };
  }
  const rol = queHaceRol(t);
  if (rol && soloCon(PAL_ROL)) return charla("ayuda", rol, ["Hazme un recorrido por la plataforma", "¿Cuál es la noticia del día?"]);
  if (QUE_HAGO_AQUI.test(t)) return charla("pantalla", explicacionFija(opts.contexto ?? { vista: "portada" }), ["Hazme un recorrido por la plataforma"]);
  if (PANTALLA.test(t) || (DELANTE.test(t) && QUE_ES.test(t) && sinTema)) return charla("pantalla", explicacionFija(opts.contexto ?? { vista: "portada" }), SUGERENCIAS.slice(0, 1));
  if (PLATAFORMA_RE.test(t) && (QUE_ES.test(t) || toks.length <= 3) && soloCon(PAL_PLATAFORMA)) return charla("plataforma", PLATAFORMA, ["¿Qué cinco temas merecen revisión hoy?", "¿Cuál es la noticia del día?"]);
  if ((AGENDA.test(t) || AGENDA_MAS.test(t)) && soloCon(new Set([...PAL_AGENDA, ...PAL_AGENDA_MAS])) && !CAUSA_U_OTRO_DIA.test(ELEGIR.test(t) ? t.replace(Y_POR_QUE, "") : t)) return { tipo: "agenda", uno: UNA.test(t) && !/cinco|5 |temas|noticias/.test(t) };
  // «la sección de control», «explícame la agenda»: nombrar una sección sin tema propio la muestra desde su primera parte (prueba de Gilberto, 8-oct)
  const sec = SECCION.exec(t);
  if (sec && soloCon(PAL_SECCION)) return { tipo: "guia", parte: PRIMERA_PARTE[sec[1]] };
  return { tipo: "consulta" };
}

/** El tema de la pregunta no aparece en ninguna noticia (a menudo, un nombre mal oído por la voz: «Nickelau» por «Enrique Lau»):
 *  devuelve esas palabras para abstenerse diciéndolo, en vez de responder con lo que «suena parecido» por sentido. «» si no hay tema. */
export function temaDesconocido(tokens: string[], enCorpus: (t: string) => boolean): string | null {
  const tema = tokens.filter((x) => !DE_PREGUNTA.has(x));
  if (!tema.length) return tokens.length ? null : "";
  return tema.length <= 3 && !tema.some(enCorpus) ? tema.join(" ") : null;
}
