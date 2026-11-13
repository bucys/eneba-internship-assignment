import type { MouseEvent } from "react";
import { Outlet, ScrollRestoration } from "react-router";
import { useCartCount } from "../../lib/cart";
import { ToastProvider } from "../ui/Toast";
import { Footer } from "./Footer";
import { Header } from "./Header";

const MAIN_ID = "main";

function focusMain(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  document.getElementById(MAIN_ID)?.focus();
}

export function AppLayout() {
  const cartCount = useCartCount();

  return (
    <ToastProvider>
      <div className="flex min-h-svh flex-col">
        <a
          href={`#${MAIN_ID}`}
          onClick={focusMain}
          className="sr-only rounded-sm bg-cta px-4 py-3 font-extrabold text-cta-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-30"
        >
          Skip to content
        </a>
        <Header cartCount={cartCount} />
        <main id={MAIN_ID} tabIndex={-1} className="flex-1 outline-none">
          <Outlet />
        </main>
        <Footer />
      </div>
      <ScrollRestoration />
    </ToastProvider>
  );
}
