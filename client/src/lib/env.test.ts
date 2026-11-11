import { afterEach, describe, expect, it, vi } from "vitest";

// env.ts reads the variable at import time, so each test stubs it and loads a fresh copy.
async function loadEnvWith(apiUrl: string) {
  vi.stubEnv("VITE_API_URL", apiUrl);
  vi.resetModules();
  const module = await import("./env");
  return module.env;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env", () => {
  // covers: AC-3
  it("reads the API base URL from VITE_API_URL", async () => {
    const env = await loadEnvWith("https://api.example.test");

    expect(env.apiUrl).toBe("https://api.example.test");
  });

  // covers: AC-3
  it("fails loudly at load time when VITE_API_URL is empty", async () => {
    vi.stubEnv("VITE_API_URL", "");
    vi.resetModules();

    await expect(import("./env")).rejects.toThrow("VITE_API_URL is not set");
  });

  it("removes a single trailing slash so paths join cleanly", async () => {
    const env = await loadEnvWith("http://localhost:8000/");

    expect(env.apiUrl).toBe("http://localhost:8000");
  });

  it("removes several trailing slashes", async () => {
    const env = await loadEnvWith("http://localhost:8000///");

    expect(env.apiUrl).toBe("http://localhost:8000");
  });

  it("keeps slashes inside the URL path", async () => {
    const env = await loadEnvWith("https://api.example.test/base/");

    expect(env.apiUrl).toBe("https://api.example.test/base");
  });
});
