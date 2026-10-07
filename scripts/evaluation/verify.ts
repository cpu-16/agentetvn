// Independent persisted-run checks. No SDK tracing context or counters are trusted as root counts.
import { resolveCase } from "./cases";
import { payloadTecnicoPersistido } from "../../src/lib/motor/tracing";
export interface VerifiedSpan {
 id: string; name: string; parent_run_id?: string | null; trace_id?: string; session_id?: string;
 reference_example_id?: string | null; end_time?: string | number | null; error?: string | null;
 inputs?: Record<string, unknown> | null; outputs?: Record<string, unknown> | null;
 extra?: { metadata?: Record<string, unknown> } & Record<string, unknown> | null;
}
export interface ExpectedRoot { id: string; exampleId: string; caseId: string; }
export function expectedStages(caseId: string) {
 const c = resolveCase({ caseId });
 const specific: Record<string, string[]> = {
  agenda: ["agenda"], "agenda-public": ["agenda"],
  banking: ["boletin-bancario", "validacion-paquete", "validacion-evidencia"],
  "unsupported-claim": ["boletin-bancario", "validacion-paquete", "validacion-evidencia"],
  editorial: ["paquete", "validacion-evidencia"],
  figure: c.expected.contextRequired ? [] : ["indicador", "validacion-evidencia"],
  replicas: ["agrupacion", "agrupacion"],
  abstention: ["consulta", "validacion-evidencia"], injection: ["consulta", "recuperacion", "validacion-evidencia"],
  lexical: ["consulta", "recuperacion", "validacion-evidencia"], "existing-test": ["pruebas-desarrollo"],
 };
 if (!specific[c.operation]) throw new Error("No automatic stage contract for this case");
 return ["enrutamiento-desarrollo", ...specific[c.operation], "validacion-evaluacion"].sort();
}
export function verifyHierarchy(runs: VerifiedSpan[], expected: ExpectedRoot[], projectId: string) {
 const ids = new Map(runs.map(r => [r.id, r]));
 const roots = runs.filter(r => !r.parent_run_id), children = runs.filter(r => !!r.parent_run_id);
 const violations: string[] = [];
 if (ids.size !== runs.length) violations.push("duplicate_run_ids");
 if (roots.length !== expected.length) violations.push("root_count_mismatch");
 for (const r of runs) {
  if (r.session_id !== projectId) violations.push("wrong_project");
  if (!r.end_time || r.error) violations.push("incomplete_or_error");
  const expectedRoot = !r.parent_run_id ? expected.find(e => e.id === r.id) : undefined;
  const provenance = expectedRoot ? resolveCase({ caseId: expectedRoot.caseId }).provenance : undefined;
  if (!payloadTecnicoPersistido(r, provenance === "manual_pending" ? undefined : provenance)) violations.push("nontechnical_payload");
  if (r.parent_run_id && (!ids.has(r.parent_run_id) || !expected.some(e => e.id === r.trace_id))) violations.push("broken_parentage");
 }
 for (const e of expected) {
  const root = ids.get(e.id);
  if (!root || root.parent_run_id || root.trace_id !== root.id || root.reference_example_id !== e.exampleId || root.name !== "evaluacion-desarrollo") violations.push("root_identity_mismatch");
  const stages = children.filter(r => r.trace_id === e.id).map(r => r.name).sort();
  if (JSON.stringify(stages) !== JSON.stringify(expectedStages(e.caseId))) violations.push("executed_stage_mismatch");
 }
 if (roots.some(r => !expected.some(e => e.id === r.id))) violations.push("unexpected_root");
 return { verified: violations.length === 0, roots: roots.length, children: children.length, spans: runs.length, violations: [...new Set(violations)] };
}
