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
import {
  createTokenSyncHandler,
  createUnauthorizedHandler,
  onAfterSignIn,
} from "./lib/auth";
import { authToken, startTokenStorageSync } from "./lib/authToken";
import { mergeGuestCartAndNotify } from "./lib/cartMergeNotice";
import { guestCart, startGuestCartStorageSync } from "./lib/guestCart";
import { queryClient } from "./lib/queryClient";
import { router } from "./router";

// Registered here, not in client.ts, so the API client never imports the router.
setUnauthorizedHandler(createUnauthorizedHandler(router));
startTokenStorageSync(createTokenSyncHandler(router));
startGuestCartStorageSync();

// The guest cart merges into the account on sign in, or on start if a token and guest lines
// both exist (an earlier merge failed). A failed merge keeps the lines for next time.
onAfterSignIn(mergeGuestCartAndNotify);
if (authToken.get() !== null && guestCart.get().length > 0) {
  mergeGuestCartAndNotify().catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
