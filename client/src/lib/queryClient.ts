import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";

export const QUERY_RETRY_DELAY_MS = 3000;

// Retry once, only when trying again can help: a dropped connection or a 5xx
// (often a waking server). Never a timeout (it already waited 90 s) or a 4xx.
export function shouldRetryQuery(failureCount: number, error: Error): boolean {
  if (failureCount >= 1 || !(error instanceof ApiError)) {
    return false;
  }
  return (
    error.kind === "network" || (error.kind === "http" && error.status >= 500)
  );
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      retryDelay: QUERY_RETRY_DELAY_MS,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
