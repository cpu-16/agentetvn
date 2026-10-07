import type { EvaluatorT, EvaluationResult } from "langsmith/evaluation";
import type { Evento, Paquete, BoletinBancario } from "../../src/lib/motor/contrato";
import type { Respuesta } from "../../src/lib/motor/consulta";
import { resolveCase, type CaseInput } from "./cases";
import type { CaseOutput } from "./target";

export interface ContractCheck { name: string; passed: boolean; }
export function contractChecks(output: CaseOutput): ContractCheck[] {
  const c = resolveCase({ caseId: output.caseId }), r = output.result;
  if (output.status === "manual_pending") return [];
  const checks: ContractCheck[] = [];
  const add = (name: string, passed: boolean) => checks.push({ name, passed });
  switch (c.operation) {
    case "agenda": case "agenda-public": {
      const topics = r.topics as { evento: Evento; razones: string[]; vacios: string[] }[];
      const ids = topics.map((t) => t.evento.id), counts = new Map<string, number>();
      for (const t of topics) counts.set(t.evento.tema, (counts.get(t.evento.tema) ?? 0) + 1);
      add("five_topics", topics.length === 5);
      if (c.expected.ids) add("known_synthetic_order", JSON.stringify(ids) === JSON.stringify(c.expected.ids));
      add("diversity", [...counts.values()].every((n) => n <= 2));
      add("eligible_topics", topics.every((t) => !["deportes", "otro"].includes(t.evento.tema)));
      add("no_synthetic_sources", topics.every((t) => !t.evento.ids_noticia.some((id) => (r.syntheticIds as string[]).includes(id))));
      add("existing_source_bindings", topics.every((t) => t.evento.ids_noticia.every((id) => (r.sourceIds as string[]).includes(id))));
      add("trusted_original_bindings", topics.every(t => !t.evento.no_confiable && t.evento.ids_noticia.length > 0 && t.evento.ids_noticia.includes(t.evento.representante) && t.evento.ids_noticia.every(id => (r.trustedSourceIds as string[]).includes(id))));
      add("reasons_and_gaps", topics.every((t) => t.razones.length > 0 && t.vacios.length > 0));
      break;
    }
    case "banking": {
      const b = r.boletin as BoletinBancario;
      add("banking_contract", r.valid === true);
      add("complete_word_limit", Number(r.words) <= Number(c.expected.maxWords));
      add("three_questions", b.preguntas.length === 3);
      if (c.expected.contradiction) add("both_versions_visible", b.hechos.some((a) => a.evidence_id === "a" && a.texto.includes("1,2")) && b.hechos.some((a) => a.evidence_id === "b" && a.texto.includes("1,5")));
      if (c.expected.sectors) add("sector_context", JSON.stringify(b.sectores) === JSON.stringify(c.expected.sectors));
      if (c.expected.uncertainHorizon) add("horizon_is_uncertain", b.horizonte.includes("por verificar"));
      add("no_client_score_or_definitive_alert", !/calificación crediticia|alerta regulatoria definitiva/i.test(JSON.stringify(b)));
      add("hypotheses_marked", b.hipotesis.every((a) => a.tipo === "hipotesis" && a.texto.startsWith("Hipótesis:")));
      if (c.expected.contradiction) add("contradiction_pending", b.faltantes.some((s) => s.includes("versiones incompatibles")));
      add("all_factual_field_constraints", output.citations?.fieldContractScore === 1);
      break;
    }
    case "editorial": {
      const p = r.paquete as Paquete;
      add("brief_word_limit", Number(r.briefWords) <= 250);
      add("three_questions", p.preguntas.length === 3);
      add("metadata_scope_visible", p.leyenda.includes("titular/metadatos"));
      add("contradiction_pending", p.verificaciones.some((s) => s.includes("Contradicción")));
      add("all_factual_field_constraints", output.citations?.fieldContractScore === 1);
      break;
    }
    case "figure": {
      if (c.expected.contextRequired) {
        add("missing_context_refused", r.contextRequired === true && r.operationPerformed === false);
      } else {
        for (const k of ["country", "year", "value", "unit", "historical"]) add("selected_" + k, r[k] === c.expected[k]);
        add("selected_citation", (r.citation as { id: string }).id === c.expected.citation);
        add("field_constraints", output.citations?.fieldContractScore === 1);
        add("source_metadata_present", typeof r.sourceURL === "string" && typeof r.license === "string");
      }
      break;
    }
    case "replicas":
      add("five_publications", r.publications === 5); add("one_agency", r.origins === 1 && r.originId === "agencia:EFE");
      add("priority_not_inflated", r.priorityInflation === 0); add("evidence_not_inflated", r.evidenceOne === r.evidenceFive); break;
    case "abstention": case "injection": {
      const response = r.response as Respuesta;
      add("explicit_abstention", response.abstener === true);
      add("no_fabricated_claims", response.afirmaciones.length === 0);
      if (c.operation === "abstention") add("missing_period_visible", response.faltante?.includes("2025") === true);
      else add("untrusted_source_excluded", response.evidencias.every((e) => e.id !== "mal"));
      break;
    }
    case "lexical": {
      const response = r.response as Respuesta;
      add("lexical_retrieval_performed", response.modo === "bm25" && !response.abstener && !response.traza?.regla && (response.traza?.comparadas ?? 0) > 0);
      add("factual_citations_bound", (output.citations?.total ?? 0) > 0 && output.citations?.fieldContractScore === 1);
      break;
    }
    case "unsupported-claim":
      add("existing_ids", output.citations?.existenceScore === 1);
      add("support_not_assumed", output.citations?.fieldContractScore != null && output.citations.fieldContractScore < 1);
      add("actual_validator_rejects", r.valid === false); break;
    case "existing-test":
      add("suite_exit_success", r.exitCode === 0); add("assertions_executed", Number(r.passed) >= 1); add("no_failed_tests", r.failed === 0); break;
  }
  return checks;
}
// Compatible with LangSmith's object-argument evaluator interface. No LLM judge or SDK upload.
export const scenarioEvaluator: EvaluatorT = ({ outputs }: { outputs: Record<string, unknown> }): EvaluationResult => {
  const output = outputs as CaseOutput;
  if (output.status === "manual_pending") return { key: "scenario_contract", value: "manual_pending", comment: "Unscored; genuine evidence or human labels are required." };
  const checks = contractChecks(output);
  return { key: "scenario_contract", score: checks.length > 0 && checks.every((c) => c.passed), comment: JSON.stringify(checks) };
};
function citationMetric(output: CaseOutput, field: "existenceScore" | "fieldContractScore", key: string): EvaluationResult {
  const score = output.citations?.[field];
  return score == null ? { key, value: "not_applicable", comment: "No factual-claim denominator; no correctness score inferred." }
    : { key, score, comment: output.citations!.limitations };
}
export const citationExistenceEvaluator: EvaluatorT = ({ outputs }: { outputs: Record<string, unknown> }) => citationMetric(outputs as CaseOutput, "existenceScore", "citation_existence");
export const citationFieldEvaluator: EvaluatorT = ({ outputs }: { outputs: Record<string, unknown> }) => citationMetric(outputs as CaseOutput, "fieldContractScore", "citation_field_constraints");
export const langsmithEvaluators: EvaluatorT[] = [scenarioEvaluator, citationExistenceEvaluator, citationFieldEvaluator];
export function inputForCase(caseId: string): CaseInput { return { caseId }; }
