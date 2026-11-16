// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { Profiler } from "react";
import { describe, expect, it } from "vitest";
import { ScrollRail } from "./ScrollRail";

function setSize(
  list: HTMLElement,
  size: { scrollLeft: number; clientWidth: number; scrollWidth: number },
) {
  for (const [key, value] of Object.entries(size)) {
    Object.defineProperty(list, key, { configurable: true, value });
  }
}

function renderRail() {
  let commits = 0;
  render(
    <Profiler id="rail" onRender={() => (commits += 1)}>
      <ScrollRail label="best sellers">
        <li>One</li>
        <li>Two</li>
      </ScrollRail>
    </Profiler>,
  );
  return { list: screen.getByRole("list"), commits: () => commits };
}

describe("ScrollRail", () => {
  it("does not re-render on scroll events that leave the ends unchanged", () => {
    const { list, commits } = renderRail();
    setSize(list, { scrollLeft: 200, clientWidth: 400, scrollWidth: 1600 });
    fireEvent.scroll(list);
    const afterFirstChange = commits();

    for (const scrollLeft of [210, 300, 450, 600]) {
      setSize(list, { scrollLeft, clientWidth: 400, scrollWidth: 1600 });
      fireEvent.scroll(list);
    }

    expect(commits()).toBe(afterFirstChange);
  });

  it("re-renders when an end is reached", () => {
    const { list, commits } = renderRail();
    setSize(list, { scrollLeft: 200, clientWidth: 400, scrollWidth: 1600 });
    fireEvent.scroll(list);
    const before = commits();

    setSize(list, { scrollLeft: 1200, clientWidth: 400, scrollWidth: 1600 });
    fireEvent.scroll(list);

    expect(commits()).toBe(before + 1);
    expect(
      screen.getByRole("button", { name: "Scroll best sellers right" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: "Scroll best sellers left" }),
    ).toHaveAttribute("aria-disabled", "false");
  });
});
