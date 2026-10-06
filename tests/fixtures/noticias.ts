import type { Noticia } from "../../src/lib/motor/contrato";
export const base: Noticia = { id_noticia: "n0", titulo: "", descripcion: "", url: "https://x.com/0", medio: "x.com", idioma: "es", fecha_publicacion: "2026-10-05T10:00:00.000Z", fecha_deteccion: null, fecha_extraccion: "2026-10-06T00:00:00.000Z", tema: null, origen: "gdelt", alcance_texto: "titular_metadatos", agencia: null, sintetica: false, no_confiable: false, seccion: null };
export const n = (p: Partial<Noticia>): Noticia => ({ ...base, ...p });
