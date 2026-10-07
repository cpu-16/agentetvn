// Guía de la plataforma: qué es cada parte de cada pantalla, dónde está (data-guia) y qué se puede demostrar en ella.
// La usan el chat (texto fijo, 0 tokens) y la voz (herramientas), y el recorrido guiado. Sin imports de servidor.
import type { VistaVoz } from "./catalogo";

export type Demo = { tipo: "pestana"; pestana: "evidencia" | "paquete" } | { tipo: "filtroTablero"; temas?: string[]; medio?: string; limpiar?: boolean };
export interface Parte { id: string; vista: VistaVoz; ancla: string; titulo: string; texto: string; claves: string[]; demo?: Demo }

export const GUIA: Parte[] = [
  { id: "portada-cifras", vista: "portada", ancla: "portada-cifras", titulo: "Las cifras del corte", claves: ["cifras", "numeros", "cifras del corte", "temas agrupados", "reloj"],
    texto: "Arriba ves el corte de esta mañana: cuántas publicaciones entraron, en cuántos temas se agruparon y de cuántos medios vienen. Una noticia repetida por varios medios cuenta como un solo tema." },
  { id: "portada-cinco", vista: "portada", ancla: "portada-cinco", titulo: "Cinco para hoy", claves: ["cinco para hoy", "cinco temas", "tarjetas", "portada", "prioridad"],
    texto: "Estos son los cinco temas que más merecen revisión hoy, como máximo dos por tema. El número grande es su lugar en la lista; debajo van el puntaje de atención de 0 a 100 y la etiqueta que dice si la evidencia alcanza para escribir." },
  { id: "agenda-lista", vista: "agenda", ancla: "agenda-lista", titulo: "La agenda del día", claves: ["agenda", "lista", "todos los temas", "puntaje", "componentes", "barra"],
    texto: "Aquí están todos los temas del corte ordenados por puntaje. La barra de cada fila se parte en sus cinco componentes: relevancia, impacto, urgencia, novedad y evidencia." },
  { id: "agenda-filtros", vista: "agenda", ancla: "agenda-filtros", titulo: "Los filtros de la agenda", claves: ["filtros", "filtrar", "buscar", "buscador", "estado", "tema"],
    texto: "Con estos filtros buscas por titular o medio, eliges un tema o un estado de revisión, como nuevo, en revisión o aprobado. Sirven para pasar de cientos de temas a los pocos que te tocan." },
  { id: "ficha-evidencia", vista: "ficha", ancla: "ficha-evidencia", titulo: "La ficha: evidencia", claves: ["ficha", "evidencia", "procedencias", "quien lo dice", "fuentes del tema", "por que el puntaje"], demo: { tipo: "pestana", pestana: "evidencia" },
    texto: "Esta es la ficha del tema número uno. En Evidencia ves qué publicaciones lo reportan, de qué procedencias vienen, el dato oficial si lo hay y por qué tiene ese puntaje." },
  { id: "ficha-paquete", vista: "ficha", ancla: "ficha-paquete", titulo: "La ficha: paquete y revisión", claves: ["paquete", "borrador", "brief", "guion", "redes", "revision", "aprobar", "descartar"], demo: { tipo: "pestana", pestana: "paquete" },
    texto: "En Paquete y revisión está el borrador para TV, web y redes, cada frase con su cita. Una persona lo toma, lo corrige y lo aprueba como borrador o lo descarta: aprobar no publica." },
  { id: "tablero-dias", vista: "tablero", ancla: "tablero-dias", titulo: "Publicaciones por fecha y tema", claves: ["linea de tiempo", "fecha", "dias", "por dia", "publicaciones por fecha", "periodo"], demo: { tipo: "filtroTablero", limpiar: true },
    texto: "Esta línea de tiempo cuenta las publicaciones por día y por tema. Si arrastras sobre ella eliges un período, y todo el tablero se ajusta a esas fechas." },
  { id: "tablero-temas", vista: "tablero", ancla: "tablero-temas", titulo: "Publicaciones por tema", claves: ["publicaciones por tema", "grafica de temas", "grafica de publicaciones", "por tema", "mapa de temas"], demo: { tipo: "filtroTablero", temas: ["economia"] },
    texto: "Esta gráfica reparte las publicaciones por tema; si tocas un tema, todo el tablero se filtra. Para mostrarte, filtré Economía: mira cómo cambian las cifras y las gráficas. Con Limpiar vuelves a todo el corte." },
  { id: "tablero-relevancia", vista: "tablero", ancla: "tablero-relevancia", titulo: "Relevancia frente a evidencia", claves: ["relevancia", "relevancia frente a evidencia", "dispersion", "puntos"], demo: { tipo: "filtroTablero", limpiar: true },
    texto: "Cada punto es un tema: a la derecha más relevante, arriba con más evidencia. Lo que queda abajo a la derecha es importante pero todavía flojo de evidencia: ahí hay que verificar." },
  { id: "tablero-evidencia", vista: "tablero", ancla: "tablero-evidencia", titulo: "Estado de evidencia por tema", claves: ["estado de evidencia", "evidencia por tema", "suficiente", "parcial", "insuficiente"],
    texto: "Aquí ves, para cada tema, cuántos eventos tienen evidencia suficiente, parcial o insuficiente. Sirve para saber dónde falta reportería antes de escribir." },
  { id: "tablero-medios", vista: "tablero", ancla: "tablero-medios", titulo: "Medios con más publicaciones", claves: ["medios", "medio", "grafica de medios", "quien publica", "medios con mas publicaciones"], demo: { tipo: "filtroTablero", medio: "TVN" },
    texto: "Estos son los medios con más publicaciones en el corte. Filtré TVN para mostrarte su cobertura: todo el tablero queda solo con lo que publicó TVN." },
  { id: "tablero-procedencias", vista: "tablero", ancla: "tablero-procedencias", titulo: "Procedencias", claves: ["procedencias", "agencias", "replicas", "origen"], demo: { tipo: "filtroTablero", limpiar: true },
    texto: "Las procedencias separan quién originó la información de quién solo la replicó. Diez medios copiando una agencia cuentan como una sola procedencia, no como diez confirmaciones." },
  { id: "tablero-contexto", vista: "tablero", ancla: "tablero-contexto", titulo: "Contexto oficial del Banco Mundial", claves: ["banco mundial", "grafica del banco mundial", "indicadores del banco mundial", "contexto oficial", "grafica de inflacion", "grafica del pib", "grafica de pib", "grafica de desempleo", "grafica de indicadores"],
    texto: "Estos son los indicadores oficiales del Banco Mundial para Panamá y la región. Son contexto histórico anual, no una medición de hoy." },
  { id: "tablero-sismos", vista: "tablero", ancla: "tablero-sismos", titulo: "Sismos del USGS", claves: ["mapa de sismos", "grafica de sismos", "sismos del usgs", "usgs"],
    texto: "El mapa muestra los sismos de 2024 en la región según el USGS. Si una noticia habla de un sismo, aquí se contrasta con el registro oficial." },
  { id: "control-datos", vista: "control", ancla: "control-datos", titulo: "Datos del corte", claves: ["datos del corte", "snapshot", "huellas", "sha", "fuentes de datos", "de donde salen"],
    texto: "Control dice de dónde salen los datos: cada archivo del corte con su huella SHA-256, para que cualquiera pueda comprobar que no cambió." },
  { id: "control-reglas", vista: "control", ancla: "control-reglas", titulo: "Reglas del puntaje", claves: ["reglas", "formula", "pesos", "como se calcula el puntaje"],
    texto: "Aquí están las reglas del puntaje con sus pesos: treinta por ciento relevancia, veinticinco impacto, veinte urgencia, quince novedad y diez evidencia." },
  { id: "control-ia", vista: "control", ancla: "control-ia", titulo: "La IA frente al método simple", claves: ["benchmark", "comparacion", "ia frente", "baseline", "metodo simple", "embeddings", "por sentido"],
    texto: "Esta es la prueba de la IA: la búsqueda por sentido contra la búsqueda por palabras sobre las mismas consultas. La IA acierta igual, no se calla cuando sí hay respuesta y resiste los ataques." },
  { id: "control-pruebas", vista: "control", ancla: "control-pruebas", titulo: "Pruebas del reto", claves: ["pruebas", "t01", "t10", "matriz", "aceptacion"],
    texto: "Y estas son las diez pruebas de aceptación del reto, de T01 a T10, con su resultado. Todas pasan, también sin internet." },
];

