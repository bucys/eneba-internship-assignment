import { queryOptions, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { redirect, type DataRouter } from "react-router";
import { fetchMe, logout, type AuthSession } from "../api/auth";
import { ApiError, type UnauthorizedEvent } from "../api/client";
import { authToken } from "./authToken";
import { queryClient } from "./queryClient";
import { loginPath, safeRedirect } from "./safeRedirect";

// Every user scoped query key starts with "me" (later ["me", "cart"], ["me", "orders"]),
// so one removeQueries call clears all of a user's cached data.
const ME_KEY = ["me"] as const;

export const meQueryOptions = queryOptions({
  queryKey: ME_KEY,
  queryFn: ({ signal }) => fetchMe(signal),
  // The user changes only through sign in and sign out, which update the cache themselves.
  staleTime: Infinity,
});

export function useAuthToken(): string | null {
  return useSyncExternalStore(authToken.subscribe, authToken.getSnapshot);
}

/** The signed in user's query; disabled while there is no token. */
export function useMe() {
  const token = useAuthToken();
  return useQuery({ ...meQueryOptions, enabled: token !== null });
}

export function clearAuth() {
  queryClient.removeQueries({ queryKey: ME_KEY });
  authToken.clear();
}

/** Signs out locally at once, and revokes that token on the server in the background (spec 0006 AC-12). */
export function signOut() {
  const token = authToken.get();
  clearAuth();
  if (token !== null) {
    // A failed revoke leaves a server token that expires within 7 days.
    logout(token).catch(() => {});
  }
}

type AfterSignInHook = () => void | Promise<void>;

const afterSignInHooks = new Set<AfterSignInHook>();

/** Runs in the tab that signed in, after the token is stored and before navigation (for example the guest cart merge). */
export function onAfterSignIn(hook: AfterSignInHook): () => void {
  afterSignInHooks.add(hook);
  return () => afterSignInHooks.delete(hook);
}

/** Stores the new session, runs the after sign in hooks, and returns where to go next. */
export async function completeSignIn(
  session: AuthSession,
  redirectTo: string | null,
): Promise<string> {
  // Seed the cache before the token, so the header shows the name without a /me call.
  queryClient.setQueryData(ME_KEY, session.user);
  authToken.set(session.token);
  // Sign in already succeeded, so a failing hook must not block the redirect.
  await Promise.allSettled([...afterSignInHooks].map((hook) => hook()));
  return safeRedirect(redirectTo);
}

type AuthRouter = Pick<DataRouter, "state" | "navigate" | "subscribe">;

function isOnProtectedRoute(router: AuthRouter): boolean {
  return router.state.matches.some(
    (match) =>
      (match.route.handle as { requiresAuth?: boolean } | undefined)
        ?.requiresAuth === true,
  );
}

function currentPath(router: AuthRouter): string {
  const { pathname, search } = router.state.location;
  return pathname + search;
}

/** Reacts to a 401 from apiFetch: signs out locally and, on a protected page, sends the user to sign in. */
export function createUnauthorizedHandler(router: AuthRouter) {
  return ({ token, path }: UnauthorizedEvent) => {
    // A failed sign out signs out locally on its own. A 401 for a replaced token is stale.
    // Once cleared, later 401s carry an old token, so concurrent 401s act only once.
    if (path === "/auth/logout" || token !== authToken.get()) {
      return;
    }
    clearAuth();
    // A running navigation may already have passed its requireAuth check, so wait
    // for it to settle and check where it landed (spec 0006 AC-13).
    if (router.state.navigation.state === "idle") {
      sendToSignInIfProtected(router);
      return;
    }
    const unsubscribe = router.subscribe((state) => {
      if (state.navigation.state !== "idle") return;
      unsubscribe();
      sendToSignInIfProtected(router);
    });
  };
}

// Skips when the user signed in again meanwhile, or the navigation already ended
// on sign in (requireAuth redirects on its own 401).
function sendToSignInIfProtected(router: AuthRouter) {
  if (authToken.get() === null && isOnProtectedRoute(router)) {
    void router.navigate(loginPath(currentPath(router), { expired: true }));
  }
}

/** Adopts a sign in or sign out from another tab. Never runs the after sign in hooks. */
export function createTokenSyncHandler(router: AuthRouter) {
  return (token: string | null) => {
    queryClient.removeQueries({ queryKey: ME_KEY });
    if (token !== null) {
      void queryClient.prefetchQuery(meQueryOptions);
      return;
    }
    if (isOnProtectedRoute(router)) {
      void router.navigate(loginPath(currentPath(router)));
    }
  };
}

function requestPath(request: Request): string {
  const url = new URL(request.url);
  return url.pathname + url.search;
}

/** Loader guard: signed out visitors go to sign in, then come back here. */
export async function requireAuth(request: Request) {
  const path = requestPath(request);
  if (authToken.get() === null) {
    throw redirect(loginPath(path));
  }
  try {
    return await queryClient.ensureQueryData(meQueryOptions);
  } catch (error) {
    // The 401 handler usually clears the token first, which cancels this /me query,
    // so a missing token counts as the same 401.
    const unauthorized = error instanceof ApiError && error.status === 401;
    if (unauthorized || authToken.get() === null) {
      clearAuth();
      throw redirect(loginPath(path, { expired: true }));
    }
    throw error;
  }
}

/** Loader for the auth pages: a confirmed user goes straight on. Never calls the API. */
export function redirectIfSignedIn(request: Request) {
  if (queryClient.getQueryData(ME_KEY) !== undefined) {
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    throw redirect(safeRedirect(redirectTo));
  }
  return null;
}
