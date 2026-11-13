import { redirect, type ActionFunctionArgs } from "react-router";
import { login, register } from "../api/auth";
import { ApiError } from "../api/client";
import { completeSignIn } from "../lib/auth";
import { secondsText } from "../lib/format";

export type AuthField = "name" | "email" | "password";

export type AuthFormErrors = {
  fieldErrors: Partial<Record<AuthField, string>>;
  formError?: string;
};

export type AuthActionData = AuthFormErrors & {
  /** Bumped on every failed submit, so the page can clear the password and move focus. */
  attempt: number;
};

/** Splits an API error into inline field errors and one form alert. */
export function toAuthFormErrors(
  error: ApiError,
  fields: readonly AuthField[],
): AuthFormErrors {
  if (error.status === 429) {
    return {
      fieldErrors: {},
      formError: `Too many attempts. Try again in ${secondsText(error.retryAfter ?? 60)}.`,
    };
  }

  if (error.status !== 422 || !error.errors) {
    return { fieldErrors: {}, formError: error.message };
  }

  const fieldErrors: AuthFormErrors["fieldErrors"] = {};
  const otherMessages: string[] = [];
  for (const [key, messages] of Object.entries(error.errors)) {
    const message = messages[0];
    if (message === undefined) continue;
    if ((fields as readonly string[]).includes(key)) {
      fieldErrors[key as AuthField] = message;
    } else {
      otherMessages.push(message);
    }
  }

  return {
    fieldErrors,
    formError: otherMessages.length > 0 ? otherMessages.join(" ") : undefined,
  };
}

let attempt = 0;

function readField(formData: FormData, name: AuthField): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function submitAuth(
  request: Request,
  fields: readonly AuthField[],
  send: (formData: FormData) => ReturnType<typeof login>,
): Promise<Response | AuthActionData> {
  const formData = await request.formData();
  const redirectTo = new URL(request.url).searchParams.get("redirectTo");

  try {
    const session = await send(formData);
    return redirect(await completeSignIn(session, redirectTo));
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    attempt += 1;
    return { ...toAuthFormErrors(error, fields), attempt };
  }
}

const LOGIN_FIELDS = ["email", "password"] as const;
const REGISTER_FIELDS = ["name", "email", "password"] as const;

export function loginAction({ request }: ActionFunctionArgs) {
  return submitAuth(request, LOGIN_FIELDS, (formData) =>
    login({
      email: readField(formData, "email"),
      password: readField(formData, "password"),
    }),
  );
}

export function registerAction({ request }: ActionFunctionArgs) {
  return submitAuth(request, REGISTER_FIELDS, (formData) =>
    register({
      name: readField(formData, "name"),
      email: readField(formData, "email"),
      password: readField(formData, "password"),
    }),
  );
}
