import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { toAuthFormErrors } from "./authActions";

vi.mock("../lib/env", () => ({ env: { apiUrl: "https://api.example.test" } }));

function httpError(
  status: number,
  extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {},
) {
  return new ApiError({
    kind: "http",
    status,
    message: "Server message",
    ...extra,
  });
}

describe("toAuthFormErrors", () => {
  // covers: AC-8
  it("puts 422 errors under matching fields and the rest in the form alert", () => {
    const error = httpError(422, {
      errors: {
        email: ["These credentials do not match our records."],
        password: ["The password field is required."],
      },
    });

    expect(toAuthFormErrors(error, ["email"])).toEqual({
      fieldErrors: { email: "These credentials do not match our records." },
      formError: "The password field is required.",
    });
  });

  // covers: AC-8
  it.each([
    [42, "Too many attempts. Try again in 42 seconds."],
    [1, "Too many attempts. Try again in 1 second."],
    [undefined, "Too many attempts. Try again in 60 seconds."],
  ])("shows the 429 wait time for retryAfter %j", (retryAfter, message) => {
    expect(toAuthFormErrors(httpError(429, { retryAfter }), ["email"])).toEqual(
      {
        fieldErrors: {},
        formError: message,
      },
    );
  });

  // covers: AC-8
  it.each([
    httpError(500),
    httpError(403, { message: "Preview deployments are read only." }),
    new ApiError({
      kind: "network",
      status: 0,
      message: "Could not reach the server.",
    }),
    new ApiError({ kind: "timeout", status: 0, message: "Too slow." }),
  ])("shows the error message in the form alert for %o", (error) => {
    expect(toAuthFormErrors(error, ["email"])).toEqual({
      fieldErrors: {},
      formError: error.message,
    });
  });
});
