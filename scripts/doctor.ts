// ─────────────────────────────────────────────────────────────
// doctor · ¿puede JIDOKA auditar en ESTA máquina, sin nube?
//   bun run doctor        (sale 1 si algo bloquea la auditoría)
// Pasa cuando NO hay claves de nube: el motor y el informe son
// deterministas; el LLM solo pule redacción y es opcional.
// ─────────────────────────────────────────────────────────────
import { existsSync } from "fs";
import { homedir } from "os";
import { isAbsolute, join, resolve } from "path";
import { leerFixtures } from "../src/lib/fixtures";

type Estado = "OK" | "FALLA" | "INFO";
const filas: { estado: Estado; nombre: string; detalle: string }[] = [];
const marca = { OK: "✔", FALLA: "✖", INFO: "ℹ" };
const reporta = (estado: Estado, nombre: string, detalle: string) => filas.push({ estado, nombre, detalle });

// 1 · Runtime
const major = Number(process.versions.node.split(".")[0]);
reporta(major >= 20 ? "OK" : "FALLA", "Runtime", `node ${process.versions.node}${process.versions.bun ? ` · bun ${process.versions.bun}` : ""} (mínimo node 20)`);

// 2 · DATABASE_URL apunta a un archivo alcanzable (bun carga .env solo)
const url = process.env.DATABASE_URL ?? "";
let rutaDb = "";
if (!url.startsWith("file:")) {
  reporta("FALLA", "DATABASE_URL", url ? `«${url}» no es SQLite (file:)` : "no definida: crea .env con DATABASE_URL=file:../db/custom.db (relativo a prisma/)");
} else {
  const cruda = url.slice(5);
  rutaDb = isAbsolute(cruda) ? cruda : resolve(process.cwd(), "prisma", cruda); // Prisma resuelve relativo a prisma/schema.prisma
  reporta(existsSync(rutaDb) ? "OK" : "FALLA", "DATABASE_URL", existsSync(rutaDb) ? rutaDb : `${rutaDb} no existe (¿ruta de otra máquina? corre: bun run db:push)`);
}

// 3 · Cliente Prisma + esquema COMPLETO: findFirst en cada modelo del schema selecciona todas
//     sus columnas, así que falla si falta cualquier tabla o columna que el motor necesite
//     (hallazgos, partidas, tarifario, siniestros, logs, revisiones…), no solo Taller/Factura.
try {
  const { db } = await import("../src/lib/db");
  const { Prisma } = await import("@prisma/client");
  const modelos = Prisma.dmmf.datamodel.models.map((m) => m.name);
  const faltan: string[] = [];
  for (const nombre of modelos) {
    const delegado = db[(nombre[0].toLowerCase() + nombre.slice(1)) as keyof typeof db] as { findFirst(): Promise<unknown> };
    await delegado.findFirst().catch((e: Error) => faltan.push(e.message.match(/(table|column) `main\.([^`]+)` does not exist/)?.[2] ?? `${nombre}: ${e.message.split("\n").at(-1)}`));
  }
  if (faltan.length) reporta("FALLA", "Base de datos", `esquema incompleto, falta ${faltan.join(", ")} → bun run db:push`);
  else {
    const [talleres, facturas, cfg] = await Promise.all([db.taller.count(), db.factura.count(), db.configuracion.findUnique({ where: { id: "GLOBAL" } })]);
    reporta("OK", "Base de datos", `${modelos.length} tablas con sus columnas · ${talleres} talleres · ${facturas} facturas · configuración ${cfg ? "GLOBAL presente" : "GLOBAL ausente (se crea al sembrar)"}`);
  }
  await db.$disconnect();
} catch (e) {
  reporta("FALLA", "Base de datos", `${(e as Error).message.split("\n")[0].slice(0, 160)} → bun run db:generate && bun run db:push`);
}

// 4 · Modo IA: el sistema debe funcionar SIN claves de nube
const configsZai = ["./.z-ai-config", join(homedir(), ".z-ai-config"), "/etc/.z-ai-config"].filter(existsSync);
const clavesEnEntorno = Object.keys(process.env).filter((k) => /^(ZAI|Z_AI|OPENAI|ANTHROPIC|GEMINI|GROQ)_?.*KEY/i.test(k));
if (process.env.JIDOKA_DISABLE_IA === "1") reporta("OK", "Modo IA", "JIDOKA_DISABLE_IA=1 · informe determinista (sin nube)");
else if (configsZai.length || clavesEnEntorno.length) reporta("INFO", "Modo IA", `claves presentes (${[...configsZai, ...clavesEnEntorno].join(", ")}) · el LLM solo redacta; si falla, cae al informe determinista`);
else reporta("OK", "Modo IA", "sin claves de nube · informe determinista completo (el motor no depende de ningún proveedor)");

// 5 · Fixtures con resultado esperado
try {
  const fx = leerFixtures();
  const invalidos = fx.filter((f) => !f.esperado?.factura || !f.facturas.some((x) => x.numero === f.esperado.factura));
  const reglas = new Set(fx.flatMap((f) => (f.esperado?.hallazgos ?? []).map((h) => h.regla)));
  reporta(invalidos.length ? "FALLA" : "OK", "Fixtures", invalidos.length ? `esperado.factura no coincide en ${invalidos.map((f) => f.id).join(", ")}` : `${fx.length} expedientes · reglas cubiertas: ${[...reglas].sort().join(", ")} · verifícalos con: bun test`);
} catch (e) {
  reporta("FALLA", "Fixtures", (e as Error).message);
}

// 6 · Servidor (no bloquea)
try {
  const r = await fetch("http://localhost:3000/api/dashboard", { signal: AbortSignal.timeout(2000) });
  reporta(r.ok ? "OK" : "INFO", "Servidor", r.ok ? "http://localhost:3000 responde /api/dashboard" : `HTTP ${r.status} en /api/dashboard`);
} catch {
  reporta("INFO", "Servidor", "no hay servidor en :3000 (bun run dev) · no bloquea la auditoría");
}

for (const f of filas) console.log(`${marca[f.estado]} ${f.nombre.padEnd(14)} ${f.detalle}`);
const fallas = filas.filter((f) => f.estado === "FALLA").length;
console.log(fallas ? `\n${fallas} problema(s): JIDOKA no puede auditar así.` : "\nJIDOKA puede auditar en esta máquina sin depender de la nube.");
process.exit(fallas ? 1 : 0);
