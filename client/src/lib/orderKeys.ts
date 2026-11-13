import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../api/client";
import { orderKeysQuery } from "../api/orders";
import { secondsText } from "./format";

export type KeySlotState = "masked" | "pending" | "revealed";

/** One key slot on the page: the item it belongs to plus its position. */
export function keySlotId(orderItemId: number, index: number) {
  return `${orderItemId}:${index}`;
}

/** The inline message under the last clicked slot when the keys request fails (spec 0010 AC-7). */
export function keysErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 429) {
    return `Too many requests. Try again in ${secondsText(error.retryAfter ?? 60)}.`;
  }
  return "Could not load your key.";
}

/** What to tell the buyer when copying failed and the code is selected instead (spec 0010 AC-9). */
export function copyHint() {
  const isTouch =
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(pointer: coarse)").matches;
  if (isTouch) return "Key selected. Use your device's copy option.";

  const isApple = /Mac|iPhone|iPad/.test(navigator.userAgent);
  return `Key selected. Press ${isApple ? "Cmd" : "Ctrl"}+C to copy.`;
}

function withSlot(set: ReadonlySet<string>, slotId: string) {
  return new Set(set).add(slotId);
}

function withoutSlot(set: ReadonlySet<string>, slotId: string) {
  const next = new Set(set);
  next.delete(slotId);
  return next;
}

/** One key slot: the item it belongs to, its position, and its accessible name. */
export type KeySlotRef = {
  orderItemId: number;
  index: number;
  /** For example "key 2 of 3 for Hades". */
  label: string;
};

export const MISSING_KEY_MESSAGE =
  "This key could not be loaded. Try again or contact support.";

type Announcement = {
  /** Grows with every announcement, so a repeated text still mounts a new node. */
  id: number;
  text: string;
  /** Set for a Reveal, so the text waits until that slot actually shows its code. */
  slot?: KeySlotRef;
};

function idOf(slot: KeySlotRef) {
  return keySlotId(slot.orderItemId, slot.index);
}

/**
 * The order page's reveal state (spec 0010 AC-6, AC-7, AC-10). The keys request runs once,
 * on the first Reveal; a slot clicked while it runs waits for the same request.
 * Call it inside a component keyed by the order ULID, so another order starts fresh.
 */
export function useOrderKeys(ulid: string) {
  const [requested, setRequested] = useState(false);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement>({
    id: 0,
    text: "",
  });

  const query = useQuery({ ...orderKeysQuery(ulid), enabled: requested });
  const failed = query.isError && !query.isFetching;

  // Only this item's own code at this position, never another item's.
  function codeFor(slot: KeySlotRef) {
    return query.data?.find((entry) => entry.order_item_id === slot.orderItemId)
      ?.codes[slot.index];
  }

  function wantsCode(slotId: string) {
    return (
      revealed.has(slotId) || (pending.has(slotId) && query.data !== undefined)
    );
  }

  function slotState(slot: KeySlotRef): KeySlotState {
    const slotId = idOf(slot);
    if (wantsCode(slotId)) {
      if (codeFor(slot) !== undefined) return "revealed";
      // The response had no code for this slot: masked, and errorFor explains why.
      return query.isFetching ? "pending" : "masked";
    }
    if (pending.has(slotId) && !failed) return "pending";
    return "masked";
  }

  function announce(text: string, slot?: KeySlotRef) {
    setAnnouncement((current) => ({ id: current.id + 1, text, slot }));
  }

  function reveal(slot: KeySlotRef) {
    const slotId = idOf(slot);
    announce(`Key revealed: ${slot.label}`, slot);
    if (query.data) {
      setRevealed((current) => withSlot(current, slotId));
      if (codeFor(slot) === undefined) {
        // An incomplete response: ask the server again for this slot.
        setLastClicked(slotId);
        void query.refetch();
      }
      return;
    }

    setLastClicked(slotId);
    if (failed) {
      // A new attempt: only this slot waits for it.
      setPending(new Set([slotId]));
      void query.refetch();
      return;
    }

    setPending((current) => withSlot(current, slotId));
    setRequested(true);
  }

  function hide(slot: KeySlotRef) {
    const slotId = idOf(slot);
    setRevealed((current) => withoutSlot(current, slotId));
    setPending((current) => withoutSlot(current, slotId));
    announce(`Key hidden: ${slot.label}`);
  }

  function errorFor(slot: KeySlotRef) {
    if (slotState(slot) !== "masked") return undefined;
    const slotId = idOf(slot);
    if (failed && slotId === lastClicked) return keysErrorMessage(query.error);
    if (wantsCode(slotId)) return MISSING_KEY_MESSAGE;
    return undefined;
  }

  // Each Reveal and Hide names its slot, so a repeated action still changes the text
  // and gets announced. A Reveal that ends in an error stays quiet: the alert speaks.
  function statusText() {
    const { text, slot } = announcement;
    if (!slot) return text;
    const state = slotState(slot);
    if (state === "pending") return "Revealing keys…";
    return state === "revealed" ? text : "";
  }

  return {
    slotState,
    reveal,
    hide,
    codeFor,
    errorFor,
    statusText: statusText(),
    statusKey: announcement.id,
    announceCopied: (slot: KeySlotRef) => announce(`Key copied: ${slot.label}`),
  };
}

export type OrderKeysState = ReturnType<typeof useOrderKeys>;
