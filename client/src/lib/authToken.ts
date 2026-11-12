const STORAGE_KEY = "eneba.auth_token";

type Listener = () => void;

const listeners = new Set<Listener>();

// Storage can throw (private mode, blocked site data). Then the token lives in memory only.
function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string | null) {
  try {
    if (value === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    // Memory only, see readStored.
  }
}

let currentToken: string | null = readStored();

function notify() {
  listeners.forEach((listener) => listener());
}

/** The Bearer token, kept in memory and mirrored to localStorage. Read in React with useSyncExternalStore. */
export const authToken = {
  get(): string | null {
    return currentToken;
  },

  getSnapshot(): string | null {
    return currentToken;
  },

  set(token: string) {
    currentToken = token;
    writeStored(token);
    notify();
  },

  clear() {
    currentToken = null;
    writeStored(null);
    notify();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/**
 * Adopts token changes made in other tabs. It never writes storage back, so
 * two tabs can't loop. `onChange` runs before React is notified.
 */
export function startTokenStorageSync(
  onChange: (token: string | null) => void,
): () => void {
  function handleStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY && event.key !== null) {
      return;
    }
    const next = readStored();
    if (next === currentToken) {
      return;
    }
    currentToken = next;
    onChange(next);
    notify();
  }

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}
