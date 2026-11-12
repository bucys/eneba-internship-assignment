import type { Cart, CartLineInput } from "../api/cart";
import { MAX_LINES, MAX_LINE_QUANTITY } from "./cartLimits";

const STORAGE_KEY = "eneba.guestCart";
const VERSION = 1;

type Listener = () => void;

/** A guest cart rule that blocked a change, with the same message and field the server uses (spec 0008 AC-3). */
export class GuestCartError extends Error {
  readonly field: "offer_id" | "quantity";

  constructor(field: "offer_id" | "quantity", message: string) {
    super(message);
    this.name = "GuestCartError";
    this.field = field;
  }
}

function isValidLine(value: unknown): value is CartLineInput {
  if (typeof value !== "object" || value === null) return false;
  const { offer_id, quantity } = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(offer_id) &&
    (offer_id as number) >= 1 &&
    Number.isInteger(quantity) &&
    (quantity as number) >= 1 &&
    (quantity as number) <= MAX_LINE_QUANTITY
  );
}

/** Bad JSON or an unknown version reads as empty; invalid and repeated lines are dropped. */
export function parseGuestCart(raw: string | null): CartLineInput[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const { version, lines } = parsed as Record<string, unknown>;
  if (version !== VERSION || !Array.isArray(lines)) return [];

  const seen = new Set<number>();
  const result: CartLineInput[] = [];
  for (const line of lines) {
    if (!isValidLine(line) || seen.has(line.offer_id)) continue;
    seen.add(line.offer_id);
    result.push({ offer_id: line.offer_id, quantity: line.quantity });
  }
  return result.slice(0, MAX_LINES);
}

// Storage can throw (private mode, blocked site data). Then the cart lives in memory for this tab.
function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(lines: CartLineInput[]) {
  try {
    if (lines.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: VERSION, lines }),
      );
    }
  } catch {
    // Memory only, see readStored.
  }
}

export function sameLines(a: CartLineInput[], b: CartLineInput[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (line, i) =>
        line.offer_id === b[i].offer_id && line.quantity === b[i].quantity,
    )
  );
}

const listeners = new Set<Listener>();
let current: CartLineInput[] = parseGuestCart(readStored());

function commit(next: CartLineInput[]) {
  current = next;
  writeStored(next);
  listeners.forEach((listener) => listener());
}

/** The guest cart, kept in memory and mirrored to localStorage. Read in React with useSyncExternalStore. */
export const guestCart = {
  get(): CartLineInput[] {
    return current;
  },

  getSnapshot(): CartLineInput[] {
    return current;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Adds one, capped at min(stock, 10); throws GuestCartError like the server would. */
  add(offerId: number, stock: number) {
    const cap = Math.min(stock, MAX_LINE_QUANTITY);
    if (cap <= 0) {
      throw new GuestCartError("offer_id", "This offer is out of stock.");
    }
    const existing = current.find((line) => line.offer_id === offerId);
    if (existing) {
      if (existing.quantity >= cap) {
        throw new GuestCartError(
          "quantity",
          "You already have the maximum for this offer.",
        );
      }
      commit(
        current.map((line) =>
          line.offer_id === offerId
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        ),
      );
      return;
    }
    if (current.length >= MAX_LINES) {
      throw new GuestCartError("offer_id", "Your cart is full.");
    }
    commit([...current, { offer_id: offerId, quantity: 1 }]);
  },

  /** Sets a quantity, kept between 1 and min(cap, 10). Does nothing for a missing line. */
  setQuantity(offerId: number, quantity: number, cap: number) {
    const next = Math.max(1, Math.min(quantity, cap, MAX_LINE_QUANTITY));
    if (!current.some((line) => line.offer_id === offerId)) return;
    commit(
      current.map((line) =>
        line.offer_id === offerId ? { ...line, quantity: next } : line,
      ),
    );
  },

  remove(offerId: number) {
    if (!current.some((line) => line.offer_id === offerId)) return;
    commit(current.filter((line) => line.offer_id !== offerId));
  },

  replace(lines: CartLineInput[]) {
    commit(lines);
  },

  clear() {
    commit([]);
  },

  /** After a merge: drops each sent line only if its offer and quantity are still what was sent. */
  removeSent(sent: CartLineInput[]) {
    const next = current.filter(
      (line) =>
        !sent.some(
          (s) => s.offer_id === line.offer_id && s.quantity === line.quantity,
        ),
    );
    if (next.length !== current.length) commit(next);
  },

  /**
   * After a preview: drops lines whose offer is gone and writes back reduced quantities,
   * but only when storage still holds what that request sent (a newer edit wins).
   */
  reconcileWithPreview(sent: CartLineInput[], cart: Cart) {
    if (!sameLines(current, sent)) return;
    const byOffer = new Map(cart.lines.map((line) => [line.offer_id, line]));
    const next: CartLineInput[] = [];
    for (const line of sent) {
      const previewLine = byOffer.get(line.offer_id);
      if (!previewLine) continue;
      next.push(
        previewLine.available && previewLine.quantity_reduced
          ? { ...line, quantity: previewLine.quantity }
          : line,
      );
    }
    if (!sameLines(next, current)) commit(next);
  },
};

/** Adopts guest cart changes made in other tabs. It never writes storage back, so tabs can't loop. */
export function startGuestCartStorageSync(): () => void {
  function handleStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    const next = parseGuestCart(readStored());
    if (sameLines(next, current)) return;
    current = next;
    listeners.forEach((listener) => listener());
  }

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}
