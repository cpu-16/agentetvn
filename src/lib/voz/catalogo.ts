// Qué es cada pantalla, en texto fijo: «Explícame esta pantalla» lo muestra sin llamar a ningún modelo (0 tokens).
// Lo usan el panel (cliente) y la herramienta explicar_pantalla (servidor): sin imports de servidor.
export type VistaVoz = "portada" | "agenda" | "tablero" | "ficha" | "control";
export interface ContextoPantalla { vista: VistaVoz; eventoId?: string | null; pestana?: "evidencia" | "paquete"; filtrosAgenda?: string; filtroTablero?: string; rol?: "editor" | "periodista" | "productor" | "analista" } // rol: de la sesión, nunca del cliente

const TEXTO: Record<string, string> = {
  portada: "Estás en la portada, la mesa de la mañana. Arriba ves cuántas publicaciones entraron en el corte, cuántos temas se agruparon y de cuántos medios vienen. Abajo están los cinco temas que merecen revisión hoy: el puntaje ordena, y la evidencia dice qué falta verificar antes de afirmar algo. Nada se publica desde aquí.",
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
export const PLATAFORMA = "AgenteTVN es la mesa de la mañana de TVN Media. Pone primero las noticias de TVN, las cruza con otros medios y con datos oficiales, y ordena qué revisar hoy. Cada borrador lleva su cita y una persona lo aprueba. Portada, Agenda, Tablero y Control están en la barra de arriba.";
export const PLATAFORMA_CORTA = "AgenteTVN es la mesa editorial asistida de TVN Media: junta las noticias del día, con TVN primero, y los datos oficiales, las ordena por importancia y prepara borradores con citas para que una persona decida. Tiene Portada, Agenda, Fichas de cada tema, Tablero y Control.";
/** Qué hace cada rol (el que se elige al entrar): lo dicen el panel del chat, el enrutador y la voz. */
export const QUE_HACE: Record<string, string> = { editor: "Como editor o editora decides qué se cubre hoy y apruebas los borradores.", periodista: "Como periodista verificas, en la ficha de cada tema, qué dice cada fuente y qué falta.", productor: "Como productor o productora preparas el paquete para TV, web y redes, en Paquete y revisión de la ficha, y lo marcas como pieza lista.", analista: "Como analista bancario ves los temas de economía, logística, turismo y regulación, y armas el boletín de entorno en la modalidad Análisis bancario de la ficha." };
/** El texto del rol que nombra la frase («¿qué hace un periodista?»), o null. Sin tildes ni mayúsculas. */
export const queHaceRol = (t: string) => { const r = /\b(editor|periodista|productor|analista)a?s?\b/.exec(t); return r ? `${QUE_HACE[r[1]]} Ningún rol publica: aprobar deja un borrador.` : null; };
/** Orden del recorrido guiado por voz. */
export const RECORRIDO: VistaVoz[] = ["portada", "agenda", "tablero", "control"];
