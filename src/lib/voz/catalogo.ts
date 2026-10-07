// Qué es cada pantalla, en texto fijo: «Explícame esta pantalla» lo muestra sin llamar a ningún modelo (0 tokens).
// Lo usan el panel (cliente) y la herramienta explicar_pantalla (servidor): sin imports de servidor.
export type VistaVoz = "portada" | "agenda" | "tablero" | "ficha" | "control";
export interface ContextoPantalla { vista: VistaVoz; eventoId?: string | null; pestana?: "evidencia" | "paquete"; filtrosAgenda?: string; filtroTablero?: string }

const TEXTO: Record<string, string> = {
  portada: "Estás en la portada, la mesa de la mañana. Arriba ves cuántas publicaciones entraron en el corte, cuántos temas se agruparon y de cuántos medios vienen. Abajo están los cinco temas que merecen revisión hoy: el puntaje ordena, pero la evidencia decide si se puede escribir. Nada se publica desde aquí.",
  agenda: "Estás en la agenda del día: todos los temas del corte ordenados por puntaje de atención. Cada fila trae el puntaje con sus cinco componentes, el estado de la evidencia y cuántas publicaciones y procedencias tiene. Puedes filtrar por tema, por estado o buscar por titular.",
  "ficha:evidencia": "Estás en la ficha de un tema, pestaña Evidencia: qué publicaciones lo reportan, quién lo dice, de qué procedencias vienen, el contexto oficial si lo hay y por qué tiene ese puntaje. El puntaje mide atención, no verdad.",
  "ficha:paquete": "Estás en Paquete y revisión: el borrador del brief, las preguntas, el guion y el texto para redes, cada frase con su cita. Una persona lo toma en revisión, lo corrige, lo aprueba como borrador o lo descarta con motivo. Aprobar no publica.",
  tablero: "Estás en el tablero de señales: gráficas enlazadas del corte. Si filtras por tema, rango, período o medio, todo el tablero cambia, y puedes pasar ese conjunto a la agenda. Cuenta solo publicaciones reales y confiables; los casos de prueba quedan fuera.",
  control: "Estás en Control: de dónde salen los datos, con sus huellas SHA-256, las reglas del puntaje, la comparación entre la IA y el método simple, y la matriz de pruebas del reto. No es la redacción.",
};

export function explicacionFija(c: ContextoPantalla): string {
  return TEXTO[c.vista === "ficha" ? `ficha:${c.pestana ?? "evidencia"}` : c.vista] ?? TEXTO.portada;
}

export function contextoDesdeMesa(s: { vista: VistaVoz; eventoId: string | null; pantalla: { pestana?: "evidencia" | "paquete"; filtrosAgenda?: string; filtroTablero?: string } }): ContextoPantalla {
  const c: ContextoPantalla = { vista: s.vista, eventoId: s.eventoId };
  if (s.vista === "ficha" && s.pantalla.pestana) c.pestana = s.pantalla.pestana;
  if (s.vista === "agenda" && s.pantalla.filtrosAgenda) c.filtrosAgenda = s.pantalla.filtrosAgenda;
  if (s.vista === "tablero" && s.pantalla.filtroTablero) c.filtroTablero = s.pantalla.filtroTablero;
  return c;
}

/** Qué es la plataforma: lo saben el chat (texto fijo) y la voz (instrucciones y herramienta). Sin imports de servidor. */
export const PLATAFORMA = "AgenteTVN es la mesa editorial asistida de TVN Media. Cada mañana junta las noticias públicas del corte, con TVN primero y además otros medios de Panamá y la región, y los datos oficiales del Banco Mundial y del USGS; las agrupa en temas y les da un puntaje de atención de 0 a 100. Tiene cinco partes: la Portada con los cinco temas que merecen revisión hoy, la Agenda con todos los temas ordenados por puntaje, la Ficha de cada tema con su evidencia y los borradores para TV, web y redes, el Tablero con las gráficas del corte y Control con las fuentes, las reglas y las pruebas. Todo sale con su cita o dice qué falta, y nada se publica sin que una persona lo apruebe.";
export const PLATAFORMA_CORTA = "AgenteTVN es la mesa editorial asistida de TVN Media: junta las noticias del día, con TVN primero, y los datos oficiales, las ordena por importancia y prepara borradores con citas para que una persona decida. Tiene Portada, Agenda, Fichas de cada tema, Tablero y Control.";
/** Orden del recorrido guiado por voz. */
export const RECORRIDO: VistaVoz[] = ["portada", "agenda", "tablero", "control"];
