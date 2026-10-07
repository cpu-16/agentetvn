export type TamanoPanel = "compacto" | "lateral" | "amplio";
export const esCelular = (ancho: number) => ancho <= 640;
/** Clases de posición y tamaño. En celular siempre es hoja inferior (72 dvh o pantalla completa); sin arrastre. */
export function clasesPanel(t: TamanoPanel, celular: boolean): string {
  if (celular) return t === "amplio" ? "fixed inset-x-0 bottom-0 h-[100dvh] w-full rounded-none" : "fixed inset-x-0 bottom-0 h-[85dvh] w-full rounded-t-lg";
  if (t === "lateral") return "fixed right-4 top-16 bottom-4 w-[min(440px,calc(100vw-32px))] rounded-md";
  if (t === "amplio") return "fixed inset-4 rounded-md";
  return "fixed bottom-24 right-4 max-h-[min(72vh,640px)] w-[min(420px,calc(100vw-32px))] rounded-md";
}
/** Posición de arrastre dentro de la ventana, con margen. */
export function acotar(pos: { x: number; y: number }, panel: { w: number; h: number }, vista: { w: number; h: number }, margen = 16) {
  return { x: Math.min(Math.max(pos.x, margen), Math.max(margen, vista.w - panel.w - margen)), y: Math.min(Math.max(pos.y, margen), Math.max(margen, vista.h - panel.h - margen)) };
}
