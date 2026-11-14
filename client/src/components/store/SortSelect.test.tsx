// @vitest-environment jsdom
import "../../test/dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { StoreSort } from "../../lib/storeParams";
import { SortSelect } from "./SortSelect";

vi.mock("../../lib/env", () => ({
  env: { apiUrl: "https://api.example.test" },
}));

function renderSort(value: StoreSort = "name", query = "") {
  const onChange = vi.fn();
  render(
    <>
      <SortSelect value={value} query={query} onChange={onChange} />
      <button type="button">Outside</button>
    </>,
  );
  const trigger = screen.getByRole("combobox", { name: /^Sort by/ });
  return { onChange, trigger, user: userEvent.setup() };
}

describe("SortSelect", () => {
  it("names the trigger with its label and current value, closed by default", () => {
    const { trigger } = renderSort("price_asc");

    expect(trigger).toHaveAccessibleName("Sort by Price: low to high");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("lists relevance only when there is a search", async () => {
    const { trigger, user } = renderSort("relevance", "witcher");
    await user.click(trigger);

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual([
      "Relevance",
      "Name: A to Z",
      "Price: low to high",
      "Price: high to low",
    ]);
  });

  it("marks the current sort as selected", async () => {
    const { trigger, user } = renderSort("price_desc");
    await user.click(trigger);

    expect(
      screen.getByRole("option", { name: "Price: high to low" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("option", { name: "Name: A to Z" }),
    ).toHaveAttribute("aria-selected", "false");
  });

  it("picks an option on click, closes, and keeps focus on the trigger", async () => {
    const { onChange, trigger, user } = renderSort();
    await user.click(trigger);
    await user.click(
      screen.getByRole("option", { name: "Price: low to high" }),
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith("price_asc");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("does not report a change when the current sort is picked again", async () => {
    const { onChange, trigger, user } = renderSort();
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Name: A to Z" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens on ArrowDown at the selected option, moves, and picks with Enter", async () => {
    const { onChange, trigger, user } = renderSort();
    trigger.focus();

    await user.keyboard("{ArrowDown}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Name: A to Z" }).id,
    );

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(trigger).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Price: high to low" }).id,
    );

    await user.keyboard("{ArrowUp}{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("price_asc");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens at the last option on End, jumps with Home, and picks with Space", async () => {
    const { onChange, trigger, user } = renderSort("price_asc", "witcher");
    trigger.focus();

    await user.keyboard("{End}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Price: high to low" }).id,
    );
    await user.keyboard("{Home} ");

    expect(onChange).toHaveBeenCalledExactlyOnceWith("relevance");
  });

  it("closes on Escape without changing the sort, focus stays on the trigger", async () => {
    const { onChange, trigger, user } = renderSort();
    trigger.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-activedescendant");
    expect(trigger).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes without a change on Tab and on a click outside", async () => {
    const { onChange, trigger, user } = renderSort();

    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await user.tab();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
  });
});
