import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { cx } from "../../lib/cx";
import { copyHint, type KeySlotState } from "../../lib/orderKeys";
import { Button } from "../ui/Button";

export const KEY_MASK = "•••••-•••••-•••••";
const COPIED_MS = 2000;

export type CopyState = "idle" | "copied" | "fallback";

type RevealedKeyProps = {
  code: string;
  label: string;
  onCopied: () => void;
  /** Only for the /ui showcase. */
  initialCopyState?: CopyState;
};

/** Whether the element scrolls sideways, and whether text is still hidden past its right edge. */
function useHorizontalOverflow(ref: RefObject<HTMLElement | null>) {
  const [overflows, setOverflows] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const target = element;

    function measure() {
      const maxScroll = target.scrollWidth - target.clientWidth;
      setOverflows(maxScroll > 1);
      setHasMore(target.scrollLeft < maxScroll - 1);
    }

    measure();
    target.addEventListener("scroll", measure, { passive: true });
    // jsdom has no ResizeObserver.
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(target);
    return () => {
      target.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [ref]);

  return { overflows, hasMore };
}

// Mounted only while revealed, so Hide resets the copy state and clears the timer.
function RevealedKey({
  code,
  label,
  onCopied,
  initialCopyState = "idle",
}: RevealedKeyProps) {
  const [copyState, setCopyState] = useState<CopyState>(initialCopyState);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const { overflows, hasMore } = useHorizontalOverflow(codeRef);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  function selectCode() {
    const selection = window.getSelection();
    if (!codeRef.current || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(codeRef.current);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function copy() {
    window.clearTimeout(timerRef.current);
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(code);
    } catch {
      selectCode();
      setCopyState("fallback");
      return;
    }
    setCopyState("copied");
    setTooltipDismissed(false);
    onCopied();
    timerRef.current = window.setTimeout(() => setCopyState("idle"), COPIED_MS);
  }

  const copied = copyState === "copied";

  return (
    <>
      <div className="flex items-center gap-2">
        {/* The fade mask also clips the key's own outline, so this unmasked
            wrapper draws the focus ring instead. */}
        <div className="min-w-0 flex-1 outline-offset-2 outline-cta has-focus-visible:outline-2">
          {/* Focusable only when it scrolls, so keyboard users can scroll a long key. */}
          <code
            ref={codeRef}
            tabIndex={overflows ? 0 : undefined}
            className={cx(
              "block overflow-x-auto font-mono text-sm whitespace-nowrap text-fg outline-none select-text sm:text-base",
              hasMore && "mask-r-from-75%",
            )}
          >
            {code}
          </code>
        </div>
        <span
          className="group relative shrink-0"
          onMouseLeave={() => setTooltipDismissed(false)}
        >
          <Button
            variant="ghost"
            aria-label={`${copied ? "Copied" : "Copy"} ${label}`}
            onClick={() => void copy()}
            onKeyDown={(event) => {
              if (event.key === "Escape") setTooltipDismissed(true);
            }}
            onBlur={() => setTooltipDismissed(false)}
            className="peer"
          >
            {copied ? (
              <Check aria-hidden="true" className="size-4 text-success" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
          </Button>
          {/* Visual only: the button's name already says this. Shown on hover,
              keyboard focus, and while "Copied" lasts (touch has no hover). */}
          <span
            aria-hidden="true"
            data-testid="copy-tooltip"
            className={cx(
              "absolute right-0 bottom-full z-10 pb-1",
              tooltipDismissed && "hidden",
              !tooltipDismissed &&
                (copied
                  ? "block"
                  : "hidden group-hover:block peer-focus-visible:block"),
            )}
          >
            <span className="block rounded-sm bg-white px-2 py-1 text-xs font-bold whitespace-nowrap text-surface-deep shadow-lg">
              {copied ? "Copied" : "Copy"}
            </span>
          </span>
        </span>
      </div>
      {copyState === "fallback" && (
        <p className="text-sm text-fg-soft">{copyHint()}</p>
      )}
    </>
  );
}

type KeySlotProps = {
  /** For accessible names, for example "key 2 of 3 for Hades". */
  label: string;
  code?: string;
  state: KeySlotState;
  error?: string;
  onToggle: () => void;
  onRetry: () => void;
  onCopied: () => void;
  /** Only for the /ui showcase. */
  initialCopyState?: CopyState;
};

export function KeySlot({
  label,
  code,
  state,
  error,
  onToggle,
  onRetry,
  onCopied,
  initialCopyState,
}: KeySlotProps) {
  const isRevealed = state === "revealed" && code !== undefined;
  const isPending = state === "pending";

  let toggleText = "Reveal key";
  if (isPending) toggleText = "Revealing…";
  else if (isRevealed) toggleText = "Hide key";
  const toggleLabel = isPending
    ? `Revealing ${label}`
    : `${isRevealed ? "Hide" : "Reveal"} ${label}`;

  return (
    <li className="flex flex-col gap-2 rounded-sm bg-surface-deep p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          {isRevealed ? (
            <RevealedKey
              code={code}
              label={label}
              onCopied={onCopied}
              initialCopyState={initialCopyState}
            />
          ) : (
            <span
              role="img"
              aria-label="Key hidden"
              className="font-mono text-sm whitespace-nowrap text-fg-muted sm:text-base"
            >
              {KEY_MASK}
            </span>
          )}
        </div>
        <Button
          variant="secondary"
          loading={isPending}
          aria-label={toggleLabel}
          onClick={onToggle}
          className="self-start sm:self-auto"
        >
          {toggleText}
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-3 gap-y-1"
        >
          <p className="text-sm text-danger">{error}</p>
          <Button variant="ghost" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </li>
  );
}
