// T07 · el texto de una fuente es dato, no instrucción. Detecta intentos de instruir al agente y marca la fuente.
const PATRONES: { re: RegExp; motivo: string }[] = [
  { re: /ignor[ae]s?\s+(tus|las|todas\s+(?:las|tus)|previous|all|your)?\s*(instrucciones|instructions|reglas|rules)/i, motivo: "pide ignorar instrucciones" },
  { re: /(revela|muestra|imprime|reveal|show|print)\s+(la|tu|el|your|the)?\s*(clave|contraseña|token|prompt|system prompt|secreto|api key)/i, motivo: "pide revelar secretos o el prompt" },
  { re: /\bsystem prompt\b|prompt (de|del) sistema/i, motivo: "menciona el system prompt" },
  { re: /(aprueba|publica|aprobar|publicar|marca como (verificad|aprobad))\s+(esta|este|la|el)?\s*(noticia|nota|borrador|art[ií]culo|caso)/i, motivo: "intenta ordenar una acción editorial" },
  { re: /(eres|act[uú]a como|you are now|act as)\s+(un|una|a)?\s*(asistente|agente|assistant|modelo)/i, motivo: "intenta redefinir el rol del agente" },
  { re: /(cambia|modifica|sube|baja)\s+(los\s+)?(pesos|puntaje|prioridad|reglas)/i, motivo: "intenta alterar las reglas de puntaje" },
];

/** T07 en la pregunta del chat o la voz: solo órdenes claras (saltarse las reglas, sacar el prompt o las claves).
 *  Más estricto que esNoConfiable: «¿qué falta antes de publicar la noticia?» o «¿qué revela la clave del crecimiento?» son preguntas legítimas. */
const ORDENES_EN_PREGUNTA = [PATRONES[0].re, /\bsystem prompt\b|prompt (de|del) sistema|tu prompt/i,
  /(revela|muestra|imprime|dime|reveal|show|print)\s+((la|el|the)\s+)?(prompt|clave de (la )?api|api key|instrucciones (internas|del sistema))/i,
  /(revela|muestra|imprime|dime|reveal|show|print)\s+(tu|tus|your)\s+(contraseña|token|secreto|claves?|prompt|instrucciones)/i];
export const esOrdenEnPregunta = (q: string) => ORDENES_EN_PREGUNTA.some((re) => re.test(q));

export function esNoConfiable(texto: string): { no_confiable: boolean; motivo: string | null } {
  for (const p of PATRONES) if (p.re.test(texto)) return { no_confiable: true, motivo: p.motivo };
  return { no_confiable: false, motivo: null };
}

/** Envuelve una fuente como bloque de datos para cualquier prompt: nunca se concatena cruda. */
export function bloqueFuente(id: string, campo: string, texto: string): string {
  return `<<fuente id="${id}" campo="${campo}" tipo="dato" instrucciones="ninguna">>\n${texto.replace(/<<|>>/g, "")}\n<</fuente>>`;
}
