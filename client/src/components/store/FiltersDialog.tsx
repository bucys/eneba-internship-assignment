import { SlidersHorizontal, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { resultCountLabel } from "../../lib/storeParams";
import { Button } from "../ui/Button";
import { buttonClasses } from "../ui/buttonClasses";

type FiltersButtonProps = {
  count: number;
  onClick?: () => void;
  ref?: Ref<HTMLButtonElement>;
  expanded?: boolean;
};

/** Opens the mobile filter dialog; the badge shows the number of active filter values. */
export function FiltersButton({
  count,
  onClick,
  ref,
  expanded,
}: FiltersButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `Filters, ${count} active` : undefined}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      className={buttonClasses("secondary", "md", "gap-2")}
    >
      <SlidersHorizontal aria-hidden="true" className="size-4" />
      Filters
      {count > 0 && (
        <span
          aria-hidden="true"
          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cta px-1 text-xs font-extrabold text-cta-fg"
        >
          {count}
        </span>
      )}
    </button>
  );
}

type FiltersDialogProps = {
  activeCount: number;
  total: number;
  children: ReactNode;
};

/**
 * Below lg the filter panel lives in a native modal dialog (spec 0012 AC-6). Every way of
 * closing goes through the native close event, which hands focus back to the Filters button.
 */
export function FiltersDialog({
  activeCount,
  total,
  children,
}: FiltersDialogProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    dialog.showModal();
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    return () => {
      root.style.overflow = previousOverflow;
    };
  }, [open]);

  function handleClose() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <>
      <FiltersButton
        ref={buttonRef}
        count={activeCount}
        expanded={open}
        onClick={() => setOpen(true)}
      />
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={handleClose}
        className="m-0 h-full max-h-none w-full max-w-none bg-bg p-0 text-fg backdrop:bg-black/60 sm:ml-auto sm:max-w-sm"
      >
        {open && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-surface-deep px-5 py-3">
              <h2 id={titleId} className="text-xl font-extrabold">
                Filters
              </h2>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => dialogRef.current?.close()}
                className="inline-flex size-11 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface"
              >
                <X aria-hidden="true" className="size-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            <div className="border-t border-surface-deep px-5 py-3">
              <Button
                className="w-full"
                onClick={() => dialogRef.current?.close()}
              >
                Show {resultCountLabel(total)}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
