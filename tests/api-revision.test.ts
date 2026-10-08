// Revisión humana: transiciones válidas, motivo obligatorio, persistencia.
import { beforeAll, describe, expect, test } from "bun:test";
import { validarTransicion } from "../src/lib/motor/revision";

describe("revisión", () => {
  test("transiciones del reto", () => {
    expect(validarTransicion("nuevo", "en_revision").ok).toBe(true);
    expect(validarTransicion("nuevo", "aprobado_borrador")).toMatchObject({ ok: false, status: 409 });
    expect(validarTransicion("en_revision", "descartado", "")).toMatchObject({ ok: false, status: 400 });
    expect(validarTransicion("en_revision", "descartado", "sin fuente primaria").ok).toBe(true);
    expect(validarTransicion("en_revision", "requiere_evidencia", "falta comunicado").ok).toBe(true);
    expect(validarTransicion("aprobado_borrador", "en_revision").ok).toBe(true);
    // el productor deja la pieza armada; solo se puede reabrir, y nunca se salta la aprobación
    expect(validarTransicion("aprobado_borrador", "pieza_lista").ok).toBe(true);
    expect(validarTransicion("pieza_lista", "en_revision").ok).toBe(true);
    expect(validarTransicion("en_revision", "pieza_lista")).toMatchObject({ ok: false, status: 409 });
    expect(validarTransicion("nuevo", "publicado" as never)).toMatchObject({ ok: false, status: 400 });
  });
});

describe("persistencia (SQLite real)", () => {
  let servicio: typeof import("../src/lib/motor/servicio");
  beforeAll(async () => {
    process.env.AGENTETVN_VERIFICAR_MANIFEST = "0";
    servicio = await import("../src/lib/motor/servicio");
  });
  test("una revisión guardada sobrevive a una nueva lectura; aprobar no publica", async () => {
    const { eventos } = await servicio.agenda();
    const id = eventos[eventos.length - 1].id;
    const persona = `prueba-${Date.now()}`;
    const r1 = await servicio.revisar(id, "en_revision", persona);
    expect(r1.ok).toBe(true);
    const r2 = await servicio.revisar(id, "aprobado_borrador", persona);
    expect(r2.ok && r2.nota).toContain("no publica");
    expect((await servicio.estadoDe(id)).estado).toBe("aprobado_borrador");
    const r3 = await servicio.revisar(id, "descartado", persona);
    expect(r3).toMatchObject({ ok: false, status: 409 });
    await servicio.revisar(id, "en_revision", persona); // reabrir para dejar el estado limpio
    await servicio.revisar(id, "descartado", persona, "limpieza de prueba");
  });
});
