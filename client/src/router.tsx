import { createBrowserRouter, type RouteObject } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { redirectIfSignedIn, requireAuth } from "./lib/auth";
import { AuthPage } from "./pages/AuthPage";
import { loginAction, registerAction } from "./pages/authActions";
import { CartPage } from "./pages/CartPage";
import {
  CheckoutErrorBoundary,
  CheckoutPlaceholderPage,
} from "./pages/CheckoutPlaceholderPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import {
  OrdersErrorBoundary,
  OrdersPlaceholderPage,
} from "./pages/OrdersPlaceholderPage";
import { ProductPage } from "./pages/ProductPage";
import { RouteHydrateFallback } from "./pages/RouteHydrateFallback";

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
    HydrateFallback: RouteHydrateFallback,
    children: [
      { index: true, Component: HomePage },
      { path: "products/:slug", Component: ProductPage },
      { path: "cart", Component: CartPage },
      {
        path: "checkout",
        Component: CheckoutPlaceholderPage,
        ErrorBoundary: CheckoutErrorBoundary,
        loader: ({ request }) => requireAuth(request),
        handle: { requiresAuth: true },
      },
      {
        path: "login",
        Component: AuthPage,
        loader: ({ request }) => redirectIfSignedIn(request),
        action: loginAction,
      },
      {
        path: "register",
        Component: AuthPage,
        loader: ({ request }) => redirectIfSignedIn(request),
        action: registerAction,
      },
      {
        path: "orders",
        Component: OrdersPlaceholderPage,
        ErrorBoundary: OrdersErrorBoundary,
        loader: ({ request }) => requireAuth(request),
        handle: { requiresAuth: true },
      },
      ...devOnlyRoutes,
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
