import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Cover art host fixed by spec 0004 (CatalogSeeder).
const PRODUCT_IMAGE_ORIGIN = "https://shared.steamstatic.com";

// Production only: dev needs an inline React Refresh script that this policy would block.
// It is a <meta> tag because the API origin comes from VITE_API_URL at build time.
// img-src includes the API origin: banner art is served from the API's public/images.
export function contentSecurityPolicy(): Plugin {
  let apiOrigin = "";
  return {
    name: "content-security-policy",
    apply: "build",
    configResolved(config) {
      const apiUrl = config.env.VITE_API_URL;
      if (!apiUrl) {
        throw new Error(
          "VITE_API_URL is not set, so the CSP has no API origin.",
        );
      }
      apiOrigin = new URL(apiUrl).origin;
    },
    transformIndexHtml() {
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        `img-src 'self' ${PRODUCT_IMAGE_ORIGIN} ${apiOrigin}`,
        "font-src 'self'",
        `connect-src 'self' ${apiOrigin}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ");
      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: policy },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
});
