import {
  ChevronDown,
  LogOut,
  Package,
  RotateCw,
  User,
  UserX,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router";
import type { User as AuthUser } from "../../api/auth";
import { signOut } from "../../lib/auth";
import { cx } from "../../lib/cx";
import { useToast } from "../ui/toastContext";

const itemClasses =
  "flex min-h-11 w-full items-center gap-2 rounded-sm px-3 text-left text-sm font-semibold text-fg transition-colors hover:bg-surface-deep";

type AccountMenuProps = {
  user: AuthUser;
};

export function AccountMenu({ user }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  function handleSignOut() {
    signOut();
    setOpen(false);
    void navigate("/");
    toast.show({ message: "You're signed out.", variant: "success" });
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={user.name}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-11 items-center justify-center gap-1.5 rounded-full text-fg transition-colors hover:bg-surface md:size-auto md:min-h-11 md:max-w-48 md:rounded-sm md:px-2 md:text-sm md:font-semibold md:hover:bg-transparent md:hover:text-cta"
      >
        <User aria-hidden="true" className="size-6 shrink-0" />
        <span className="hidden truncate md:inline">{user.name}</span>
        <ChevronDown
          aria-hidden="true"
          className={cx(
            "hidden size-4 shrink-0 transition-transform md:block",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 z-20 mt-1 w-56 max-w-[calc(100vw-2.5rem)] rounded-sm border border-surface-deep bg-surface p-1 shadow-lg"
      >
        <p className="truncate px-3 pt-2 pb-1 text-xs text-fg-muted">
          {user.email}
        </p>
        <Link
          to="/orders"
          onClick={() => setOpen(false)}
          className={itemClasses}
        >
          <Package aria-hidden="true" className="size-4" />
          My orders
        </Link>
        <button type="button" onClick={handleSignOut} className={itemClasses}>
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

type AccountRetryProps = {
  onRetry: () => void;
};

/**
 * Shown when /me failed for a reason other than 401 (server down), so the header is never
 * stuck loading. A disclosure like AccountMenu, offering Retry and Sign out (spec 0006 AC-11).
 */
export function AccountRetry({ onRetry }: AccountRetryProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  function handleRetry() {
    setOpen(false);
    onRetry();
  }

  function handleSignOut() {
    signOut();
    setOpen(false);
    void navigate("/");
    toast.show({ message: "You're signed out.", variant: "success" });
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account unavailable"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-11 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface hover:text-fg"
      >
        <UserX aria-hidden="true" className="size-6" />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 z-20 mt-1 w-56 max-w-[calc(100vw-2.5rem)] rounded-sm border border-surface-deep bg-surface p-1 shadow-lg"
      >
        <p className="px-3 pt-2 pb-1 text-xs text-fg-muted">
          We couldn't load your account.
        </p>
        <button type="button" onClick={handleRetry} className={itemClasses}>
          <RotateCw aria-hidden="true" className="size-4" />
          Retry
        </button>
        <button type="button" onClick={handleSignOut} className={itemClasses}>
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

/** The header's neutral stand in while the stored token is being checked. */
export function AccountPlaceholder() {
  return (
    <span
      role="img"
      aria-label="Loading account"
      className="inline-flex size-11 items-center justify-center rounded-full text-fg-muted"
    >
      <User aria-hidden="true" className="size-6 animate-pulse" />
    </span>
  );
}
