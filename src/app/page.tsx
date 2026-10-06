"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Shell } from "@/components/mesa/shell";
import { Entrada } from "@/components/mesa/entrada";
import { Portada } from "@/components/mesa/portada";
import { Agenda } from "@/components/mesa/agenda";
import { Ficha } from "@/components/mesa/ficha";
import { Control } from "@/components/mesa/control";
import { ChatAgente } from "@/components/mesa/chat";
import { useTransicionVista } from "@/components/mesa/motion";
import { useMesa } from "@/store/mesa";

export default function Page() {
  const vista = useMesa((s) => s.vista);
  const eventoId = useMesa((s) => s.eventoId);
  const sesion = useMesa((s) => s.sesion);
  const setSesion = useMesa((s) => s.setSesion);
  const [listo, setListo] = useState(false);
  const transicion = useTransicionVista();

  useEffect(() => {
    fetch("/api/entrar").then((r) => r.json()).then((j) => { if (j.sesion) setSesion(j.sesion); setListo(true); }).catch(() => setListo(true));
  }, [setSesion]);

  if (!listo) return <div className="min-h-screen bg-papel" aria-busy="true" />;
  if (!sesion) return <Entrada />;

  const clave = vista === "ficha" ? `ficha-${eventoId}` : vista;
  return (
    <Shell>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={clave} {...transicion}>
          {vista === "ficha" && eventoId ? <Ficha id={eventoId} /> : vista === "control" ? <Control /> : vista === "agenda" ? <Agenda /> : <Portada />}
        </motion.div>
      </AnimatePresence>
      <ChatAgente />
    </Shell>
  );
}
