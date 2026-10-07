import { describe, expect, test } from "bun:test";
import { developmentTarget } from "../scripts/evaluation/target";
import { contractChecks, langsmithEvaluators } from "../scripts/evaluation/evaluators";
import { developmentExamples } from "../scripts/evaluation/langsmith";

describe("development evaluation contracts", () => {
  test("existing citation IDs do not imply support for another source's number", async () => {
    const output = await developmentTarget({ caseId: "JURY-CITATION-SUPPORT" });
    expect(output.citations?.existenceScore).toBe(1);
    expect(output.citations?.fieldContractScore).toBeLessThan(1);
    expect(output.result.valid).toBe(false);
    expect(contractChecks(output).every((c) => c.passed)).toBe(true);
  });
  test("this figure requires selected source context and rejects a different fixture hash", async () => {
    const missing = await developmentTarget({ caseId: "JURY-FIGURE-NO-CONTEXT" });
    expect(missing.result).toMatchObject({ contextRequired: true, operationPerformed: false });
    const selected = await developmentTarget({ caseId: "JURY-FIGURE", context: { indicatorId: "PAN:FP.CPI.TOTL.ZG:2023" } });
    expect(selected.result).toMatchObject({ country: "PAN", year: 2023, value: 1.5, unit: "% anual", historical: true });
    expect(contractChecks(selected).every((c) => c.passed)).toBe(true);
    await expect(developmentTarget({ caseId: "JURY-FIGURE", fixtureHash: "changed" })).rejects.toThrow("Fixture hash mismatch");
  });
  test("manual failure/correction and human labels remain unscored and excluded from runnable SDK examples", async () => {
    const pending = await developmentTarget({ caseId: "JURY-NOTION-FAILURE-CORRECTION" });
    expect(pending.status).toBe("manual_pending");
    expect(contractChecks(pending)).toHaveLength(0);
    const examples = developmentExamples();
    expect(examples.every((e) => !["JURY-NOTION-FAILURE-CORRECTION", "HUMAN-SEMANTIC-ACCEPTANCE"].includes(String(e.inputs.caseId)))).toBe(true);
    expect(examples.every((e) => /^[a-f0-9]{64}$/.test(String(e.inputs.fixtureHash)))).toBe(true);
    expect(langsmithEvaluators).toHaveLength(3);
  });
});
