import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { parsearRssTvn } from "../src/lib/ingesta/tvn";
import { dedup } from "../src/lib/ingesta/comun";
import { parsearGdelt, ventanas } from "../src/lib/ingesta/gdelt";
import { grilla } from "../src/lib/ingesta/bancomundial";

const F = "2026-10-06T15:00:00.000Z";

describe("ingesta", () => {
  test("RSS de TVN → noticias con fecha ISO, agencia y dedup por URL", () => {
    const ns = parsearRssTvn(readFileSync("tests/fixtures/tvn-mini.xml", "utf8"), "nacionales", F);
    expect(ns).toHaveLength(3);
    expect(ns[0].fecha_publicacion).toBe("2026-10-05T13:35:56.000Z");
    expect(ns[0].agencia).toBe("EFE");
    expect(ns[0].medio).toBe("TVN");
    expect(ns[2].fecha_publicacion).toBeNull(); // fecha inválida → nulo, no se descarta
    const { unicas, excluidas } = dedup(ns);
    expect(unicas).toHaveLength(2);
    expect(excluidas).toBe(1);
  });
  test("GDELT: seendate va a fecha_deteccion y la publicación queda nula", () => {
    const [n] = parsearGdelt([{ url: "https://prensa.com/x", title: "A  b", seendate: "20261001T233000Z", domain: "prensa.com", language: "Spanish", sourcecountry: "Panama" }], F);
    expect(n.fecha_deteccion).toBe("2026-10-01T23:30:00.000Z");
    expect(n.fecha_publicacion).toBeNull();
    expect(n.titulo).toBe("A b");
  });
  test("ventanas cubren 90 días en tramos de 15", () => {
    const v = ventanas(new Date("2026-10-06T00:00:00Z"));
    expect(v).toHaveLength(6);
    expect(v[5].desde.toISOString().slice(0, 10)).toBe("2026-07-08");
  });
  test("grilla del Banco Mundial conserva nulos (nunca 0)", () => {
    const g = grilla([{ countryiso3code: "PAN", date: "2024", value: 2.9, indicator: { id: "NY.GDP.MKTP.KD.ZG" } }], "NY.GDP.MKTP.KD.ZG", F);
    expect(g).toHaveLength(90);
    expect(g.find((x) => x.pais_iso3 === "PAN" && x.anio === 2024)?.valor).toBe(2.9);
    expect(g.find((x) => x.pais_iso3 === "PAN" && x.anio === 2023)?.valor).toBeNull();
    expect(g.some((x) => x.valor === 0)).toBe(false);
  });
});
