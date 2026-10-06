"use client";
import { useReducedMotion } from "framer-motion";
import { EASE_OUT, SPRING } from "@/store/mesa";

/** Transición de entrada/salida de una vista: crossfade con un toque de blur (enmascara el cambio de estados). */
export function useTransicionVista() {
  const reducir = useReducedMotion();
  return {
    initial: reducir ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)", transform: "translateY(4px)" },
    animate: { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" },
    exit: reducir ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)", transform: "translateY(-2px)" },
    transition: { duration: 0.18, ease: EASE_OUT },
  } as const;
}

/** Entrada escalonada de una lista (una sola vez). 40 ms entre ítems, nunca bloquea la interacción. */
export function itemEscalonado(i: number, reducir: boolean | null) {
  return {
    initial: reducir ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" },
    animate: { opacity: 1, transform: "translateY(0px)" },
    transition: { ...SPRING, delay: Math.min(i, 12) * 0.04 },
  } as const;
}
