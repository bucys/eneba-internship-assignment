// @vitest-environment jsdom
import "../test/dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Order, OrderItemKeys } from "../api/orders";
import { jsonResponse, order, orderItem } from "../test/fixtures";

vi.mock("../lib/env", () => ({ env: { apiUrl: "https://api.example.test" } }));

const { queryClient } = await import("../lib/queryClient");
const { orderKeysQueryKey, orderQueryKey } = await import("../api/orders");
const { OrderConfirmationPage } = await import("./OrderConfirmationPage");

const ULID = "01jcheckoutorder0000000000";
const OTHER_ULID = "01jotherorder0000000000000";

// One item of 3 (Elden Ring) and one item of 1 (Hades).
const paid = order({
  items: [
    orderItem({ id: 11, quantity: 3 }),
    orderItem({
      id: 12,
      product: { slug: "hades", cover_image_url: "" },
      product_name: "Hades",
      platform_name: "Epic Games",
      quantity: 1,
    }),
  ],
});

const keys: OrderItemKeys[] = [
  { order_item_id: 11, codes: ["AAAAA-11111", "BBBBB-22222", "CCCCC-33333"] },
  { order_item_id: 12, codes: ["HADES-44444"] },
];

type Deferred = { resolve: (response: Response) => void };

/** Order requests answer at once; each keys request waits until the test resolves it. */
function stubApi() {
  const keyRequests: Deferred[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/keys")) {
      return new Promise<Response>((resolve) => keyRequests.push({ resolve }));
    }
    const ulid = url.split("/").pop();
    return jsonResponse(200, { data: { ...paid, ulid } });
  });
  vi.stubGlobal("fetch", fetchMock);
  const keyCalls = () =>
    fetchMock.mock.calls.filter(([url]) => url.endsWith("/keys")).length;
  return { keyRequests, keyCalls, fetchMock };
}

function renderPage(seed: Order[] = [paid]) {
  for (const seeded of seed) {
    queryClient.setQueryData(orderQueryKey(seeded.ulid), seeded);
  }
  const router = createMemoryRouter(
    [
      { path: "/orders/:ulid", Component: OrderConfirmationPage },
      { path: "/", Component: () => <p>Home</p> },
    ],
    { initialEntries: [`/orders/${ULID}`] },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, ...view };
}

const revealButton = (name: string) =>
  screen.getByRole("button", { name: `Reveal ${name}` });

