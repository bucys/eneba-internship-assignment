import { env } from "../lib/env";

export type ApiErrorKind = "http" | "network" | "timeout";

type ApiErrorInit = {
  kind: ApiErrorKind;
  status: number;
  message: string;
  errors?: Record<string, string[]>;
};

// `status` is 0 for network and timeout failures, which never got a response.
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly errors?: Record<string, string[]>;

  constructor({ kind, status, message, errors }: ApiErrorInit) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.errors = errors;
  }
}

export type Paginated<T> = {
  data: T[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

// Outlasts a Render free plan cold start (about one minute).
export const API_TIMEOUT_MS = 90_000;

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

type LaravelErrorBody = {
  message?: unknown;
  errors?: unknown;
};

async function toHttpError(response: Response): Promise<ApiError> {
  let body: LaravelErrorBody = {};
  try {
    body = (await response.json()) as LaravelErrorBody;
  } catch {
    // Not JSON (for example a proxy's HTML 502 page): keep the generic message.
  }

  return new ApiError({
    kind: "http",
    status: response.status,
    message:
      typeof body.message === "string" && body.message !== ""
        ? body.message
        : GENERIC_ERROR_MESSAGE,
    errors:
      typeof body.errors === "object" && body.errors !== null
        ? (body.errors as Record<string, string[]>)
        : undefined,
  });
}

/** Calls `${env.apiUrl}/api/v1${path}`, for example `apiFetch("/products")`. */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined && init.body !== null) {
    headers.set("Content-Type", "application/json");
  }

  const timeoutSignal = AbortSignal.timeout(API_TIMEOUT_MS);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}/api/v1${path}`, {
      ...init,
      headers,
      signal,
    });
  } catch (error) {
    // TanStack Query's own cancel: rethrow untouched so it is not treated as a failure.
    if (init.signal?.aborted) {
      throw error;
    }
    if (timeoutSignal.aborted) {
      throw new ApiError({
        kind: "timeout",
        status: 0,
        message: "The server took too long to answer. Please try again.",
      });
    }
    throw new ApiError({
      kind: "network",
      status: 0,
      message: "Could not reach the server. Check your connection.",
    });
  }

  if (!response.ok) {
    throw await toHttpError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
