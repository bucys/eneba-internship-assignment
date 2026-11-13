// Imported by component tests that opt into jsdom with `// @vitest-environment jsdom`.
// Vitest globals are off, so Testing Library cannot register its own cleanup.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
