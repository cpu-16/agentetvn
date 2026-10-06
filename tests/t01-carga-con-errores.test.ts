// T01 · Archivo con fechas inválidas y nulos: validar, separar errores y conservar nulos; no bloquear toda la carga.
import { describe, expect, test } from "bun:test";
import { validarIndicadores, validarNoticias } from "../src/lib/motor/validar";

describe("T01 carga con errores", () => {
  test("noticias: fecha inválida → nula, duplicado → excluido, sin url → excluido; el resto carga", () => {
    const { validas, errores } = validarNoticias([
      { id_noticia: "n1", titulo: "Buena", url: "https://a.com/1", fecha_publicacion: "2026-10-05T10:00:00Z", origen: "tvn_rss" },
      { id_noticia: "n2", titulo: "Fecha mala", url: "https://a.com/2", fecha_publicacion: "31/02/2026", origen: "gdelt" },
      { id_noticia: "n3", titulo: "Sin fecha", url: "https://a.com/3", fecha_publicacion: "", origen: "gdelt" },
      { id_noticia: "n1", titulo: "Duplicada", url: "https://a.com/4", origen: "gdelt" },
      { id_noticia: "n5", titulo: "Sin url", url: "", origen: "gdelt" },
    ]);
    expect(validas.map((n) => n.id_noticia)).toEqual(["n1", "n2", "n3"]);
    expect(validas[1].fecha_publicacion).toBeNull();
    expect(validas[2].fecha_publicacion).toBeNull();
    expect(errores).toHaveLength(3);
    expect(errores.map((e) => e.campo)).toEqual(["fecha_publicacion", "id_noticia", "url"]);
  });
  test("indicadores: valor vacío se conserva como nulo, nunca 0", () => {
    const { validas, errores } = validarIndicadores([
      { pais_iso3: "PAN", indicador_id: "X", anio: "2024", valor: "" },
      { pais_iso3: "PAN", indicador_id: "X", anio: "2023", valor: "abc" },
      { pais_iso3: "PAN", indicador_id: "X", anio: "2022", valor: "1.5" },
      { pais_iso3: "", indicador_id: "X", anio: "2021", valor: "2" },
    ]);
    expect(validas).toHaveLength(3);
    expect(validas[0].valor).toBeNull();
    expect(validas[1].valor).toBeNull();
    expect(validas[2].valor).toBe(1.5);
    expect(validas.some((v) => v.valor === 0)).toBe(false);
    expect(errores).toHaveLength(2);
  });
});
