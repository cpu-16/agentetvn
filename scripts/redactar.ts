// Precarga · redacta con el LLM los eventos de prioridad alta y los guarda en la base, para que la demo sin red muestre esa versión.
//   AGENTETVN_MODO=online LLM_BASE_URL=http://127.0.0.1:8766/v1 bun scripts/redactar.ts [--forzar]
// Un paquete ya guardado (quizá editado por una persona) no se toca salvo con --forzar.
import { db } from "../src/lib/db";
import { paquete, snapshot } from "../src/lib/motor/servicio";
import { llmActivo } from "../src/lib/motor/llm";

if (!llmActivo()) { console.error("Hace falta AGENTETVN_MODO=online y LLM_BASE_URL."); process.exit(1); }
const forzar = process.argv.includes("--forzar");
let costo = 0, sinCosto = 0;
for (const e of snapshot().eventos.filter((x) => x.rango === "alto" && !x.no_confiable)) {
  const previo = await db.paqueteEditado.findUnique({ where: { eventoId: e.id } });
  if (previo && !forzar) { console.log(`${e.id} ya tiene paquete (${previo.modo}); usa --forzar para rehacerlo`); continue; }
  const p = await paquete(e.id, "AgenteTVN · precarga", true);
  if (p?.llm) { if (p.llm.costo_usd == null) sinCosto++; else costo += p.llm.costo_usd; }
  console.log(`${e.id} P${e.P} → ${p?.modo}${p?.llm ? ` ${Math.round(p.llm.ms / 1000)} s, US$${p.llm.costo_usd?.toFixed(3)}, ${p.llm.descartadas.length} descartadas` : ` (${p?.verificaciones.at(-1)})`}`);
}
console.log(`costo medido: US$${costo.toFixed(3)}${sinCosto ? ` + ${sinCosto} redacción(es) sin costo reportado (desconocido)` : ""}; detalle por intento en db/llm-intentos.jsonl`);
