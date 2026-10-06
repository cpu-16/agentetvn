// Contradicciones (T05) y estado de evidencia (independiente del puntaje).
import type { Contradiccion, EstadoEvidencia, Noticia, Procedencia } from "./contrato";
import { leerScoring } from "./config";

const CIFRA = /(\d+(?:[.,]\d+)?)\s*(%|por ciento|millones|mil|muertos|fallecidos|heridos|personas|casos|buques|días|horas|dólares|balboas|kil[oó]metros|km)/gi;

export function cifrasDe(texto: string): { valor: number; unidad: string }[] {
  const out: { valor: number; unidad: string }[] = [];
  for (const m of texto.matchAll(CIFRA)) out.push({ valor: Number(m[1].replace(",", ".")), unidad: m[2].toLowerCase().replace("por ciento", "%").replace("fallecidos", "muertos").replace("kilómetros", "km").replace("kilometros", "km") });
  return out;
}

/** Dos publicaciones del mismo evento con cifras distintas para la misma unidad → contradicción visible; no se resuelve sola. */
export function detectarContradicciones(publicaciones: Noticia[]): Contradiccion[] {
  const out: Contradiccion[] = [];
  const cifras = publicaciones.map((n) => ({ n, c: cifrasDe(`${n.titulo} ${n.descripcion}`) }));
  for (let i = 0; i < cifras.length; i++)
    for (let j = i + 1; j < cifras.length; j++)
      for (const a of cifras[i].c)
        for (const b of cifras[j].c)
          if (a.unidad === b.unidad && a.valor !== b.valor)
            out.push({ a: cifras[i].n.id_noticia, b: cifras[j].n.id_noticia, campo: "titulo", detalle: `«${a.valor} ${a.unidad}» (${cifras[i].n.medio}) vs «${b.valor} ${b.unidad}» (${cifras[j].n.medio})` });
  return out;
}

export function estadoEvidencia(E: number, procedencias: Procedencia[], hayPrimaria: boolean, contradicciones: Contradiccion[], hayDescripcion: boolean, cfg = leerScoring().E): EstadoEvidencia {
  const M = procedencias.filter((p) => p.tipo !== "no_verificada").length;
  if (E < cfg.umbral_insuficiente || (M < 2 && !hayPrimaria)) return "insuficiente";
  if (contradicciones.length || !hayPrimaria) return "parcial";
  return hayDescripcion || hayPrimaria ? "suficiente" : "parcial";
}
