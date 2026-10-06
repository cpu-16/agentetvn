/** Un toque corto abre o cierra el panel; mantener presionado (≥ umbral) es hablar. */
export const clasificarPulsacion = (ms: number, umbral = 250): "toque" | "sostenida" => (ms >= umbral ? "sostenida" : "toque");
