// Synthetic agency-replication fixture shared with T02.
import { n } from "./noticias";

export function replicasEFE(count = 3) {
  if (![1, 3, 5].includes(count)) throw new Error("Only development replica counts are allowed");
  const tres = [
    n({ id_noticia: "a", titulo: "Canal de Panamá reporta tránsito récord en septiembre", url: "https://m1.com/a", medio: "m1.com", agencia: "EFE" }),
    n({ id_noticia: "b", titulo: "Canal de Panamá reporta tránsito récord en septiembre", url: "https://m2.com/b", medio: "m2.com", agencia: "EFE" }),
    n({ id_noticia: "c", titulo: "Canal de Panamá reporta tránsito récord en septiembre (EFE)", url: "https://m3.com/c", medio: "m3.com", agencia: "EFE" }),
  ];
  if (count === 5) for (const id of ["d", "e"]) tres.push(n({ ...tres[0], id_noticia: id, medio: "medio-" + id + ".test", url: "https://medio-" + id + ".test/replica" }));
  return tres.slice(0, count);
}
