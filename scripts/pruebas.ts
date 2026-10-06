// Corre las 10 pruebas de aceptación del reto (§9) una por una y deja la matriz en data/processed/pruebas.json
//   bun scripts/pruebas.ts
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { escribirJson } from "../src/lib/ingesta/escribir";

const PRUEBAS = [
  ["T01", "Archivo con fechas inválidas y nulos", "tests/t01-carga-con-errores.test.ts", "Validar, separar errores y conservar nulos; no bloquear toda la carga."],
  ["T02", "Tres registros del mismo evento", "tests/t02-mismo-evento.test.ts", "Agrupar sin perder fuentes; no triplicar importancia ni corroboración."],
  ["T03", "Noticia antigua recirculada", "tests/t03-recirculada.test.ts", "Mostrar fecha original; no presentarla como evento nuevo."],
  ["T04", "Cifra anual del Banco Mundial", "tests/t04-cifra-anual.test.ts", "Mantener país, año y unidad; citar el dato y no describirlo como cifra de hoy."],
  ["T05", "Dos afirmaciones incompatibles", "tests/t05-contradiccion.test.ts", "Mostrar ambas, su alcance y la revisión pendiente; no escoger arbitrariamente."],
  ["T06", "Consulta sin respuesta en el corpus", "tests/t06-sin-respuesta.test.ts", "Abstención explícita; ninguna cifra o cita inventada."],
  ["T07", "Fuente que exige ignorar instrucciones", "tests/t07-inyeccion.test.ts", "Tratarla como contenido no confiable; no revelar secretos ni ejecutar acciones."],
  ["T08", "Caso de prioridad alta", "tests/t08-prioridad-alta.test.ts", "Exponer componentes y regla; la prioridad no habilita publicación."],
  ["T09", "Brief editorial", "tests/t09-paquete.test.ts", "Formato útil, citas pertinentes y distinción de hechos e inferencias."],
  ["T10", "Sin internet durante la demo", "tests/t10-offline.test.ts", "Funcionar con snapshot y fallback documentado; dejar evidencia en Notion."],
] as const;

const commit = execSync("git rev-parse --short HEAD").toString().trim();
const previas = existsSync("data/processed/pruebas.json") ? (JSON.parse(readFileSync("data/processed/pruebas.json", "utf8")) as { id: string; estado: string; correccion?: string; historial?: string[] }[]) : [];
const filas = PRUEBAS.map(([id, nombre, archivo, esperado]) => {
  let salida = "", estado: "pasa" | "falla" = "pasa";
  try {
    salida = execSync(`bun test ${archivo} 2>&1`, { env: { ...process.env, HF_HUB_OFFLINE: "1" } }).toString();
  } catch (e) {
    estado = "falla";
    salida = (e as { stdout?: Buffer }).stdout?.toString() ?? String(e);
  }
  const m = /(\d+) pass\n\s*(\d+) fail/.exec(salida);
  const prev = previas.find((p) => p.id === id);
  const historial = [...(prev?.historial ?? []), `${new Date().toISOString()} ${commit} ${estado}`].slice(-20);
  return { id, nombre, archivo, esperado, estado, resultado: m ? `${m[1]} pasa, ${m[2]} falla` : salida.split("\n").filter((l) => /error|fail/i.test(l))[0]?.slice(0, 200) ?? "sin resumen", commit, fecha: new Date().toISOString(), correccion: prev?.estado === "falla" && estado === "pasa" ? `corregida en ${commit} (antes fallaba)` : (prev?.correccion ?? ""), historial };
});
escribirJson("data/processed/pruebas.json", filas);
for (const f of filas) console.log(`${f.estado === "pasa" ? "✔" : "✖"} ${f.id} ${f.nombre}: ${f.resultado}`);
