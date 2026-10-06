// Paleta del tablero. Categórica por tema en orden FIJO (validada con scripts/validate_palette.js de dataviz:
// banda de luminosidad, croma, separación CVD (aviso 6.8 verde↔marrón, cubierto por leyenda + etiquetas directas), contraste ≥ 3:1).
export const AZUL_TVN = "#0077c8";
export const AZUL_OSCURO = "#00466f";
export const ROJO_ALERTA = "#d7263d";
export const AMBAR = "#e0a100";
export const VERDE = "#1b9e77";
export const GRIS = "#8a93a3";
export const TINTA = "#0f1b2d";

export const ORDEN_TEMAS = ["economia", "logistica_canal", "turismo", "servicios_publicos", "eventos_naturales", "regulacion", "deportes", "otro"] as const;
export const COLOR_TEMA: Record<string, string> = {
  economia: AZUL_TVN,
  logistica_canal: "#b45309",
  turismo: "#0891b2",
  servicios_publicos: "#15803d",
  eventos_naturales: "#b91c1c",
  regulacion: "#7c3aed",
  deportes: "#be185d",
  otro: "#6d28d9",
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
export const nombreTema = (t: string) => NOMBRE_TEMA[t] ?? t;

/** Rango de atención: gris → azul claro → azul TVN. «Investigar» (alto + insuficiente) va en rojo de alerta. */
export const COLOR_RANGO: Record<string, string> = { bajo: GRIS, medio: "#5fa8dd", alto: AZUL_TVN, investigar: ROJO_ALERTA };
export const COLOR_EVIDENCIA: Record<string, string> = { insuficiente: ROJO_ALERTA, parcial: AMBAR, suficiente: VERDE };
/** Secuencial de una sola tonalidad (azul), claro → oscuro, para magnitudes (P mediana, profundidad). */
export const RAMPA_AZUL = ["#dbeaf7", "#9ec7e8", "#5fa8dd", AZUL_TVN, AZUL_OSCURO];

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
/** Los tooltips de ECharts se pintan como HTML y los textos vienen de fuentes no confiables (GDELT, USGS): siempre se escapan. */
export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
export const fmt = (n: number, d = 0) => n.toLocaleString("es-PA", { maximumFractionDigits: d, minimumFractionDigits: 0 });
