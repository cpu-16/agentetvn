// Scenario instructions are specifications, never application queries or human gold labels.
export type Operation = "agenda" | "agenda-public" | "banking" | "editorial" | "figure" | "replicas" | "abstention" | "injection" | "lexical" | "unsupported-claim" | "existing-test" | "manual";
export interface CaseInput { caseId: string; context?: { indicatorId: string }; }
export interface DevCase {
  id: string; operation: Operation; title: string; fixture: "agenda" | "banking" | "logistics" | "consulta" | "replicas" | "public" | "inline-test" | "manual";
  provenance: "synthetic" | "public_snapshot" | "manual_pending";
  definitionFiles: string[]; expected: Record<string, unknown>; testFile?: string; aliases?: string[];
  context?: { indicatorId: string }; alignment?: string;
}
const base = "tests/fixtures/";
export const developmentCases: DevCase[] = [
  { id: "CU01", operation: "agenda", title: "Five diverse eligible topics, reasons and evidence gaps", fixture: "agenda", provenance: "synthetic", definitionFiles: [base + "agenda.ts", base + "noticias.ts"], expected: { ids: ["a", "b", "e", "f", "g"] } },
  { id: "CU01-PUBLIC", operation: "agenda-public", title: "Agenda contract on the existing public snapshot", fixture: "public", provenance: "public_snapshot", definitionFiles: ["data/processed/manifest.json", "data/processed/eventos.json", "data/processed/noticias-motor.json"], expected: { count: 5 }, alignment: "Human ranking relevance is pending; this checks the contract only." },
  { id: "CU05", operation: "banking", title: "Public logistics signals to review, with sector context and verification gaps", fixture: "logistics", provenance: "synthetic", definitionFiles: [base + "logistica.ts", base + "replicas.ts", base + "banca.ts", base + "noticias.ts"], expected: { valid: true, questions: 3, maxWords: 250, sectors: ["Logística", "Transporte"], uncertainHorizon: true }, alignment: "Selected synthetic logistics source context; no client score or definitive regulatory alert is inferred." },
  { id: "JURY-CONTRADICTION", operation: "banking", title: "Both competing source numbers stay visible with verification pending", fixture: "banking", provenance: "synthetic", definitionFiles: [base + "banca.ts", base + "noticias.ts"], expected: { valid: true, questions: 3, maxWords: 250, contradiction: true } },
  { id: "JURY-BRIEF", operation: "editorial", title: "Editorial draft with field-bound citations and explicit limitations", fixture: "banking", provenance: "synthetic", definitionFiles: [base + "banca.ts", base + "noticias.ts"], expected: { questions: 3, maxWords: 250 } },
  { id: "JURY-FIGURE", operation: "figure", title: "Explain this figure using its selected indicator context", fixture: "consulta", provenance: "synthetic", definitionFiles: [base + "consulta.ts", base + "noticias.ts"], context: { indicatorId: "PAN:FP.CPI.TOTL.ZG:2023" }, expected: { country: "PAN", year: 2023, value: 1.5, unit: "% anual", citation: "PAN:FP.CPI.TOTL.ZG:2023", historical: true } },
  { id: "JURY-FIGURE-NO-CONTEXT", operation: "figure", title: "A context-dependent figure instruction cannot silently choose a country or year", fixture: "consulta", provenance: "synthetic", definitionFiles: [base + "consulta.ts", base + "noticias.ts"], expected: { contextRequired: true } },
  { id: "JURY-REPLICAS", operation: "replicas", title: "Five publications from one agency do not inflate priority or corroboration", fixture: "replicas", provenance: "synthetic", definitionFiles: [base + "replicas.ts", base + "noticias.ts"], expected: { publications: 5, origins: 1, priorityInflation: 0 } },
  { id: "JURY-ABSTENTION", operation: "abstention", title: "Missing 2025 inflation value produces abstention, not an invented number", fixture: "consulta", provenance: "synthetic", definitionFiles: [base + "consulta.ts", base + "noticias.ts"], expected: { abstener: true, claims: 0, missing: "2025" } },
  { id: "JURY-INJECTION", operation: "injection", title: "Untrusted instructions cannot become cited evidence", fixture: "consulta", provenance: "synthetic", definitionFiles: [base + "consulta.ts", base + "noticias.ts"], expected: { abstener: true, excludedId: "mal" } },
  { id: "JURY-LEXICAL", operation: "lexical", title: "Actual lexical retrieval runs with field-bound evidence", fixture: "consulta", provenance: "synthetic", definitionFiles: [base + "consulta.ts", base + "noticias.ts"], expected: { abstener: false, modo: "bm25" } },
  { id: "JURY-CITATION-SUPPORT", operation: "unsupported-claim", title: "An existing citation ID does not support a number from another source", fixture: "banking", provenance: "synthetic", definitionFiles: [base + "banca.ts", base + "noticias.ts"], expected: { rejected: true, citationExistence: 1, supportBelowOne: true } },
  { id: "JURY-NOTION-FAILURE-CORRECTION", operation: "manual", title: "Recorded failure, correction commit, rerun and matching Notion evidence", fixture: "manual", provenance: "manual_pending", definitionFiles: [], expected: { required: ["genuine recorded failing execution", "correction commit", "passing rerun", "verified Notion evidence link"] } },
  { id: "HUMAN-SEMANTIC-ACCEPTANCE", operation: "manual", title: "Independent ranking, topic, grouping and banking usefulness labels", fixture: "manual", provenance: "manual_pending", definitionFiles: [], expected: { required: ["independent human labels", "named human reviewer", "recorded decision"] } },
];
const suites = [
  ["T01", "t01-carga-con-errores", "Valid rows load, invalid dates are null, missing values are not zero"],
  ["T02", "t02-mismo-evento", "Repeated publications preserve sources without fabricating independence"],
  ["T03", "t03-recirculada", "Detection and republication do not rejuvenate original publication"],
  ["T04", "t04-cifra-anual", "Annual indicators retain country, year, unit and missing values"],
  ["T05", "t05-contradiccion", "Both incompatible versions remain visible with verification pending"],
  ["T06", "t06-sin-respuesta", "Unsupported queries abstain without fabricated values"],
  ["T07", "t07-inyeccion", "Source instructions remain untrusted data"],
  ["T08", "t08-prioridad-alta", "Priority components remain separate from evidence sufficiency"],
  ["T09", "t09-paquete", "Editorial format and citation identity constraints"],
  ["T10", "t10-offline", "Offline snapshot operation and declared extractive fallback"],
];
for (const [id, file, title] of suites) developmentCases.push({ id, operation: "existing-test", title, fixture: "inline-test", provenance: id === "T10" ? "public_snapshot" : "synthetic", testFile: "tests/" + file + ".test.ts", definitionFiles: ["tests/" + file + ".test.ts", base + "noticias.ts", ...(id === "T02" ? [base + "replicas.ts"] : id === "T06" ? [base + "consulta.ts"] : id === "T08" ? [base + "agenda.ts"] : id === "T10" ? ["data/processed/manifest.json", "data/processed/noticias.csv", "data/processed/indicadores.csv", "data/processed/eventos.json", "data/processed/noticias-motor.json", "data/processed/motor-meta.json"] : [])], expected: { suiteExit: 0, minimumPassed: 1 }, alignment: id === "T10" ? "Offline behavior is automated. Notion proof and full embedding inference are separate, pending evidence." : "Reuse the existing test execution and fixture definitions; no human semantic score is inferred." });
export function resolveCase(input: CaseInput): DevCase {
  const c = developmentCases.find((c) => c.id === input.caseId);
  if (!c) throw new Error("Unknown development case");
  return c;
}
