import { createBrowserRouter, type RouteObject } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";

// `import.meta.env.DEV` is checked directly (not through lib/env.ts) so Vite
// replaces it with `false` in production and drops the showcase chunk entirely.
const devOnlyRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: "ui",
        lazy: async () => ({
          Component: (await import("./pages/UiShowcasePage")).UiShowcasePage,
        }),
      },
    ]
  : [];

export const router = createBrowserRouter([
  {
    Component: AppLayout,
    children: [
      { index: true, Component: HomePage },
      ...devOnlyRoutes,
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
