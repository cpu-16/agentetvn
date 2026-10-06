// T02 · Tres registros del mismo evento: agrupar sin perder fuentes; no triplicar importancia ni corroboración (CU-03).
import { describe, expect, test } from "bun:test";
import { agruparEventos, procedenciasDe } from "../src/lib/motor/eventos";
import { n } from "./fixtures/noticias";

describe("T02 mismo evento y procedencias", () => {
  const tres = [
    n({ id_noticia: "a", titulo: "Canal de Panamá reporta tránsito récord en septiembre", url: "https://m1.com/a", medio: "m1.com", agencia: "EFE" }),
    n({ id_noticia: "b", titulo: "Canal de Panamá reporta tránsito récord en septiembre", url: "https://m2.com/b", medio: "m2.com", agencia: "EFE" }),
    n({ id_noticia: "c", titulo: "Canal de Panamá reporta tránsito récord en septiembre (EFE)", url: "https://m3.com/c", medio: "m3.com", agencia: "EFE" }),
  ];
  test("3 publicaciones → 1 evento con 3 fuentes y 1 procedencia (agencia)", () => {
    const ev = agruparEventos(tres, new Map());
    expect(ev).toHaveLength(1);
    expect(ev[0].ids_noticia).toHaveLength(3);
    expect(ev[0].procedencias).toHaveLength(1);
    expect(ev[0].procedencias[0].id).toBe("agencia:EFE");
  });
  test("titular copiado sin atribución → independencia no verificada; redacción propia → medio aparte", () => {
    const ns = [
      n({ id_noticia: "a", titulo: "Sismo de 4.5 sacude Chiriquí esta madrugada", medio: "m1.com" }),
      n({ id_noticia: "b", titulo: "Sismo de 4.5 sacude Chiriquí esta madrugada", medio: "m2.com" }),
      n({ id_noticia: "c", titulo: "Temblor en Chiriquí: Sinaproc descarta daños tras sismo de 4.5", medio: "m3.com" }),
      n({ id_noticia: "d", titulo: "Sismo en Chiriquí", medio: "TVN", origen: "tvn_rss" }),
    ];
    const p = procedenciasDe(["a", "b", "c", "d"], new Map(ns.map((x) => [x.id_noticia, x])));
    const ids = p.map((x) => x.id).sort();
    expect(ids).toEqual(["medio:TVN", "medio:m3.com", "no_verificada"]);
    expect(p.find((x) => x.id === "no_verificada")?.ids_noticia).toEqual(["a", "b"]);
  });
  test("una copia idéntica de TVN sin atribución no suma procedencia ni evidencia (CU-03)", () => {
    const efe = n({ id_noticia: "e", titulo: "Panamá y Singapur firman seis acuerdos de cooperación marítima", url: "https://m1.com/e", medio: "m1.com", agencia: "EFE" });
    const tvn = n({ id_noticia: "t", titulo: "Panamá y Singapur firman seis acuerdos de cooperación marítima", url: "https://tvn-2.com/t", medio: "TVN", origen: "tvn_rss" });
    const p = procedenciasDe(["e", "t"], new Map([[efe.id_noticia, efe], [tvn.id_noticia, tvn]]));
    expect(p.filter((x) => x.tipo !== "no_verificada")).toHaveLength(1);
    expect(p.find((x) => x.tipo === "no_verificada")?.ids_noticia).toEqual(["t"]);
  });
  test("eventos distintos no se mezclan", () => {
    const ev = agruparEventos([tres[0], n({ id_noticia: "z", titulo: "Inflación de Panamá cierra septiembre en 1,1 %", url: "https://m9.com/z" })], new Map());
    expect(ev).toHaveLength(2);
  });
});
