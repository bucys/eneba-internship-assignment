// @vitest-environment jsdom
import "../test/dom";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useDebouncedValue";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// covers: spec 0013 AC-7
it("updates only once the value has been stable for the delay", () => {
  const { result, rerender } = renderHook(
    ({ value }) => useDebouncedValue(value, 250),
    { initialProps: { value: "w" } },
  );

  rerender({ value: "wi" });
  act(() => vi.advanceTimersByTime(200));
  rerender({ value: "wit" });
  act(() => vi.advanceTimersByTime(200));
  expect(result.current).toBe("w");

  act(() => vi.advanceTimersByTime(50));
  expect(result.current).toBe("wit");
});
