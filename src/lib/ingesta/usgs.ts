import { fetchJson } from "./comun";
import type { Sismo } from "../motor/contrato";

export const URL_USGS =
  "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2024-01-01&endtime=2025-01-01&minlatitude=5&maxlatitude=12&minlongitude=-86&maxlongitude=-76&minmagnitude=3&orderby=time";

type Feature = { id: string; properties: { mag: number; time: number; updated: number; place: string; status: string; url: string }; geometry: { coordinates: [number, number, number] } };

export function parsearUsgs(geo: { features: Feature[] }): Sismo[] {
  return geo.features.map((f) => ({
    id: f.id,
    magnitude: f.properties.mag,
    time: new Date(f.properties.time).toISOString(),
    updated: new Date(f.properties.updated).toISOString(),
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
    depth: f.geometry.coordinates[2],
    place: f.properties.place,
    status: f.properties.status,
    url: f.properties.url,
  }));
}

export async function ingestarUsgs(fechaExtraccion: string, log: (s: string) => void) {
  const geo = await fetchJson<{ features: Feature[] }>(URL_USGS);
  const sismos = parsearUsgs(geo);
  log(`USGS · ${sismos.length} eventos`);
  return { geojson: geo, sismos, consultas: [{ fuente: "usgs", consulta: URL_USGS, fecha: fechaExtraccion, n: sismos.length }] };
}
