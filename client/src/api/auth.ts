import { apiFetch } from "./client";

// Mirrors server/app/Http/Resources/UserResource.php.
export type User = {
  id: number;
  name: string;
  email: string;
};

// Mirrors server/app/Http/Resources/AuthTokenResource.php.
export type AuthSession = {
  token: string;
  user: User;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export async function register(input: RegisterInput): Promise<AuthSession> {
  const body = await apiFetch<{ data: AuthSession }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.data;
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const body = await apiFetch<{ data: AuthSession }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.data;
}

/** Revokes `token` on the server, even if the app has already moved on to another one. */
export function logout(token: string): Promise<void> {
  return apiFetch<void>("/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchMe(signal?: AbortSignal): Promise<User> {
  const body = await apiFetch<{ data: User }>("/auth/me", { signal });
  return body.data;
}
