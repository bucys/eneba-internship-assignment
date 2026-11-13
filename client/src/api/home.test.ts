import { describe, expect, it, vi } from "vitest";
import {
  bestSellersQuery,
  dealsQuery,
  homeBannersQuery,
  homeLayoutQuery,
} from "./home";

vi.mock("../lib/env", () => ({ env: { apiUrl: "https://api.example.test" } }));

describe("home queries", () => {
  it("keys every block under home with a 60 second stale time", () => {
    const queries = [
      homeLayoutQuery(),
      homeBannersQuery(),
      bestSellersQuery(),
      dealsQuery(),
    ];

    expect(queries.map((query) => query.queryKey)).toEqual([
      ["home", "layout"],
      ["home", "banners"],
      ["home", "best-sellers"],
      ["home", "deals"],
    ]);
    expect(queries.every((query) => query.staleTime === 60_000)).toBe(true);
  });

  it("unwraps the { data } envelope", () => {
    const blocks = [{ type: "deals", title: "Deals" }];

    expect(homeLayoutQuery().select?.({ data: blocks })).toBe(blocks);
  });

  it("fetches each block from its own endpoint", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;

    for (const query of [
      homeLayoutQuery(),
      homeBannersQuery(),
      bestSellersQuery(),
      dealsQuery(),
    ]) {
      await query.queryFn?.({ signal } as never);
    }

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      "https://api.example.test/api/v1/home",
      "https://api.example.test/api/v1/home/banners",
      "https://api.example.test/api/v1/home/best-sellers",
      "https://api.example.test/api/v1/home/deals",
    ]);
    vi.unstubAllGlobals();
  });
});
