import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · My Portal` : 'My Portal';
  }, [title]);
}

/**
 * Filter state stored in the URL query string so views are shareable and
 * survive refreshes. Changing any filter other than `page` resets paging.
 */
export function useQueryState(defaults) {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const raw = searchParams.get(key);
      if (raw === null) continue;
      result[key] = typeof defaults[key] === 'number' ? Number(raw) || defaults[key] : raw;
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const update = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const resetsPage = Object.keys(patch).some((k) => k !== 'page');
          for (const [key, value] of Object.entries(patch)) {
            if (value === '' || value === null || value === undefined || value === defaults[key]) next.delete(key);
            else next.set(key, String(value));
          }
          if (resetsPage && !('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSearchParams],
  );

  return [values, update];
}

/**
 * A single URL query param as state, e.g. `?leave=<id>` for an open details
 * panel or `?action=new` for a quick action. Setting `null` removes it.
 */
export function useUrlParam(key) {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(key);

  const setValue = useCallback(
    (next) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === null || next === undefined || next === '') params.delete(key);
          else params.set(key, String(next));
          return params;
        },
        { replace: true },
      );
    },
    [key, setSearchParams],
  );

  return [value, setValue];
}

/**
 * Returns true once each time `key` changes to a new non-null value — the
 * render-time alternative to resetting local state inside an effect.
 */
export function useResetOnChange(key) {
  const [previous, setPrevious] = useState(key);
  if (previous !== key) {
    setPrevious(key);
    return key !== null && key !== undefined;
  }
  return false;
}

export function useDisclosure(initial = false) {
  const [isOpen, setIsOpen] = useState(initial);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return { isOpen, open, close, setIsOpen };
}
