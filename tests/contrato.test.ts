import { describe, expect, test } from "bun:test";
import { idDe, normalizarUrl } from "../src/lib/motor/contrato";

describe("contrato", () => {
  test("idDe es estable y corto", () => {
    expect(idDe("n", "https://x")).toBe(idDe("n", "https://x"));
    expect(idDe("n", "https://x")).toHaveLength(14);
    expect(idDe("n", "https://x")).not.toBe(idDe("n", "https://y"));
  });
  test("normalizarUrl quita utm, fragmento, www y barra final", () => {
    expect(normalizarUrl("https://WWW.Tvn-2.com/nacionales/x/?utm_source=a&id=2#top")).toBe("https://tvn-2.com/nacionales/x?id=2");
    expect(normalizarUrl("https://tvn-2.com/a/")).toBe(normalizarUrl("https://tvn-2.com/a"));
  });
});
