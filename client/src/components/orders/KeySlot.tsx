import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

// Mounted only while revealed, so Hide resets the copy state and clears the timer.
function RevealedKey({
  code,
  label,
  onCopied,
  initialCopyState = "idle",
}: RevealedKeyProps) {
  const [copyState, setCopyState] = useState<CopyState>(initialCopyState);
  const codeRef = useRef<HTMLElement>(null);
  const timerRef = useRef<number | undefined>(undefined);

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
    onCopied();
    timerRef.current = window.setTimeout(() => setCopyState("idle"), COPIED_MS);
  }

  const copied = copyState === "copied";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <code
          ref={codeRef}
          className="min-w-0 flex-1 font-mono text-base break-all text-fg select-text"
        >
          {code}
        </code>
        <Button
          variant="ghost"
          aria-label={`${copied ? "Copied" : "Copy"} ${label}`}
          onClick={() => void copy()}
        >
          <span className="inline-flex items-center gap-1.5">
            {copied ? (
              <Check aria-hidden="true" className="size-4 text-success" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </span>
        </Button>
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
              className="font-mono text-base text-fg-muted"
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
