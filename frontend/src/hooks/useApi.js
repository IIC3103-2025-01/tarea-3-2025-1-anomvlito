// src/hooks/useApi.js
import { useEffect, useState, useRef } from "react";

export function useApi(
  endpoint,
  {
    options = {}, // fetch options extra
    pollingInterval = 0, // ms entre peticiones (0 = no polling)
    incremental = false, // si true, añade `?since=` para traer sólo cambios
    mergeData = (prev, next) => next, // función para combinar prev + next
  } = {}
) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const controllerRef = useRef(null);
  const lastRef = useRef(null); // marca de tiempo de la última actualización

  useEffect(() => {
    let intervalId;

    const fetchData = async () => {
      // abortar request anterior
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      const controller = new AbortController();
      controllerRef.current = controller;

      setLoading(true);
      setError(null);

      // construir URL con `since` si es incremental
      let url = endpoint;
      if (incremental && lastRef.current) {
        const sep = url.includes("?") ? "&" : "?";
        url += `${sep}since=${encodeURIComponent(lastRef.current)}`;
      }

      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            ...(options.headers || {}),
          },
          ...options,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Error ${res.status}: ${text || res.statusText}`);
        }

        const json = res.status === 204 ? null : await res.json();

        // hacer merge de los datos en lugar de sobrescribir
        setData((prev) => mergeData(prev, json));

        // actualizar la marca de tiempo (la API debe devolver `lastUpdated`)
        lastRef.current = json?.lastUpdated || new Date().toISOString();
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("useApi error:", err);
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    // primer fetch
    fetchData();

    // setInterval sólo si pollingInterval > 0
    if (pollingInterval > 0) {
      intervalId = setInterval(fetchData, pollingInterval);
    }

    return () => {
      // cleanup al desmontar o cambiar deps
      if (controllerRef.current) controllerRef.current.abort();
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    endpoint,
    pollingInterval,
    incremental,
    // stringify options para que React compare correctamente
    JSON.stringify(options),
  ]);

  return { data, loading, error };
}
