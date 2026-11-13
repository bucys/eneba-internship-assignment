// @vitest-environment jsdom
import "../../test/dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Suggestion } from "../../api/search";
import { jsonResponse } from "../../test/fixtures";

vi.mock("../../lib/env", () => ({
  env: { apiUrl: "https://api.example.test" },
}));

const { queryClient } = await import("../../lib/queryClient");
const { SearchForm } = await import("./SearchForm");

function suggestion(slug: string, name: string): Suggestion {
  return {
    slug,
    name,
    cover_image_url: `https://img.example.test/${slug}.jpg`,
    platform: { slug: "steam", name: "Steam" },
    price: { amount: 1299, currency: "EUR" },
  };
}

const WITCHER = [
  suggestion("witcher-3", "The Witcher 3: Wild Hunt"),
  {
    ...suggestion("witcher-3-dlc", "The Witcher 3: Blood and Wine"),
    price: null,
  },
];

type Answer = (q: string) => Response | Promise<Response>;

function stubSuggestions(
  answer: Answer = () => jsonResponse(200, { data: WITCHER }),
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/search/suggestions") {
      return answer(url.searchParams.get("q") ?? "");
    }
    throw new Error(`unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentTerms(fetchMock: ReturnType<typeof stubSuggestions>) {
  return fetchMock.mock.calls.map(([input]) =>
    new URL(String(input)).searchParams.get("q"),
  );
}

function renderSearch(url = "/") {
  const page = (label: string) => (
    <>
      <SearchForm />
      <p>{label}</p>
    </>
  );
  const router = createMemoryRouter(
    [
      { path: "/", element: page("home") },
      { path: "/store", element: page("store") },
      { path: "/products/:slug", element: page("product") },
    ],
    { initialEntries: [url] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, input: screen.getByRole("combobox", { name: "Search" }) };
}

const liveRegion = () => document.querySelector('[aria-live="polite"]');
const optionNames = () =>
  screen.queryAllByRole("option").map((option) => option.textContent);

afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});

// covers: spec 0013 AC-7, AC-8, AC-9
describe("SearchForm suggestions", () => {
  it("sends one debounced request, highlights the typed words, and opens the chosen game", async () => {
    const fetchMock = stubSuggestions();
    const user = userEvent.setup();
    const { router, input } = renderSearch();

    await user.type(input, "Witch");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findAllByRole("option")).toHaveLength(3);
    expect(sentTerms(fetchMock)).toEqual(["witch"]);

    const first = screen.getAllByRole("option")[0];
    expect(
      within(first).getByText("Witch", { selector: "mark" }),
    ).toBeInTheDocument();
    expect(within(first).getByText("Steam")).toBeInTheDocument();
    expect(
      within(screen.getAllByRole("option")[1]).getByText("Out of stock"),
    ).toBeInTheDocument();
    expect(first.querySelector("img")).toHaveAttribute("alt", "");
    expect(liveRegion()).toHaveTextContent("2 suggestions");

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", first.id);
    await user.keyboard("{Enter}");

    expect(router.state.location.pathname).toBe("/products/witcher-3");
    expect(input).toHaveValue("Witch");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveFocus();
  });

  it("sends nothing under two characters and reuses the cache for the same term", async () => {
    const fetchMock = stubSuggestions();
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, "w");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.type(input, "itc");
    await screen.findAllByRole("option");
    await user.type(input, "{Backspace}{Backspace}{Backspace}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.type(input, "ITC ");
    expect(await screen.findAllByRole("option")).toHaveLength(3);
    expect(sentTerms(fetchMock)).toEqual(["witc"]);
  });

  it("wraps the arrows, and Escape closes before it clears", async () => {
    stubSuggestions();
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, "witcher");
    const options = await screen.findAllByRole("option");

    await user.keyboard("{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", options[2].id);
    expect(options[2]).toHaveTextContent('See all results for "witcher"');
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.type(input, "s");
    expect(input).not.toHaveAttribute("aria-activedescendant");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("witchers");

    await user.keyboard("{ArrowDown}");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}{Escape}");
    expect(input).toHaveValue("");
  });

  it("closes on Tab", async () => {
    stubSuggestions();
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, "witcher");
    await screen.findAllByRole("option");
    await user.tab();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("selects on click without losing focus, and See all goes to the store", async () => {
    stubSuggestions();
    const user = userEvent.setup();
    const { router, input } = renderSearch();

    await user.type(input, "  witcher ");
    await user.click(
      await screen.findByRole("option", {
        name: 'See all results for "witcher"',
      }),
    );

    expect(router.state.location.pathname).toBe("/store");
    expect(router.state.location.search).toBe("?q=witcher");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("never opens from the URL, only from the visitor's own focus or typing", async () => {
    stubSuggestions();
    const { router, input } = renderSearch("/store?q=witcher");

    expect(input).toHaveValue("witcher");
    await act(() => router.navigate("/store?q=elden"));
    await act(() => router.navigate(-1));
    expect(input).toHaveValue("witcher");
    expect(input).toHaveAttribute("aria-expanded", "false");

    act(() => input.focus());
    expect(await screen.findAllByRole("option")).toHaveLength(3);

    await act(() => router.navigate("/store?q=elden"));
    expect(input).toHaveAttribute("aria-expanded", "false");
  });
});

// covers: spec 0013 AC-10
describe("SearchForm suggestion states", () => {
  it("shows Searching, then no matches without a See all row", async () => {
    stubSuggestions(() => jsonResponse(200, { data: [] }));
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, "zzzz");
    expect(screen.getByText("Searching…")).toBeInTheDocument();
    expect(
      await screen.findByText('No games match "zzzz"'),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(liveRegion()).toHaveTextContent("No games match");
  });

  it("shows the unavailable row on a 429, and Enter still submits", async () => {
    stubSuggestions(() =>
      jsonResponse(
        429,
        { message: "Too Many Attempts." },
        { "Retry-After": "30" },
      ),
    );
    const user = userEvent.setup();
    const { router, input } = renderSearch();

    await user.type(input, "witcher");
    expect(
      await screen.findByText("Suggestions are unavailable right now.", {
        selector: "p:not([aria-live])",
      }),
    ).toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent(
      "Suggestions are unavailable right now.",
    );

    await user.keyboard("{Enter}");
    expect(router.state.location.pathname).toBe("/store");
    expect(router.state.location.search).toBe("?q=witcher");
  });

  it("keeps the previous list dimmed and busy while the next term loads", async () => {
    let release: (response: Response) => void = () => {};
    stubSuggestions((q) =>
      q === "witcher"
        ? jsonResponse(200, { data: WITCHER })
        : new Promise((resolve) => {
            release = resolve;
          }),
    );
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, "witcher");
    await screen.findAllByRole("option");

    await user.type(input, " blood");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-busy", "true");
    expect(optionNames()).toHaveLength(3);
    expect(liveRegion()).toHaveTextContent("");

    await waitFor(() =>
      expect(sentTerms(vi.mocked(fetch))).toContain("witcher blood"),
    );
    act(() => release(jsonResponse(200, { data: [WITCHER[1]] })));
    await waitFor(() => expect(listbox).not.toHaveAttribute("aria-busy"));
    expect(optionNames()).toHaveLength(2);
    expect(liveRegion()).toHaveTextContent("1 suggestion");
  });

  it("never flashes an older term's list after closing", async () => {
    stubSuggestions((q) =>
      q === "witcher"
        ? jsonResponse(200, { data: WITCHER })
        : new Promise(() => {}),
    );
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, "witcher");
    await screen.findAllByRole("option");
    await user.keyboard("{Escape}");
    await user.clear(input);
    await user.type(input, "elden");

    expect(screen.getByText("Searching…")).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});
