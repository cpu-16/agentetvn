// Prepared SDK-compatible interfaces only. Do not call evaluate() or create/upload a dataset here.
// langsmith 0.10.8's JavaScript evaluate() has no uploadResults:false option.
import type { EvaluatorT } from "langsmith/evaluation";
import { developmentCases } from "./cases";
import { developmentTarget, exampleInput } from "./target";
import { langsmithEvaluators } from "./evaluators";
export const langsmithTarget = developmentTarget;
export const evaluators: EvaluatorT[] = langsmithEvaluators;
export function developmentExamples() {
  return developmentCases.filter((c) => c.operation !== "manual").map((c) => ({
    inputs: exampleInput(c), outputs: c.expected,
    metadata: { scenario: c.id, provenance: c.provenance, alignment: c.alignment ?? "development contract" },
  }));
}
// Raw outputs are local interfaces only; the approved cloud runner uses technical.ts projections.
