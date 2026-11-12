const FALLBACK = "/";
const AUTH_PATHS = new Set(["/login", "/register"]);

// Control characters, whitespace and backslashes let browsers read "/\evil.com" or "/\t/evil.com" as another host.
// oxlint-disable-next-line no-control-regex
const UNSAFE_CHARACTERS = /[\u0000- \u007f\\]/;

function hasUnsafeCharacters(value: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return true;
  }
  return (
    UNSAFE_CHARACTERS.test(value) ||
    UNSAFE_CHARACTERS.test(decoded) ||
    decoded.startsWith("//")
  );
}

/** Returns a same origin path plus search to go to after sign in, or "/" for anything unsafe. */
export function safeRedirect(
  value: string | null | undefined,
  origin: string = window.location.origin,
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    hasUnsafeCharacters(value)
  ) {
    return FALLBACK;
  }

  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return FALLBACK;
  }

  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (url.origin !== origin || AUTH_PATHS.has(path)) {
    return FALLBACK;
  }

  return url.pathname + url.search;
}

/** Builds the sign in URL that returns to `path` (path plus search, no hash) afterward. */
export function loginPath(path: string, { expired = false } = {}): string {
  const reason = expired ? "&reason=expired" : "";
  return `/login?redirectTo=${encodeURIComponent(path)}${reason}`;
}
