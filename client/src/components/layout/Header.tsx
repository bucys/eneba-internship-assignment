import { LayoutGrid, ShoppingCart, User } from "lucide-react";
import { Link, useLocation } from "react-router";
import { cx } from "../../lib/cx";
import { useAuthToken, useMe } from "../../lib/auth";
import { STORE_PATH } from "../../lib/storeParams";
import { AccountMenu, AccountPlaceholder, AccountRetry } from "./AccountMenu";
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

const ICON_LINK_CLASSES =
  "relative inline-flex size-11 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface";

// The catalog entry at every width: an icon below md, icon plus label from md.
function StoreLink() {
  const isCurrent = useLocation().pathname === STORE_PATH;

  return (
    <Link
      to={STORE_PATH}
      aria-label="Store"
      aria-current={isCurrent ? "page" : undefined}
      className={cx(
        "inline-flex size-11 items-center justify-center gap-1.5 rounded-full transition-colors hover:bg-surface md:size-auto md:min-h-11 md:rounded-sm md:px-2 md:text-sm md:font-semibold md:hover:bg-transparent md:hover:text-cta",
        isCurrent ? "text-cta" : "text-fg",
      )}
    >
      <LayoutGrid aria-hidden="true" className="size-6" />
      <span className="hidden md:inline">Store</span>
    </Link>
  );
}

function SignInLink() {
  return (
    <Link
      to="/login"
      aria-label="Sign in"
      className="inline-flex size-11 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface md:size-auto md:min-h-11 md:rounded-sm md:px-2 md:text-sm md:font-semibold md:hover:bg-transparent md:hover:text-cta"
    >
      <User aria-hidden="true" className="size-6 md:hidden" />
      <span className="hidden md:inline">Sign in</span>
    </Link>
  );
}

// Signed out, checking a stored token, account unavailable, or signed in (spec 0006 AC-11).
function HeaderAccount() {
  const token = useAuthToken();
  const me = useMe();

  if (token === null) {
    return <SignInLink />;
  }
  if (me.data) {
    return <AccountMenu user={me.data} />;
  }
  if (me.isError && !me.isFetching) {
    return <AccountRetry onRetry={() => void me.refetch()} />;
  }
  return <AccountPlaceholder />;
}

export function Header({ cartCount = 0 }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-surface-deep bg-bg">
      <Container className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <Wordmark />

        <SearchForm className="order-last w-full md:order-0 md:w-auto md:flex-1" />

        <div className="ml-auto flex items-center gap-1 md:ml-0 md:gap-2">
          <StoreLink />

          <Link
            to="/cart"
            aria-label={cartLabel(cartCount)}
            className={ICON_LINK_CLASSES}
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

          <HeaderAccount />
        </div>
      </Container>
    </header>
  );
}
