/**
 * Guarda los filtros y la página de un listado en la URL (?q=...&page=2).
 * Así los filtros sobreviven a recargas y se pueden compartir como enlace.
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useListParams<K extends string>(keys: readonly K[]) {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = Object.fromEntries(keys.map((k) => [k, searchParams.get(k) ?? ''])) as Record<K, string>;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  /** Cambia un filtro y vuelve a la página 1. */
  const setFilter = useCallback(
    (key: K, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (value: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(value));
        return next;
      });
    },
    [setSearchParams],
  );

  return { values, page, setFilter, setPage };
}
