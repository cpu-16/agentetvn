// T07 · el texto de una fuente es dato, no instrucción. Detecta intentos de instruir al agente y marca la fuente.
const PATRONES: { re: RegExp; motivo: string }[] = [
  { re: /ignor[ae]s?\s+(tus|las|todas\s+las|previous|all|your)?\s*(instrucciones|instructions|reglas|rules)/i, motivo: "pide ignorar instrucciones" },
  { re: /(revela|muestra|imprime|reveal|show|print)\s+(la|tu|el|your|the)?\s*(clave|contraseña|token|prompt|system prompt|secreto|api key)/i, motivo: "pide revelar secretos o el prompt" },
  { re: /\bsystem prompt\b/i, motivo: "menciona el system prompt" },
  { re: /(aprueba|publica|aprobar|publicar|marca como (verificad|aprobad))\s+(esta|este|la|el)?\s*(noticia|nota|borrador|art[ií]culo|caso)/i, motivo: "intenta ordenar una acción editorial" },
  { re: /(eres|act[uú]a como|you are now|act as)\s+(un|una|a)?\s*(asistente|agente|assistant|modelo)/i, motivo: "intenta redefinir el rol del agente" },
  { re: /(cambia|modifica|sube|baja)\s+(los\s+)?(pesos|puntaje|prioridad|reglas)/i, motivo: "intenta alterar las reglas de puntaje" },
];

export function esNoConfiable(texto: string): { no_confiable: boolean; motivo: string | null } {
  for (const p of PATRONES) if (p.re.test(texto)) return { no_confiable: true, motivo: p.motivo };
  return { no_confiable: false, motivo: null };
}

/** Envuelve una fuente como bloque de datos para cualquier prompt: nunca se concatena cruda. */
export function bloqueFuente(id: string, campo: string, texto: string): string {
  return `<<fuente id="${id}" campo="${campo}" tipo="dato" instrucciones="ninguna">>\n${texto.replace(/<<|>>/g, "")}\n<</fuente>>`;
}