afterEach(() => {
  queryClient.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("order page keys", () => {
  // covers: spec 0010 AC-5
  it("shows one masked slot per unit and sends no keys request on load", async () => {
    const { keyCalls } = stubApi();
    renderPage();

    expect(
      await screen.findByText("Your keys are ready. Reveal a key to copy it."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Key hidden" })).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: /^Reveal key/ })).toHaveLength(
      4,
    );
    expect(revealButton("key 2 of 3 for Elden Ring")).toHaveTextContent(
      "Reveal key",
    );
    expect(revealButton("key for Hades")).toBeInTheDocument();
    expect(screen.getByText("Redeem these keys on Steam.")).toBeInTheDocument();
    expect(
      screen.getByText("Redeem this key on Epic Games."),
    ).toBeInTheDocument();
    expect(document.querySelector("code")).toBeNull();
    expect(keyCalls()).toBe(0);
  });

  // covers: spec 0010 AC-6
  it("fetches once on the first Reveal, reveals every pending slot, and toggles locally after", async () => {
    const user = userEvent.setup();
    const { keyRequests, keyCalls } = stubApi();
    renderPage();

    const first = await screen.findByRole("button", {
      name: "Reveal key 1 of 3 for Elden Ring",
    });
    await user.click(first);

    expect(keyCalls()).toBe(1);
    expect(first).toHaveTextContent("Revealing…");
    expect(first).toHaveAttribute("aria-disabled", "true");
    expect(first).not.toBeDisabled();
    expect(first).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Revealing keys…");

    await user.click(first);
    await user.click(revealButton("key for Hades"));
    expect(keyCalls()).toBe(1);

    await act(async () => {
      keyRequests[0].resolve(jsonResponse(200, { data: keys }));
    });

    expect(await screen.findByText("AAAAA-11111")).toBeInTheDocument();
    expect(screen.getByText("HADES-44444")).toBeInTheDocument();
    expect(screen.queryByText("BBBBB-22222")).toBeNull();
    expect(first).toHaveTextContent("Hide key");
    expect(
      screen.getByRole("button", { name: "Hide key for Hades" }),
    ).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Key revealed");

    await user.click(revealButton("key 3 of 3 for Elden Ring"));
    expect(screen.getByText("CCCCC-33333").tagName).toBe("CODE");
    expect(keyCalls()).toBe(1);

    const hide = screen.getByRole("button", {
      name: "Hide key 1 of 3 for Elden Ring",
    });
    await user.click(hide);
    expect(screen.queryByText("AAAAA-11111")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Copy key 1 of 3 for Elden Ring" }),
    ).toBeNull();
    expect(hide).toHaveTextContent("Reveal key");
    expect(hide).toHaveFocus();
    expect(keyCalls()).toBe(1);
  });

  // covers: spec 0010 AC-7
  it("masks the pending slots on failure and lets the last clicked slot try again", async () => {
    const user = userEvent.setup();
    const { keyRequests, keyCalls } = stubApi();
    renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Reveal key 1 of 3 for Elden Ring",
      }),
    );
    await user.click(revealButton("key for Hades"));
    await act(async () => {
      keyRequests[0].resolve(jsonResponse(404, { message: "Not found." }));
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load your key.");
    const hadesSlot = revealButton("key for Hades").closest("li")!;
    expect(within(hadesSlot).getByRole("alert")).toBe(alert);
    expect(screen.getAllByRole("img", { name: "Key hidden" })).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Hades" })).toBeInTheDocument();

    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(keyCalls()).toBe(2);
    expect(
      within(hadesSlot).getByRole("button", {
        name: "Revealing key for Hades",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    await act(async () => {
      keyRequests[1].resolve(jsonResponse(200, { data: keys }));
    });

    expect(await screen.findByText("HADES-44444")).toBeInTheDocument();
    expect(screen.queryByText("AAAAA-11111")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("moves the error to another slot when that slot is revealed instead", async () => {
    const user = userEvent.setup();
    const { keyRequests } = stubApi();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Reveal key for Hades" }),
    );
    await act(async () => {
      keyRequests[0].resolve(
        jsonResponse(
          429,
          { message: "Too Many Attempts." },
          { "Retry-After": "17" },
        ),
      );
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many requests. Try again in 17 seconds.",
    );

    await user.click(revealButton("key 2 of 3 for Elden Ring"));
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => {
      keyRequests[1].resolve(
        jsonResponse(
          429,
          { message: "Too Many Attempts." },
          { "Retry-After": "5" },
        ),
      );
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Try again in 5 seconds.");
    expect(
      within(
        revealButton("key 2 of 3 for Elden Ring").closest("li")!,
      ).getByRole("alert"),
    ).toBe(alert);
  });

  // covers: spec 0010 AC-10
  it("starts masked again on another order", async () => {
    const user = userEvent.setup();
    const { keyRequests, keyCalls } = stubApi();
    const { router } = renderPage([paid, { ...paid, ulid: OTHER_ULID }]);

    await user.click(
      await screen.findByRole("button", { name: "Reveal key for Hades" }),
    );
    await act(async () => {
      keyRequests[0].resolve(jsonResponse(200, { data: keys }));
    });
    expect(await screen.findByText("HADES-44444")).toBeInTheDocument();

    await act(() => router.navigate(`/orders/${OTHER_ULID}`));

    expect(
      await screen.findByText(OTHER_ULID.toUpperCase()),
    ).toBeInTheDocument();
    expect(screen.queryByText("HADES-44444")).toBeNull();
    expect(screen.getAllByRole("img", { name: "Key hidden" })).toHaveLength(4);
    expect(keyCalls()).toBe(1);
  });
});

describe("status announcements", () => {
  // covers: spec 0010 AC-6
  it("announces every Reveal and Hide, repeats included, and keeps focus", async () => {
    const user = userEvent.setup();
    const { keyRequests } = stubApi();
    renderPage();
    const status = () => screen.getByRole("status");

    const toggle = await screen.findByRole("button", {
      name: "Reveal key for Hades",
    });
    await user.click(toggle);
    await act(async () => {
      keyRequests[0].resolve(jsonResponse(200, { data: keys }));
    });
    await screen.findByText("HADES-44444");
    expect(status()).toHaveTextContent(/^Key revealed: key for Hades$/);

    await user.click(toggle);
    expect(status()).toHaveTextContent(/^Key hidden: key for Hades$/);
    expect(toggle).toHaveFocus();

    await user.click(toggle);
    expect(status()).toHaveTextContent(/^Key revealed: key for Hades$/);
    expect(toggle).toHaveFocus();

    await user.click(revealButton("key 3 of 3 for Elden Ring"));
    expect(status()).toHaveTextContent(
      /^Key revealed: key 3 of 3 for Elden Ring$/,
    );
  });

  // covers: spec 0010 AC-6
  it("stays silent when a Reveal ends in an error, so only the alert speaks", async () => {
    const user = userEvent.setup();
    const { keyRequests } = stubApi();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Reveal key for Hades" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Revealing keys…");
    await act(async () => {
      keyRequests[0].resolve(jsonResponse(404, { message: "Not found." }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load your key.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(/^$/);
  });
});

describe("incomplete keys response", () => {
  const missingMessage =
    "This key could not be loaded. Try again or contact support.";

  it("shows an error when the item has no entry, and never shows another item's code", async () => {
    const user = userEvent.setup();
    const { keyRequests, keyCalls } = stubApi();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Reveal key for Hades" }),
    );
    await act(async () => {
      keyRequests[0].resolve(jsonResponse(200, { data: [keys[0]] }));
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(missingMessage);
    const hadesSlot = revealButton("key for Hades").closest("li")!;
    expect(within(hadesSlot).getByRole("alert")).toBe(alert);
    expect(
      within(hadesSlot).getByRole("img", { name: "Key hidden" }),
    ).toBeInTheDocument();
    expect(document.querySelector("code")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/^$/);

    await user.click(
      within(hadesSlot).getByRole("button", { name: "Try again" }),
    );
    expect(keyCalls()).toBe(2);
    expect(
      within(hadesSlot).getByRole("button", {
        name: "Revealing key for Hades",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    await act(async () => {
      keyRequests[1].resolve(jsonResponse(200, { data: keys }));
    });

    expect(await screen.findByText("HADES-44444")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      /^Key revealed: key for Hades$/,
    );
  });

  it("keeps one slot per unit when codes are short and errors only the slot without a code", async () => {
    const user = userEvent.setup();
    const { keyRequests } = stubApi();
    renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Reveal key 1 of 3 for Elden Ring",
      }),
    );
    await user.click(revealButton("key 3 of 3 for Elden Ring"));
    await act(async () => {
      keyRequests[0].resolve(
        jsonResponse(200, {
          data: [{ order_item_id: 11, codes: ["AAAAA-11111"] }, keys[1]],
        }),
      );
    });

    expect(await screen.findByText("AAAAA-11111")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", {
        name: /^(Reveal|Hide) key \d of 3 for Elden Ring$/,
      }),
    ).toHaveLength(3);
    const thirdSlot = revealButton("key 3 of 3 for Elden Ring").closest("li")!;
    expect(within(thirdSlot).getByRole("alert")).toHaveTextContent(
      missingMessage,
    );
    expect(thirdSlot.querySelector("code")).toBeNull();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(/^$/);
  });
});

describe("copying a key", () => {
  async function revealHades(user: ReturnType<typeof userEvent.setup>) {
    const { keyRequests } = stubApi();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Reveal key for Hades" }),
    );
    await act(async () => {
      keyRequests[0].resolve(jsonResponse(200, { data: keys }));
    });
    await screen.findByText("HADES-44444");
  }

  function stubClipboard(clipboard: unknown) {
    Object.defineProperty(navigator, "clipboard", {
      value: clipboard,
      configurable: true,
    });
  }

  // covers: spec 0010 AC-8
  it("copies the code, shows Copied for 2 seconds, and announces it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await revealHades(user);
    const writeText = vi.fn(async () => undefined);
    stubClipboard({ writeText });

    const copy = screen.getByRole("button", { name: "Copy key for Hades" });
    await user.click(copy);

    expect(writeText).toHaveBeenCalledWith("HADES-44444");
    expect(copy).toHaveAccessibleName("Copied key for Hades");
    expect(screen.getByRole("status")).toHaveTextContent("Key copied");

    act(() => vi.advanceTimersByTime(1500));
    await user.click(copy);
    act(() => vi.advanceTimersByTime(1500));
    expect(copy).toHaveAccessibleName("Copied key for Hades");
    act(() => vi.advanceTimersByTime(600));
    expect(copy).toHaveAccessibleName("Copy key for Hades");
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it("shows the copy control as an icon only, named for its key", async () => {
    const user = userEvent.setup();
    await revealHades(user);
    stubClipboard({ writeText: vi.fn(async () => undefined) });
    const copy = screen.getByRole("button", { name: "Copy key for Hades" });

    expect(copy).toHaveTextContent(/^$/);
    expect(copy.querySelector("svg")).toHaveAttribute("aria-hidden", "true");

    await user.click(copy);
    expect(copy).toHaveTextContent(/^$/);
    expect(copy).toHaveAccessibleName("Copied key for Hades");
  });

  it("keeps a key that fits out of the tab order", async () => {
    const user = userEvent.setup();
    await revealHades(user);

    const code = screen.getByText("HADES-44444");
    expect(code).not.toHaveAttribute("tabindex");
    expect(code).not.toHaveClass("mask-r-from-75%");
  });

  it("makes a key wider than its box focusable, with a fade until scrolled to the end", async () => {
    // jsdom has no layout, so fake a key 300px wide in a 200px box.
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockReturnValue(300);
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(200);
    try {
      const user = userEvent.setup();
      await revealHades(user);

      const code = screen.getByText("HADES-44444");
      expect(code).toHaveAttribute("tabindex", "0");
      expect(code).toHaveClass("mask-r-from-75%");
      // The mask clips the key's own outline (WCAG 2.4.7), so an unmasked
      // wrapper draws the focus ring.
      expect(code).toHaveClass("outline-none");
      expect(code.parentElement).toHaveClass("has-focus-visible:outline-2");
      expect(code.parentElement).not.toHaveClass("mask-r-from-75%");

      act(() => {
        code.scrollLeft = 100;
        code.dispatchEvent(new Event("scroll"));
      });
      expect(code).not.toHaveClass("mask-r-from-75%");
    } finally {
      scrollWidth.mockRestore();
      clientWidth.mockRestore();
    }
  });

  it("mirrors the copy state in a visual tooltip that Escape dismisses", async () => {
    const user = userEvent.setup();
    await revealHades(user);
    stubClipboard({ writeText: vi.fn(async () => undefined) });
    const copy = screen.getByRole("button", { name: "Copy key for Hades" });
    const tooltip = screen.getByTestId("copy-tooltip");

    expect(tooltip).toHaveAttribute("aria-hidden", "true");
    expect(tooltip).toHaveTextContent("Copy");

    await user.click(copy);
    expect(tooltip).toHaveTextContent("Copied");
    expect(tooltip).toHaveClass("block");

    await user.keyboard("{Escape}");
    expect(tooltip).toHaveClass("hidden");
    expect(copy).toHaveFocus();
  });

  // covers: spec 0010 AC-6, AC-8
  it("announces every successful copy, the same key twice included", async () => {
    const user = userEvent.setup();
    await revealHades(user);
    stubClipboard({ writeText: vi.fn(async () => undefined) });
    const copy = screen.getByRole("button", { name: "Copy key for Hades" });
    const announced = () => screen.getByRole("status").firstElementChild;

    await user.click(copy);
    const first = announced();
    expect(first).toHaveTextContent(/^Key copied: key for Hades$/);

    await user.click(copy);
    const second = announced();
    expect(second).toHaveTextContent(/^Key copied: key for Hades$/);
    // A new node in the live region, so the repeated text is read again.
    expect(second).not.toBe(first);
    expect(copy).toHaveFocus();
    expect(copy).toHaveAccessibleName("Copied key for Hades");
  });

  // covers: spec 0010 AC-6
  it("resets the copy state when the key is hidden", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await revealHades(user);
    stubClipboard({ writeText: vi.fn(async () => undefined) });

    await user.click(
      screen.getByRole("button", { name: "Copy key for Hades" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Hide key for Hades" }),
    );
    act(() => vi.advanceTimersByTime(3000));
    await user.click(
      screen.getByRole("button", { name: "Reveal key for Hades" }),
    );

    expect(
      screen.getByRole("button", { name: "Copy key for Hades" }),
    ).toBeInTheDocument();
  });

  // covers: spec 0010 AC-9
  it.each([
    [
      "writeText rejects",
      { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
    ],
    ["the clipboard is missing", undefined],
  ])("selects the code and shows a hint when %s", async (_, clipboard) => {
    const user = userEvent.setup();
    await revealHades(user);
    stubClipboard(clipboard);

    await user.click(
      screen.getByRole("button", { name: "Copy key for Hades" }),
    );

    expect(window.getSelection()?.toString()).toBe("HADES-44444");
    expect(
      await screen.findByText(/^Key selected\. Press (Ctrl|Cmd)\+C to copy\.$/),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Hide key for Hades" }),
    );
    expect(screen.queryByText(/^Key selected/)).toBeNull();
  });

  // covers: spec 0010 AC-9
  it("drops the hint once a later copy succeeds", async () => {
    const user = userEvent.setup();
    await revealHades(user);
    stubClipboard({
      writeText: vi.fn(async () => Promise.reject(new Error("denied"))),
    });
    const copy = screen.getByRole("button", { name: "Copy key for Hades" });

    await user.click(copy);
    expect(await screen.findByText(/^Key selected/)).toBeInTheDocument();

    stubClipboard({ writeText: vi.fn(async () => undefined) });
    await user.click(copy);

    expect(copy).toHaveAccessibleName("Copied key for Hades");
    expect(screen.queryByText(/^Key selected/)).toBeNull();
  });
});

describe("keys cache lifetime", () => {
  // covers: spec 0010 AC-10
  it("drops the codes when the page unmounts", async () => {
    const user = userEvent.setup();
    const { keyRequests } = stubApi();
    const { router } = renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Reveal key for Hades" }),
    );
    await act(async () => {
      keyRequests[0].resolve(jsonResponse(200, { data: keys }));
    });
    await screen.findByText("HADES-44444");

    await act(() => router.navigate("/"));
    await waitFor(() =>
      expect(queryClient.getQueryData(orderKeysQueryKey(ULID))).toBeUndefined(),
    );
  });

  it("is removed on sign out and never refetched by an order invalidation", async () => {
    const user = userEvent.setup();
    const { keyRequests, keyCalls } = stubApi();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Reveal key for Hades" }),
    );
    await act(async () => {
      keyRequests[0].resolve(jsonResponse(200, { data: keys }));
    });
    await screen.findByText("HADES-44444");

    await act(() =>
      queryClient.invalidateQueries({ queryKey: orderQueryKey(ULID) }),
    );
    expect(keyCalls()).toBe(1);

    act(() => queryClient.removeQueries({ queryKey: ["me"] }));
    expect(queryClient.getQueryData(orderKeysQueryKey(ULID))).toBeUndefined();
  });
});
