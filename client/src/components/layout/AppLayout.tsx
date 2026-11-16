import type { MouseEvent } from "react";
import { Outlet, ScrollRestoration, useMatches } from "react-router";
import { useCartCount } from "../../lib/cart";
import { CartMergeToast } from "../cart/CartMergeToast";
import type { CheckoutStep } from "../checkout/Stepper";
import { ToastProvider } from "../ui/Toast";
import { CheckoutHeader } from "./CheckoutHeader";
import { Footer } from "./Footer";
import { Header } from "./Header";

const MAIN_ID = "main";

function focusMain(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  document.getElementById(MAIN_ID)?.focus();
}

function hasCheckoutStep(
  handle: unknown,
): handle is { checkoutStep: CheckoutStep } {
  return (
    typeof handle === "object" && handle !== null && "checkoutStep" in handle
  );
}

/** The deepest route's `handle.checkoutStep` (1 on /cart, 2 on /checkout), if any. */
function useCheckoutStep(): CheckoutStep | null {
  const matches = useMatches();
  const handle = matches.at(-1)?.handle;
  return hasCheckoutStep(handle) ? handle.checkoutStep : null;
}

export function AppLayout() {
  const cartCount = useCartCount();
  const checkoutStep = useCheckoutStep();

  return (
    <ToastProvider>
      <CartMergeToast />
      <div className="flex min-h-svh flex-col">
        <a
          href={`#${MAIN_ID}`}
          onClick={focusMain}
          className="sr-only rounded-sm bg-cta px-4 py-3 font-extrabold text-cta-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-30"
        >
          Skip to content
        </a>
        {checkoutStep === null ? (
          <Header cartCount={cartCount} />
        ) : (
          <CheckoutHeader step={checkoutStep} />
        )}
        <main id={MAIN_ID} tabIndex={-1} className="flex-1 outline-none">
          <Outlet />
        </main>
        <Footer />
      </div>
      <ScrollRestoration />
    </ToastProvider>
  );
}
