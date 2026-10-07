// Synthetic logistics context assembled from the existing development agency fixture.
import { replicasEFE } from "./replicas";
import { ev as template } from "./banca";
import type { Evento } from "../../src/lib/motor/contrato";
export function logisticsFixture() {
 const noticias = replicasEFE(3);
 const evento: Evento = { ...template, id: "ev-logistics-development", representante: noticias[0].id_noticia,
  ids_noticia: noticias.map(n => n.id_noticia), tema: "logistica_canal", no_confiable: false,
  procedencias: [{ id: "agencia:EFE", tipo: "agencia", nombre: "EFE", ids_noticia: noticias.map(n => n.id_noticia) }],
  contexto: { indicadores: [], sismos: [] }, contradicciones: [] };
 return { evento, noticias, indicadores: [] };
}
