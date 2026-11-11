import { ShoppingCart, User } from "lucide-react";
import { Link } from "react-router";
import { Container } from "./Container";
import { SearchForm } from "./SearchForm";
import { Wordmark } from "./Wordmark";

const MAX_BADGE_COUNT = 99;

type HeaderProps = {
  cartCount?: number;
};

function cartLabel(count: number) {
  return count === 1 ? "Cart, 1 item" : `Cart, ${count} items`;
}

function badgeText(count: number) {
  return count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(count);
}

const navLinkClasses =
  "inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-semibold text-fg transition-colors hover:text-cta";

export function Header({ cartCount = 0 }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-surface-deep bg-bg">
      <Container className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <Wordmark />

        <SearchForm className="order-last w-full md:order-none md:w-auto md:flex-1" />

        <nav aria-label="Primary" className="ml-auto md:ml-0">
          <Link to="/store" className={navLinkClasses}>
            Store
          </Link>
        </nav>

        <Link
          to="/cart"
          aria-label={cartLabel(cartCount)}
          className="relative inline-flex size-11 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface"
        >
          <ShoppingCart aria-hidden="true" className="size-6" />
          {cartCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-0.5 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-cta px-1 text-xs font-extrabold text-cta-fg"
            >
              {badgeText(cartCount)}
            </span>
          )}
        </Link>

        <Link
          to="/login"
          aria-label="Sign in"
          className="inline-flex size-11 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface md:size-auto md:min-h-11 md:rounded-sm md:px-2 md:text-sm md:font-semibold md:hover:bg-transparent md:hover:text-cta"
        >
          <User aria-hidden="true" className="size-6 md:hidden" />
          <span className="hidden md:inline">Sign in</span>
        </Link>
      </Container>
    </header>
  );
}
