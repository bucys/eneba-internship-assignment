import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, type DataRouter } from "react-router";
import { setUnauthorizedHandler } from "../api/client";
import { authToken } from "./authToken";
import {
  createTokenSyncHandler,
  createUnauthorizedHandler,
  requireAuth,
  signOut,
} from "./auth";
import { queryClient } from "./queryClient";

vi.mock("./env", () => ({ env: { apiUrl: "https://api.example.test" } }));

type FakeRouterOptions = {
  protected: boolean;
  navigating?: boolean;
};

function fakeRouter({
  protected: isProtected,
  navigating = false,
}: FakeRouterOptions) {
  const navigate = vi.fn(async () => {});
  const router = {
    navigate,
    subscribe: vi.fn(() => () => {}),
    state: {
      location: { pathname: "/orders", search: "?page=2" },
      navigation: { state: navigating ? "loading" : "idle" },
      matches: [
        { route: { handle: undefined } },
        { route: { handle: isProtected ? { requiresAuth: true } : undefined } },
      ],
    },
  } as unknown as Pick<DataRouter, "state" | "navigate" | "subscribe">;
  return { router, navigate };
}

beforeEach(() => {
  authToken.set("current");
  queryClient.setQueryData(["me"], { id: 1, name: "Ana", email: "a@x.com" });
  queryClient.setQueryData(["me", "cart"], []);
});

afterEach(() => {
  authToken.clear();
  queryClient.clear();
});

describe("createUnauthorizedHandler", () => {
  // covers: AC-13
  it("clears auth and sends a protected page to sign in with reason=expired", () => {
    const { router, navigate } = fakeRouter({ protected: true });

    createUnauthorizedHandler(router)({ token: "current", path: "/auth/me" });

    expect(authToken.get()).toBeNull();
    expect(queryClient.getQueryData(["me"])).toBeUndefined();
    expect(queryClient.getQueryData(["me", "cart"])).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith(
      "/login?redirectTo=%2Forders%3Fpage%3D2&reason=expired",
    );
  });

  // covers: AC-13
  it("only clears on a public page", () => {
    const { router, navigate } = fakeRouter({ protected: false });

    createUnauthorizedHandler(router)({ token: "current", path: "/auth/me" });

    expect(authToken.get()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  // covers: AC-13
  it("clears and navigates once for several 401s at once", () => {
    const { router, navigate } = fakeRouter({ protected: true });
    const handle = createUnauthorizedHandler(router);
    const clear = vi.spyOn(authToken, "clear");

    handle({ token: "current", path: "/auth/me" });
    handle({ token: "current", path: "/me/cart" });
    handle({ token: "current", path: "/me/orders" });

    expect(clear).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  // covers: AC-12, AC-13
  it("ignores a 401 for a replaced token and a 401 from logout", () => {
    const { router, navigate } = fakeRouter({ protected: true });
    const handle = createUnauthorizedHandler(router);

    handle({ token: "older", path: "/auth/me" });
    handle({ token: "current", path: "/auth/logout" });

    expect(authToken.get()).toBe("current");
    expect(queryClient.getQueryData(["me"])).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("waits for a running navigation before it redirects", () => {
    const { router, navigate } = fakeRouter({
      protected: true,
      navigating: true,
    });

    createUnauthorizedHandler(router)({ token: "current", path: "/auth/me" });

    expect(authToken.get()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(router.subscribe).toHaveBeenCalledTimes(1);
  });
});

describe("createUnauthorizedHandler with a real router", () => {
  // The /orders loader passes requireAuth from the cached user, then waits on `gate`,
  // so the test can deliver a 401 from another request while the navigation runs.
  function ordersRouter(gate: Promise<void>) {
    return createMemoryRouter([
      { path: "/", Component: () => null },
      { path: "/login", Component: () => null },
      {
        path: "/orders",
        Component: () => null,
        handle: { requiresAuth: true },
        loader: async ({ request }) => {
          const me = await requireAuth(request);
          await gate;
          return me;
        },
      },
    ]);
  }

  // covers: AC-13
  it("sends a protected page to sign in when another request gets a 401 while navigating to it", async () => {
    let openGate!: () => void;
    const router = ordersRouter(new Promise((resolve) => (openGate = resolve)));
    const handle = createUnauthorizedHandler(router);

    void router.navigate("/orders");
    await vi.waitFor(() =>
      expect(router.state.navigation.state).toBe("loading"),
    );
    handle({ token: "current", path: "/me/cart" });
    openGate();

    await vi.waitFor(() =>
      expect(
        router.state.location.pathname + router.state.location.search,
      ).toBe("/login?redirectTo=%2Forders&reason=expired"),
    );
    router.dispose();
  });

  // covers: AC-13
  it("leaves the redirect to requireAuth when its own /me call gets the 401", async () => {
    queryClient.removeQueries({ queryKey: ["me"] });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ message: "Unauthenticated." }, { status: 401 }),
      ),
    );
    const router = ordersRouter(Promise.resolve());
    setUnauthorizedHandler(createUnauthorizedHandler(router));
    const navigate = vi.spyOn(router, "navigate");

    await router.navigate("/orders");
    await vi.waitFor(() => expect(router.state.navigation.state).toBe("idle"));

    expect(router.state.location.pathname + router.state.location.search).toBe(
      "/login?redirectTo=%2Forders&reason=expired",
    );
    // Only the test's own navigation: the handler added none.
    expect(navigate.mock.calls).toEqual([["/orders"]]);
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
    router.dispose();
  });
});

describe("signOut", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // covers: AC-12
  it("signs out at once and revokes the old token, which a later failure cannot undo", async () => {
    let answer!: (response: Response) => void;
    const fetchMock = vi.fn(
      (_url: string, _init?: RequestInit) =>
        new Promise<Response>((resolve) => (answer = resolve)),
    );
    vi.stubGlobal("fetch", fetchMock);

    signOut();

    // Signed out before the server has answered.
    expect(authToken.get()).toBeNull();
    expect(queryClient.getQueryData(["me"])).toBeUndefined();
    const sent = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/api/v1/auth/logout",
    );
    expect(sent.get("Authorization")).toBe("Bearer current");

    // A new session starts, then the old sign out request fails.
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    authToken.set("newer");
    answer(Response.json({ message: "Unauthenticated." }, { status: 401 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handler).not.toHaveBeenCalled();
    expect(authToken.get()).toBe("newer");
    setUnauthorizedHandler(null);
  });

  it("only clears locally when there is no token", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    authToken.clear();

    signOut();

    expect(queryClient.getQueryData(["me"])).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("createTokenSyncHandler", () => {
  // covers: AC-14
  it("sends a protected page to sign in without reason=expired when another tab signs out", () => {
    const { router, navigate } = fakeRouter({ protected: true });

    createTokenSyncHandler(router)(null);

    expect(queryClient.getQueryData(["me"])).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith(
      "/login?redirectTo=%2Forders%3Fpage%3D2",
    );
  });

  // covers: AC-14
  it("drops cached user data and refetches /me when another tab signs in", () => {
    const { router, navigate } = fakeRouter({ protected: false });
    const prefetch = vi.spyOn(queryClient, "prefetchQuery").mockResolvedValue();

    createTokenSyncHandler(router)("new-token");

    expect(queryClient.getQueryData(["me", "cart"])).toBeUndefined();
    expect(prefetch).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["me"] }),
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});
