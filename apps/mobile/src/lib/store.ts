import { useSyncExternalStore } from 'react';

/** Tiny observable value (enough for theme + toasts; server state lives in React Query). */
export function create<T>(initial: T) {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set: (v: T) => { value = v; subs.forEach((s) => s()); },
    use: () => useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => value, () => value),
  };
}
