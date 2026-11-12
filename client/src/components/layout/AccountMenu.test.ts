import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ToastContext } from "../ui/toastContext";
import { AccountRetry } from "./AccountMenu";

vi.mock("../../lib/env", () => ({
  env: { apiUrl: "https://api.example.test" },
}));

// No DOM test library is installed, so this checks the rendered markup;
// the clicks are covered by verify.md.
function renderAccountRetry() {
  const toast = { show: vi.fn(() => 1), dismiss: vi.fn() };
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(
        ToastContext.Provider,
        { value: toast },
        createElement(AccountRetry, { onRetry: () => {} }),
      ),
    ),
  );
}

describe("AccountRetry", () => {
  // covers: AC-11
  it("offers Retry and Sign out behind a collapsed account button", () => {
    const html = renderAccountRetry();

    expect(html).toContain('aria-label="Account unavailable"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/<button[^>]*>.*Retry<\/button>/);
    expect(html).toMatch(/<button[^>]*>.*Sign out<\/button>/);
  });
});
