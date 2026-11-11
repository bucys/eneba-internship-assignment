import { useEffect, useState } from "react";

/** True once `isPending` has stayed true for `delayMs`; false again as soon as it settles. */
export function useSlowPending(isPending: boolean, delayMs = 3000): boolean {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!isPending) {
      return;
    }
    const timer = setTimeout(() => setIsSlow(true), delayMs);
    return () => {
      clearTimeout(timer);
      setIsSlow(false);
    };
  }, [isPending, delayMs]);

  return isPending && isSlow;
}
