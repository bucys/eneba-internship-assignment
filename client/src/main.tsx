import "./lib/env";
import "@fontsource/metropolis/400.css";
import "@fontsource/metropolis/600.css";
import "@fontsource/metropolis/800.css";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { setUnauthorizedHandler } from "./api/client";
import { createTokenSyncHandler, createUnauthorizedHandler } from "./lib/auth";
import { startTokenStorageSync } from "./lib/authToken";
import { queryClient } from "./lib/queryClient";
import { router } from "./router";

// Registered here, not in client.ts, so the API client never imports the router.
setUnauthorizedHandler(createUnauthorizedHandler(router));
startTokenStorageSync(createTokenSyncHandler(router));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
