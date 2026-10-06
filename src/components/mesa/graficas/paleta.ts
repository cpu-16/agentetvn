// Paleta del tablero.
// Categórica por tema en orden FIJO (el orden de la leyenda es el que se validó): validada el 6-oct-2026 con
// `scripts/validate_palette.js` de la skill dataviz, modo light, superficie #f3f5f8, pares adyacentes:
// banda de luminosidad PASS, croma ≥ 0.1 PASS, separación CVD PASS (peor par adyacente ΔE > 8), visión normal PASS,
// contraste WARN (un tono bajo 3:1 sobre el papel) → cubierto por etiquetas directas, leyenda y «Ver como tabla».
// Ninguno de los ocho se parece al rojo de alerta (#d7263d), al ámbar de «parcial» (#e0a100) ni al verde de «suficiente» (#1b9e77):
// esos tres son colores de ESTADO y van siempre con rótulo.
export const AZUL_TVN = "#0077c8";
export const AZUL_OSCURO = "#00466f";
export const ROJO_ALERTA = "#d7263d";
export const AMBAR = "#e0a100";
export const VERDE = "#1b9e77";
export const GRIS = "#8a93a3";
export const TINTA = "#0f1b2d";

export const ORDEN_TEMAS = ["economia", "servicios_publicos", "logistica_canal", "turismo", "eventos_naturales", "regulacion", "deportes", "otro"] as const;
export const COLOR_TEMA: Record<string, string> = {
  economia: AZUL_TVN, // azul TVN
  servicios_publicos: "#4d7c0f", // oliva
  logistica_canal: "#0891b2", // cian (agua, Canal)
  turismo: "#c026d3", // magenta
  eventos_naturales: "#854d0e", // tierra
  regulacion: "#5b4fcf", // índigo
  deportes: "#2a9d8f", // verde azulado (fuera de la agenda)
  otro: "#b45309", // ocre (fuera de la agenda)
};
export const NOMBRE_TEMA: Record<string, string> = {
  economia: "Economía",
  logistica_canal: "Logística y Canal",
  turismo: "Turismo",
  servicios_publicos: "Servicios públicos",
  eventos_naturales: "Eventos naturales",
  regulacion: "Regulación",
  deportes: "Deportes",
  otro: "Otro",
};
export const colorTema = (t: string) => COLOR_TEMA[t] ?? GRIS;
/** Nombre legible; un id fuera del catálogo vuelve saneado (solo letras, números, guion bajo) para que nunca lleve HTML. */
export const nombreTema = (t: string) => NOMBRE_TEMA[t] ?? String(t).replace(/[^\p{L}\p{N}_ -]/gu, "");

/** Rango de atención: gris → azul claro → azul TVN. «Investigar» (alto + insuficiente) va en rojo de alerta. */
export const COLOR_RANGO: Record<string, string> = { bajo: GRIS, medio: "#5fa8dd", alto: AZUL_TVN, investigar: ROJO_ALERTA };
export const COLOR_EVIDENCIA: Record<string, string> = { insuficiente: ROJO_ALERTA, parcial: AMBAR, suficiente: VERDE };
/** Secuencial de una sola tonalidad (azul), claro → oscuro, para magnitudes (profundidad). */
export const RAMPA_AZUL = ["#dbeaf7", "#9ec7e8", "#5fa8dd", AZUL_TVN, AZUL_OSCURO];
/** Rampa para texto blanco encima (P de los eventos en el mapa de temas): empieza en un azul medio legible. */
export const RAMPA_AZUL_OSCURA = ["#5fa8dd", "#2f8fd3", AZUL_TVN, "#005a9c", AZUL_OSCURO];

export const FUENTE = '"IBM Plex Sans", system-ui, sans-serif';
export const FUENTE_DISPLAY = '"IBM Plex Sans Condensed", "IBM Plex Sans", system-ui, sans-serif';

export const BASE_TEXTO = { color: TINTA, fontFamily: FUENTE, fontSize: 12 } as const;
export const EJE = {
  axisLine: { lineStyle: { color: "#d9dee6" } },
  axisTick: { show: false },
  axisLabel: { color: "#5b6572", fontFamily: FUENTE, fontSize: 11 },
  splitLine: { lineStyle: { color: "#e9edf2" } },
} as const;
export const TOOLTIP = {
  backgroundColor: "#ffffff",
  borderColor: "#d9dee6",
  borderWidth: 1,
  padding: [8, 10],
  textStyle: { color: TINTA, fontFamily: FUENTE, fontSize: 12 },
  extraCssText: "box-shadow: 0 8px 24px rgba(15,27,45,.12); border-radius: 4px; font-variant-numeric: tabular-nums;",
} as const;
/** Leyenda compacta: con poco ancho pasa a desplazable para no comerse el área de dibujo. */
export const leyenda = (compacto: boolean, extra: Record<string, unknown> = {}) => ({ top: 0, left: 0, type: compacto ? "scroll" : "plain", icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: FUENTE, fontSize: 11 }, pageIconSize: 10, pageTextStyle: { fontFamily: FUENTE, fontSize: 10 }, ...extra });
/** Los tooltips de ECharts se pintan como HTML y los textos vienen de fuentes no confiables (GDELT, USGS): siempre se escapan. */
export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/** Número en español de Panamá; un valor ausente (p. ej. un nodo en transición de ECharts) se muestra como «—», nunca rompe el tooltip. */
export const fmt = (n: number | null | undefined, d = 0) => (typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("es-PA", { maximumFractionDigits: d, minimumFractionDigits: 0 }) : "—");
