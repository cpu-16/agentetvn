"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Hook de datos con recarga manual y automática ligera. */
export function useApi<T>(url: string | null, opts?: { refetchMs?: number; refreshKey?: number }) {
  const [data, setData] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    if (!url) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as T);
      setError(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [url]);

  useEffect(() => {
    setCargando(true);
    void refetch();
    return () => abortRef.current?.abort();
  }, [refetch, opts?.refreshKey]);

  useEffect(() => {
    if (!opts?.refetchMs) return;
    const t = setInterval(() => void refetch(), opts.refetchMs);
    return () => clearInterval(t);
  }, [refetch, opts?.refetchMs]);

  return { data, cargando, error, refetch, setData };
}
