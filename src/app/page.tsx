"use client";
import { useCallback, useState } from "react";
import { Shell } from "@/components/mesa/shell";
import { Agenda } from "@/components/mesa/agenda";
import { Ficha } from "@/components/mesa/ficha";
import { Control } from "@/components/mesa/control";
import { useMesa } from "@/store/mesa";

export default function Page() {
  const { vista, eventoId } = useMesa();
  const [meta, setMeta] = useState<{ corteUTC: string; version: string } | null>(null);
  const onCargada = useCallback((m: { corteUTC: string; version: string }) => setMeta(m), []);
  return (
    <Shell corteUTC={meta?.corteUTC} version={meta?.version}>
      {vista === "ficha" && eventoId ? <Ficha id={eventoId} /> : vista === "control" ? <Control /> : <Agenda onCargada={onCargada} />}
    </Shell>
  );
}
