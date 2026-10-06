// Contradicciones (T05) y estado de evidencia (independiente del puntaje).
import type { Contradiccion, EstadoEvidencia, Noticia, Procedencia } from "./contrato";
import { leerScoring } from "./config";

const CIFRA = /(\d+(?:[.,]\d+)?)\s*(%|por ciento|millones|mil|muertos|fallecidos|heridos|personas|casos|buques|días|horas|dólares|balboas|kil[oó]metros|km)/gi;

export function cifrasDe(texto: string, campo = "titulo"): { valor: number; unidad: string; campo: string }[] {
  const out: { valor: number; unidad: string; campo: string }[] = [];
  for (const m of texto.matchAll(CIFRA)) out.push({ valor: Number(m[1].replace(",", ".")), unidad: m[2].toLowerCase().replace("por ciento", "%").replace("fallecidos", "muertos").replace("kilómetros", "km").replace("kilometros", "km"), campo });
  return out;
}

/** Dos publicaciones del mismo evento con cifras distintas para la misma unidad → contradicción visible; no se resuelve sola. */
export function detectarContradicciones(publicaciones: Noticia[]): Contradiccion[] {
  const out: Contradiccion[] = [];
  const cifras = publicaciones.map((n) => ({ n, c: [...cifrasDe(n.titulo, "titulo"), ...cifrasDe(n.descripcion, "descripcion")] }));
  for (let i = 0; i < cifras.length; i++)
    for (let j = i + 1; j < cifras.length; j++) {
      // copias idénticas no se contradicen entre sí (sus cifras internas distintas describen hechos distintos)
      if (`${cifras[i].n.titulo} ${cifras[i].n.descripcion}`.trim() === `${cifras[j].n.titulo} ${cifras[j].n.descripcion}`.trim()) continue;
      for (const a of cifras[i].c)
        for (const b of cifras[j].c) {
          if (a.unidad !== b.unidad || a.valor === b.valor) continue;
          // si ambas publicaciones también comparten esa misma cifra, no es contradicción sino dos datos distintos
          const comparte = cifras[j].c.some((x) => x.unidad === a.unidad && x.valor === a.valor) || cifras[i].c.some((x) => x.unidad === b.unidad && x.valor === b.valor);
          if (comparte) continue;
          out.push({ a: cifras[i].n.id_noticia, b: cifras[j].n.id_noticia, campo: a.campo === b.campo ? a.campo : `${a.campo}/${b.campo}`, detalle: `«${a.valor} ${a.unidad}» (${cifras[i].n.medio}, ${a.campo}) vs «${b.valor} ${b.unidad}» (${cifras[j].n.medio}, ${b.campo})` });
        }
    }
  return out;
}

export function estadoEvidencia(E: number, procedencias: Procedencia[], hayPrimaria: boolean, contradicciones: Contradiccion[], hayDescripcion: boolean, cfg = leerScoring().E): EstadoEvidencia {
  const M = procedencias.filter((p) => p.tipo !== "no_verificada").length;
  if (E < cfg.umbral_insuficiente || (M < 2 && !hayPrimaria)) return "insuficiente";
  if (contradicciones.length || !hayPrimaria) return "parcial";
  return hayDescripcion || hayPrimaria ? "suficiente" : "parcial";
}
