// Explicaciones conversadas en el chat escrito (pedido de Gilberto, 8-oct): Opus responde a la pregunta reformulando el texto
// fijo de la pantalla, la plataforma o la parte de la guía, sin agregar nada. Si no pasa el validador o falla, queda el texto fijo.
import { llamarLLM, llmActivo } from "./llm";

const SISTEMA = `Eres Jarvis, el asistente de la mesa editorial AgenteTVN de TVN Media. Hablas español de Panamá con tuteo (nunca voseo), cercano y claro, como un colega de la redacción.
Te dan la PREGUNTA de una persona y el TEXTO de referencia de lo que tiene en pantalla o de la plataforma. Contesta la PREGUNTA en 2 a 4 frases usando ÚNICAMENTE lo que dice el TEXTO: puedes resumirlo, reordenarlo y decirlo con tus palabras para que responda justo a lo que preguntó, pero no agregues cifras, nombres, secciones, funciones, botones ni pasos que no estén en el TEXTO.
Si el TEXTO no responde la pregunta, dilo en una frase y cuenta lo que sí dice. No nombres modelos, proveedores ni herramientas. Devuelve solo la respuesta, sin comillas ni títulos.`;

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// palabras de conversación que no aportan contenido (no se exige que estén en el texto fijo)
const CHARLA = new Set("aqui ahi alli puedes puede pueden podes tienes tiene tienen ves vez veras mira miras sirve sirven ayuda ayudar quieres quiere dime cuenta claro dale basicamente sobre todo cada parte partes pantalla seccion esta este estas estos donde cuando como para porque tambien ademas luego despues primero segundo arriba abajo sobre entre hacer haces usar usas decir dicho explicar explico muestra muestro esto eso ello nada algo mucho poco".split(" "));

/** ¿La reformulación dice solo lo que dice el texto fijo? Sin cifras ni nombres propios nuevos, y casi todas sus palabras de contenido están en él. */
export function fielAlTexto(salida: string, fuente: string): boolean {
  const s = salida.trim(), f = norm(fuente);
  if (!s || s.length > 900) return false;
  for (const n of s.match(/\d+(?:[.,]\d+)?/g) ?? []) if (!f.includes(n)) return false;
  for (const frase of s.split(/(?<=[.!?:])\s+/)) {
    for (const [i, w] of frase.split(/\s+/).entries()) {
      const limpia = w.replace(/^[«"(¿¡]+|[»"),.;:!?]+$/g, "");
      if (i > 0 && /^[A-ZÁÉÍÓÚÑ]/.test(limpia) && !f.includes(norm(limpia))) return false; // nombre propio que no estaba
    }
  }
  const contenido = (norm(s).match(/[a-zñ]{5,}/g) ?? []).filter((w) => !CHARLA.has(w));
  if (!contenido.length) return true;
  const raiz = (w: string) => w.slice(0, 5);
  const enFuente = contenido.filter((w) => f.includes(raiz(w))).length;
  return enFuente / contenido.length >= 0.75;
}

/** La explicación fija dicha conversando para responder a la pregunta; null si no hay IA, falla o no es fiel. */
export async function explicarConversado(pregunta: string, texto: string): Promise<string | null> {
  if (!llmActivo() || !texto.trim()) return null;
  try {
    const r = await llamarLLM(SISTEMA, `PREGUNTA: ${pregunta.slice(0, 300)}\n\nTEXTO:\n${texto}`, "explicacion");
    const out = r.texto.trim().replace(/^["«]|["»]$/g, "");
    return fielAlTexto(out, texto) ? out : null;
  } catch { return null; }
}
