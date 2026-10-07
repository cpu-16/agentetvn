// Synthetic candidate records modeling admissible public items, shared with CU-01/T08.
// Input noticia.sintetica=false is deliberate for candidate-selection behavior; provenance is synthetic.
import type { Snapshot } from "../../src/lib/motor/cargar";
import type { Evento } from "../../src/lib/motor/contrato";
import { n } from "./noticias";
export const agendaExpected = ["a", "b", "e", "f", "g"];
export function agendaFixture(): Snapshot {
  const mk = (id: string, tema: string, P: number): Evento => ({ id, representante: id, ids_noticia: [id], procedencias: [], tema, tema_confianza: 1, por_revisar: false, fecha_original: null, contexto: { indicadores: [], sismos: [] }, contradicciones: [], componentes: { R: 1, I: 1, U: 1, N: 1, E: 1, explicacion: { R: "relevance", I: "impact", U: "urgency", N: "novelty", E: "evidence" } }, P, rango: "alto", estado_evidencia: "parcial", no_confiable: false });
  const eventos = [mk("a", "economia", 90), mk("b", "economia", 89), mk("c", "economia", 88), mk("d", "deportes", 87), mk("e", "turismo", 86), mk("f", "regulacion", 85), mk("g", "turismo", 84), mk("h", "economia", 83)];
  return { eventos, noticias: eventos.map((e) => n({ id_noticia: e.id, url: "https://candidate.test/" + e.id, titulo: "Titular candidato de desarrollo " + e.id })) } as Snapshot;
}
