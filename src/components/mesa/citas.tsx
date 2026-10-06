"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { horaPanama } from "@/store/mesa";

export interface Publicacion { id_noticia: string; titulo: string; descripcion: string; url: string; medio: string; idioma: string; fecha_publicacion: string | null; fecha_deteccion: string | null; fecha_extraccion: string; origen: string; agencia: string | null; sintetica: boolean; no_confiable: boolean; seccion?: string | null }
export interface Indicador { pais_iso3: string; indicador_id: string; anio: number; valor: number | null; unidad: string; fuente_url: string; fecha_extraccion: string; licencia: string }
export interface Sismo { id: string; magnitude: number; time: string; place: string; depth: number; url: string; status: string }

export function resolverCita(id: string, pubs: Publicacion[], inds: Indicador[], sismos: Sismo[]): { tipo: "noticia"; n: Publicacion } | { tipo: "indicador"; i: Indicador } | { tipo: "sismo"; s: Sismo } | null {
  const n = pubs.find((p) => p.id_noticia === id);
  if (n) return { tipo: "noticia", n };
  const [pais, ind, anio] = id.split(":");
  const i = inds.find((x) => x.pais_iso3 === pais && x.indicador_id === ind && x.anio === Number(anio));
  if (i) return { tipo: "indicador", i };
  const s = sismos.find((x) => x.id === id);
  if (s) return { tipo: "sismo", s };
  return null;
}

export function BotonCita({ id, campo, onAbrir }: { id: string; campo?: string; onAbrir: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onAbrir(id)} className="ml-1 inline-flex items-center rounded-sm border border-acero/40 bg-white px-1.5 py-0.5 align-baseline font-mono text-[10.5px] text-acero hover:bg-acero hover:text-white" title={`Abrir evidencia ${id}${campo ? ` (campo ${campo})` : ""}`}>
      {id.length > 22 ? `${id.slice(0, 20)}…` : id}
    </button>
  );
}

function Fila({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 border-b border-border py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="min-w-0 break-words">{v}</span>
    </div>
  );
}

export function Citas({ id, pubs, inds, sismos, onCerrar }: { id: string | null; pubs: Publicacion[]; inds: Indicador[]; sismos: Sismo[]; onCerrar: () => void }) {
  const c = id ? resolverCita(id, pubs, inds, sismos) : null;
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="titular">Evidencia {id}</DialogTitle>
        </DialogHeader>
        {!c && <p className="text-sm text-muted-foreground">Esta cita no corresponde a ninguna evidencia del snapshot. Es un error que hay que corregir antes del cierre.</p>}
        {c?.tipo === "noticia" && (
          <div>
            <Fila k="Medio" v={c.n.medio} />
            <Fila k="Titular" v={c.n.titulo} />
            {c.n.descripcion && <Fila k="Extracto" v={c.n.descripcion} />}
            <Fila k="URL" v={<a href={c.n.url} target="_blank" rel="noreferrer" className="text-acero underline">{c.n.url}</a>} />
            <Fila k="Publicación" v={c.n.fecha_publicacion ? horaPanama(c.n.fecha_publicacion) : "no disponible en la fuente"} />
            <Fila k="Detección" v={c.n.fecha_deteccion ? `${horaPanama(c.n.fecha_deteccion)} (seendate de GDELT; no es la publicación)` : "no aplica"} />
            <Fila k="Extracción" v={horaPanama(c.n.fecha_extraccion)} />
            <Fila k="Agencia" v={c.n.agencia ?? "no atribuida en el texto"} />
            <Fila k="Origen" v={`${c.n.origen}${c.n.seccion ? `, sección ${c.n.seccion}` : ""}`} />
            {c.n.sintetica && <Fila k="Aviso" v="Caso sintético creado por el equipo para pruebas." />}
            {c.n.no_confiable && <Fila k="Aviso" v={<span className="text-senal">Contenido no confiable: intenta instruir al agente. Se trata como dato y se excluye del contexto.</span>} />}
            <p className="mt-2 text-xs text-muted-foreground">Basado únicamente en titular/metadatos; no se leyó el artículo completo.</p>
          </div>
        )}
        {c?.tipo === "indicador" && (
          <div>
            <Fila k="País" v={c.i.pais_iso3} />
            <Fila k="Indicador" v={c.i.indicador_id} />
            <Fila k="Año" v={c.i.anio} />
            <Fila k="Valor" v={c.i.valor === null ? "nulo (no publicado)" : `${c.i.valor} ${c.i.unidad}`} />
            <Fila k="Fuente" v={<a href={c.i.fuente_url} target="_blank" rel="noreferrer" className="text-acero underline break-all">{c.i.fuente_url}</a>} />
            <Fila k="Extracción" v={horaPanama(c.i.fecha_extraccion)} />
            <Fila k="Licencia" v={c.i.licencia} />
            <p className="mt-2 text-xs text-ambar-700 text-[#7a5600]">Contexto histórico, no dato de hoy: es la cifra anual de {c.i.anio} publicada por el Banco Mundial.</p>
          </div>
        )}
        {c?.tipo === "sismo" && (
          <div>
            <Fila k="Evento USGS" v={c.s.id} />
            <Fila k="Magnitud" v={c.s.magnitude} />
            <Fila k="Fecha" v={horaPanama(c.s.time)} />
            <Fila k="Lugar" v={c.s.place} />
            <Fila k="Profundidad" v={`${c.s.depth} km`} />
            <Fila k="URL" v={<a href={c.s.url} target="_blank" rel="noreferrer" className="text-acero underline">{c.s.url}</a>} />
            <p className="mt-2 text-xs text-muted-foreground">Solo prueba el hecho sísmico; no es evidencia de daños ni pérdidas.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