/** El recorrido guiado: baja por cada pantalla, resalta cada parte y hace las demostraciones. */
export const RECORRIDO_GUIA = ["portada-cifras", "portada-cinco", "agenda-lista", "agenda-filtros", "ficha-evidencia", "ficha-paquete", "tablero-dias", "tablero-temas", "tablero-medios", "tablero-relevancia", "control-ia", "control-pruebas"];

export const parte = (id: string) => GUIA.find((p) => p.id === id);
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();

/** La parte de la pantalla que nombra el texto («la gráfica de publicaciones por tema», «los filtros», «el borrador»), o null.
 *  Gana la clave más larga que aparezca (la más específica). Si hay vista abierta, empata a favor de esa vista. */
export function buscarParte(texto: string, vistaActual?: string): Parte | null {
  const t = ` ${norm(texto)} `;
  let mejor: { p: Parte; largo: number } | null = null;
  for (const p of GUIA) for (const c of p.claves) {
    if (!t.includes(` ${c} `) && !t.includes(` ${c}s `)) continue;
    const largo = c.length + (p.vista === vistaActual ? 0.5 : 0);
    if (!mejor || largo > mejor.largo) mejor = { p, largo };
  }
  return mejor?.p ?? null;
}

/** Temas y medios que se pueden pedir para filtrar el tablero («filtra por economía», «muéstrame solo TVN»). */
const TEMAS_FILTRO: Record<string, string[]> = {
  economia: ["economia", "economica", "economico"], logistica_canal: ["canal", "logistica", "puertos"], turismo: ["turismo"],
  servicios_publicos: ["servicios publicos", "agua", "luz", "electricidad"], eventos_naturales: ["eventos naturales", "clima", "lluvias", "inundaciones"],
  regulacion: ["regulacion", "leyes", "asamblea", "gobierno"], deportes: ["deportes", "futbol"],
};
export const NOMBRE_TEMA: Record<string, string> = { economia: "Economía", logistica_canal: "Logística y Canal", turismo: "Turismo", servicios_publicos: "Servicios públicos", eventos_naturales: "Eventos naturales", regulacion: "Regulación", deportes: "Deportes" };
/** «filtra el tablero por economía» → demo de filtro; «quita el filtro» → limpiar; null si no es un pedido de filtro. */
// Solo órdenes completas: «¿cómo se filtra el agua?» o «solo las noticias de TVN sobre Enrique Lau» son consultas (revisión de Codex)
const ORDEN_FILTRO = /^(?:(?:por favor|jarvis|oye|ahora|a ver|y) )*(filtra|filtrar|filtrame|filtralo|muestrame solo|ensename solo|deja solo|pon|ponme|cambia)\b/;
const RELLENO_FILTRO = new Set("filtra filtrar filtrame filtralo muestrame ensename deja pon ponme cambia solo el la los las lo por de del con en al a tablero graficas grafica las noticias publicaciones tema temas medio por favor jarvis oye ahora ver y que sea sean".split(" "));
export function pedidoFiltro(texto: string): Demo | null {
  const n = norm(texto), t = ` ${n} `;
  if (/^(?:(?:por favor|jarvis|oye|ahora|y) )*(quita|quitar|limpia|limpiar|borra|borrar|resetea|reinicia)( el| los| todos los)? (filtro|filtros)( del tablero| de las graficas)?$/.test(n)) return { tipo: "filtroTablero", limpiar: true };
  // «filtra…», «muéstrame solo…» o «el tablero / las gráficas por <tema>» (la voz a veces oye «quita el tablero por economía»)
  if (!ORDEN_FILTRO.test(n) && !/\b(tablero|graficas) (por|de|con|solo)\b/.test(t)) return null;
  let demo: Demo | null = null, palabras: string[] = [];
  if (/ tvn /.test(t)) { demo = { tipo: "filtroTablero", medio: "TVN" }; palabras = ["tvn"]; }
  else {
    const tema = Object.entries(TEMAS_FILTRO).find(([, cs]) => cs.some((c) => t.includes(` ${c} `)));
    if (tema) { demo = { tipo: "filtroTablero", temas: [tema[0]] }; palabras = tema[1].flatMap((c) => c.split(" ")); }
  }
  if (!demo) return null;
  const sobra = n.split(" ").filter((w) => w && !RELLENO_FILTRO.has(w) && !palabras.includes(w) && !/^(quita|quitar)$/.test(w));
  return sobra.length ? null : demo; // trae un tema propio («sobre Enrique Lau»): es una consulta
}
