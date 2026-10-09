// Explicaciones conversadas: el validador deja pasar una reformulación y frena lo que no estaba en el texto fijo.
import { expect, test } from "bun:test";
import { fielAlTexto } from "../src/lib/motor/explicar";

const FIJO = "AgenteTVN es la mesa editorial asistida de TVN Media: junta las noticias del día, con TVN primero, y los datos oficiales, las ordena por importancia y prepara borradores con citas para que una persona decida. Tiene cinco partes: la Portada, con los cinco temas de hoy; la Agenda, con todos los temas; la ficha de cada tema, con su evidencia y su borrador; el Tablero, con las gráficas; y Control, con las fuentes, las reglas y las pruebas.";

test("una reformulación fiel pasa", () => {
  expect(fielAlTexto("AgenteTVN junta las noticias del día y los datos oficiales, las ordena por importancia y te prepara borradores con citas para que decida una persona. En la Portada ves los cinco temas de hoy y en la Agenda, todos los temas.", FIJO)).toBe(true);
});
test("lo inventado no pasa (llamada 968110: «en Control ajustas el enfoque»)", () => {
  expect(fielAlTexto("En Control ajustas el enfoque de la cobertura y configuras los permisos del equipo.", FIJO)).toBe(false); // funciones nuevas
  expect(fielAlTexto("La plataforma revisa 300 noticias al día.", FIJO)).toBe(false); // cifra nueva
  expect(fielAlTexto("La plataforma la usa también la Contraloría.", FIJO)).toBe(false); // nombre nuevo
});
