// T04 · Cifra anual del Banco Mundial: mantener país, año y unidad; citar el dato, no describirlo como cifra de hoy.
import { describe, expect, test } from "bun:test";
import { ultimoConValor, vincularContexto } from "../src/lib/motor/contexto";
import type { Indicador } from "../src/lib/motor/contrato";

const ind = (anio: number, valor: number | null): Indicador => ({ pais_iso3: "PAN", indicador_id: "FP.CPI.TOTL.ZG", anio, valor, unidad: "% anual", fuente_url: "https://api.worldbank.org/...", fecha_extraccion: "2026-10-06T00:00:00Z", licencia: "CC BY 4.0" });

describe("T04 cifra anual", () => {
  test("liga la inflación al último año con valor, no al nulo más reciente", () => {
    const serie = [ind(2022, 2.9), ind(2023, 1.5), ind(2024, null)];
    expect(ultimoConValor(serie, "PAN", "FP.CPI.TOTL.ZG")?.anio).toBe(2023);
    const c = vincularContexto("La inflación en Panamá preocupa a comerciantes", "economia", "2026-10-05T00:00:00Z", serie, []);
    expect(c.indicadores).toEqual(["PAN:FP.CPI.TOTL.ZG:2023"]);
  });
  test("no fuerza relación: tema distinto o concepto ausente → sin contexto", () => {
    const serie = [ind(2023, 1.5)];
    expect(vincularContexto("Inflación", "deportes", null, serie, []).indicadores).toEqual([]);
    expect(vincularContexto("Canal registra récord", "economia", null, serie, []).indicadores).toEqual([]);
  });
});
