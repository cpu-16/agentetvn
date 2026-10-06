// T01 · valida filas crudas del snapshot: separa errores, conserva nulos, no bloquea la carga.
import type { Indicador, Noticia } from "./contrato";

export interface ErrorFila {
  archivo: "noticias.csv" | "indicadores.csv";
  fila: number; // 1 = primera fila de datos
  campo: string;
  motivo: string;
  id?: string;
}

const fechaISO = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "" || v === "null") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const bool = (v: unknown) => v === true || v === "true" || v === "1";
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));

export function validarNoticias(filas: Record<string, unknown>[]): { validas: Noticia[]; errores: ErrorFila[] } {
  const validas: Noticia[] = [];
  const errores: ErrorFila[] = [];
  const ids = new Set<string>();
  filas.forEach((f, i) => {
    const fila = i + 1;
    const id = str(f.id_noticia).trim();
    const titulo = str(f.titulo).trim();
    const url = str(f.url).trim();
    const faltan = [["id_noticia", id], ["titulo", titulo], ["url", url]].filter(([, v]) => !v).map(([k]) => k);
    if (faltan.length) {
      errores.push({ archivo: "noticias.csv", fila, campo: faltan.join(","), motivo: "campo obligatorio vacío; fila excluida", id });
      return;
    }
    if (ids.has(id)) {
      errores.push({ archivo: "noticias.csv", fila, campo: "id_noticia", motivo: "id duplicado; se conserva la primera", id });
      return;
    }
    ids.add(id);
    const pub = fechaISO(f.fecha_publicacion);
    if (f.fecha_publicacion && !pub) errores.push({ archivo: "noticias.csv", fila, campo: "fecha_publicacion", motivo: `fecha inválida «${str(f.fecha_publicacion)}»; se guarda nula`, id });
    const det = fechaISO(f.fecha_deteccion);
    if (f.fecha_deteccion && !det) errores.push({ archivo: "noticias.csv", fila, campo: "fecha_deteccion", motivo: `fecha inválida «${str(f.fecha_deteccion)}»; se guarda nula`, id });
    try {
      new URL(url);
    } catch {
      errores.push({ archivo: "noticias.csv", fila, campo: "url", motivo: "URL no parseable; fila excluida", id });
      return;
    }
    const origen = str(f.origen) as Noticia["origen"];
    validas.push({
      id_noticia: id,
      titulo,
      descripcion: str(f.descripcion),
      url,
      medio: str(f.medio) || "desconocido",
      idioma: str(f.idioma) || "es",
      fecha_publicacion: pub,
      fecha_deteccion: det,
      fecha_extraccion: fechaISO(f.fecha_extraccion) ?? "",
      tema: str(f.tema) || null,
      origen: ["tvn_rss", "rss_otros", "gdelt", "sintetica"].includes(origen) ? origen : "gdelt",
      alcance_texto: "titular_metadatos",
      agencia: str(f.agencia) || null,
      sintetica: bool(f.sintetica),
      no_confiable: bool(f.no_confiable),
      seccion: str(f.seccion) || null,
    });
  });
  return { validas, errores };
}

export function validarIndicadores(filas: Record<string, unknown>[]): { validas: Indicador[]; errores: ErrorFila[] } {
  const validas: Indicador[] = [];
  const errores: ErrorFila[] = [];
  filas.forEach((f, i) => {
    const fila = i + 1;
    const anio = Number(f.anio);
    if (!str(f.pais_iso3) || !str(f.indicador_id) || !Number.isInteger(anio)) {
      errores.push({ archivo: "indicadores.csv", fila, campo: "pais_iso3,indicador_id,anio", motivo: "clave incompleta; fila excluida" });
      return;
    }
    const crudo = str(f.valor).trim();
    let valor: number | null = null;
    if (crudo !== "" && crudo !== "null") {
      const n = Number(crudo);
      if (Number.isFinite(n)) valor = n;
      else errores.push({ archivo: "indicadores.csv", fila, campo: "valor", motivo: `valor no numérico «${crudo}»; se guarda nulo` });
    }
    validas.push({ pais_iso3: str(f.pais_iso3), indicador_id: str(f.indicador_id), anio, valor, unidad: str(f.unidad), fuente_url: str(f.fuente_url), fecha_extraccion: str(f.fecha_extraccion), licencia: str(f.licencia) });
  });
  return { validas, errores };
}
