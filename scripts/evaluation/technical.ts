// Technical projections only. Questions, source content and draft prose never leave this target.
import type { EvaluationResult } from "langsmith/evaluation";
import { conTraza, sanitizarTraza } from "../../src/lib/motor/tracing";
import { developmentCases, resolveCase } from "./cases";
import { developmentTarget, exampleInput } from "./target";
import { contractChecks } from "./evaluators";

export function technicalExamples() {
  return developmentCases.filter(c => c.operation !== "manual").map(c => ({
    inputs: { case_id: c.id, fixture_hash: exampleInput(c).fixtureHash },
    outputs: { resultado: "ok" },
    metadata: { provenance: c.provenance, version: "evaluator-dev-v1" },
  }));
}
export async function technicalTarget(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const c = resolveCase({ caseId: String(input.case_id) });
  if (c.operation === "manual") throw new Error("Manual evidence cannot be scored automatically");
  const localInput = exampleInput(c);
  if (input.fixture_hash !== localInput.fixtureHash) throw new Error("Fixture hash mismatch");
  const output = await developmentTarget(localInput);
  const checks = await conTraza("validacion-evaluacion", { origen: "desarrollo", snapshot: output.fixtureHash }, async () => {
    const checks = contractChecks(output);
    return { checks, checks_total: checks.length, checks_passed: checks.filter(c => c.passed).length };
  });
  const result = output.result;
  const draft = (result.boletin ?? result.paquete ?? result.response ?? {}) as Record<string, unknown>;
  const claims = (draft.hechos ?? draft.brief ?? draft.afirmaciones ?? []) as { evidence_id?: string }[];
  const agenda = (result.topics ?? []) as { evento: { ids_noticia: string[] } }[];
  const evidence = (draft.evidencias ?? []) as { id: string }[];
  return sanitizarTraza({
    modo: draft.modo ?? "extractivo", abstener: draft.abstener ?? false,
    afirmaciones: agenda.length || claims.length || (result.operationPerformed ? 1 : 0),
    evidencias: new Set([...agenda.flatMap(t => t.evento.ids_noticia), ...claims.map(a => a.evidence_id).filter(Boolean), ...evidence.map(e => e.id), ...(result.operationPerformed ? [(result.citation as { id: string }).id] : [])]).size,
    checks_total: checks.checks_total, checks_passed: checks.checks_passed,
    citation_total: output.citations?.total ?? 0, citation_existing: output.citations?.existing ?? 0,
    citation_supported: output.citations?.supportedByFieldContract ?? 0,
    tests_passed: result.passed ?? 0, tests_failed: result.failed ?? 0,
    resultado: checks.checks_total > 0 && checks.checks_passed === checks.checks_total ? "ok" : "application_error",
  });
}
export function technicalFeedback(outputs: Record<string, unknown>): EvaluationResult[] {
  const total = Number(outputs.citation_total), existing = Number(outputs.citation_existing), supported = Number(outputs.citation_supported);
  if (![total, existing, supported].every(n => Number.isInteger(n) && n >= 0) || existing > total || supported > existing) throw new Error("Invalid citation counters");
  const checked = Number(outputs.checks_total), passed = Number(outputs.checks_passed);
  if (!Number.isInteger(checked) || checked <= 0 || !Number.isInteger(passed) || passed < 0 || passed > checked) throw new Error("Invalid contract counters");
  return [
    { key: "scenario_contract", score: outputs.resultado === "ok" && checked === passed },
    total ? { key: "citation_existence", score: existing / total } : { key: "citation_existence", value: "not_applicable" },
    total ? { key: "citation_field_constraints", score: supported / total } : { key: "citation_field_constraints", value: "not_applicable" },
  ];
}
