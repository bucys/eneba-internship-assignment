import { useSlowPending } from "../lib/useSlowPending";
import { Spinner } from "../components/ui/Spinner";

// First page load while a route loader (for example the /orders sign in check) waits for the API.
export function RouteHydrateFallback() {
  const slow = useSlowPending(true);

  return (
    <div
      role="status"
      className="flex min-h-svh flex-col items-center justify-center gap-3 px-5 text-center text-fg-soft"
    >
      <Spinner className="size-8 text-cta" />
      <p>
        {slow
          ? "Waking up the server. The first visit after a quiet spell can take up to a minute."
          : "Loading…"}
      </p>
    </div>
  );
}
