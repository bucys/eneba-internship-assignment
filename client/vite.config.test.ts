import { describe, expect, it } from "vitest";
import type { ResolvedConfig } from "vite";
import { contentSecurityPolicy } from "./vite.config";

function buildPolicy(apiUrl: string): string {
  const plugin = contentSecurityPolicy() as {
    configResolved: (config: ResolvedConfig) => void;
    transformIndexHtml: () => { attrs: { content: string } }[];
  };
  plugin.configResolved({
    env: { VITE_API_URL: apiUrl },
  } as unknown as ResolvedConfig);
  return plugin.transformIndexHtml()[0].attrs.content;
}

function directive(policy: string, name: string): string[] {
  const entry = policy.split("; ").find((part) => part.startsWith(`${name} `));
  return entry ? entry.split(" ").slice(1) : [];
}

describe("contentSecurityPolicy", () => {
  it("allows images from the API origin for API-hosted banner art", () => {
    const policy = buildPolicy("https://api.example.test/some/path");

    expect(directive(policy, "img-src")).toEqual([
      "'self'",
      "https://shared.steamstatic.com",
      "https://api.example.test",
    ]);
  });

  it("keeps connect-src limited to self and the API origin", () => {
    const policy = buildPolicy("https://api.example.test");

    expect(directive(policy, "connect-src")).toEqual([
      "'self'",
      "https://api.example.test",
    ]);
  });
});
