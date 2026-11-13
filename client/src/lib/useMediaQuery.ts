import { useCallback, useSyncExternalStore } from "react";

/** Live `matchMedia(query).matches`; false where matchMedia does not exist. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof globalThis.matchMedia !== "function") return () => {};
      const list = globalThis.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () =>
      typeof globalThis.matchMedia === "function" &&
      globalThis.matchMedia(query).matches,
  );
}
