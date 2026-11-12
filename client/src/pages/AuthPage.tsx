import { Clock, KeyRound, Tags, type LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  Form,
  Link,
  useActionData,
  useLocation,
  useNavigation,
  useSearchParams,
} from "react-router";
import { Container } from "../components/layout/Container";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { PasswordField } from "../components/ui/PasswordField";
import { TextField } from "../components/ui/TextField";
import { cx } from "../lib/cx";
import { useSlowPending } from "../lib/useSlowPending";
import type { AuthActionData, AuthField } from "./authActions";

type Mode = "login" | "register";

const FIELD_ORDER: Record<Mode, readonly AuthField[]> = {
  login: ["email", "password"],
  register: ["name", "email", "password"],
};

const fieldId = (field: AuthField) => `auth-${field}`;

type Benefit = { Icon: LucideIcon; title: string; text: string };

const BENEFITS: Benefit[] = [
  {
    Icon: KeyRound,
    title: "Your keys in one place",
    text: "Every key you buy stays in My orders, ready to copy again.",
  },
  {
    Icon: Tags,
    title: "Compare sellers, pay less",
    text: "Pick the best offer from several sellers for the same game.",
  },
  {
    Icon: Clock,
    title: "Stay signed in",
    text: "This device keeps you signed in for 7 days.",
  },
];

type AuthTabsProps = {
  mode: Mode;
  redirectTo: string | null;
};

function AuthTabs({ mode, redirectTo }: AuthTabsProps) {
  const search = redirectTo
    ? `?redirectTo=${encodeURIComponent(redirectTo)}`
    : "";
  const tabs = [
    { to: `/login${search}`, label: "Sign in", active: mode === "login" },
    {
      to: `/register${search}`,
      label: "Register",
      active: mode === "register",
    },
  ];

  return (
    <nav
      aria-label="Account"
      className="grid grid-cols-2 border-b border-surface-deep"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          to={tab.to}
          replace
          aria-current={tab.active ? "page" : undefined}
          className={cx(
            "-mb-px inline-flex min-h-11 items-center justify-center border-b-2 text-sm font-extrabold transition-colors",
            tab.active
              ? "border-cta text-fg"
              : "border-transparent text-fg-soft hover:text-fg",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function BenefitList() {
  return (
    <ul className="flex flex-col gap-5">
      {BENEFITS.map(({ Icon, title, text }) => (
        <li key={title} className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-cta">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-extrabold">{title}</p>
            <p className="text-sm text-fg-soft">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AuthPage() {
  const { pathname } = useLocation();
  const mode: Mode = pathname.startsWith("/register") ? "register" : "login";
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");
  const sessionExpired = searchParams.get("reason") === "expired";

  const actionData = useActionData() as AuthActionData | undefined;
  const fieldErrors = actionData?.fieldErrors ?? {};
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const slow = useSlowPending(submitting);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!actionData) return;
    const firstInvalid = FIELD_ORDER[mode].find(
      (field) => actionData.fieldErrors[field],
    );
    if (firstInvalid) {
      formRef.current
        ?.querySelector<HTMLInputElement>(`#${fieldId(firstInvalid)}`)
        ?.focus();
    }
  }, [actionData, mode]);

  const isRegister = mode === "register";

  return (
    <Container className="py-10 md:py-16">
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-start lg:gap-16">
        <section
          aria-label="Why create an account"
          className="order-last flex flex-col gap-6 md:order-none md:pt-14"
        >
          <p className="text-2xl font-extrabold md:text-3xl">
            Buy keys, keep them, find them again.
          </p>
          <BenefitList />
        </section>

        <div className="overflow-hidden rounded-sm bg-surface shadow-lg">
          <AuthTabs mode={mode} redirectTo={redirectTo} />

          <div className="flex flex-col gap-5 p-5 sm:p-8">
            <h1 className="text-2xl font-extrabold">
              {isRegister ? "Create account" : "Sign in"}
            </h1>

            {sessionExpired && (
              <Alert>Your session expired. Please sign in again.</Alert>
            )}
            {actionData?.formError && (
              <Alert variant="error">{actionData.formError}</Alert>
            )}
            {slow && (
              <Alert role="status">
                Waking up the server. The first visit after a quiet spell can
                take up to a minute.
              </Alert>
            )}

            <Form
              ref={formRef}
              method="post"
              noValidate
              className="flex flex-col gap-4"
            >
              {isRegister && (
                <TextField
                  id={fieldId("name")}
                  name="name"
                  label="Name"
                  autoComplete="name"
                  error={fieldErrors.name}
                />
              )}
              <TextField
                id={fieldId("email")}
                name="email"
                type="email"
                label="Email"
                autoComplete="email"
                error={fieldErrors.email}
              />
              <PasswordField
                // A new key after each failed attempt clears the typed password.
                key={actionData?.attempt ?? 0}
                id={fieldId("password")}
                name="password"
                label="Password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                hint={isRegister ? "At least 8 characters." : undefined}
                error={fieldErrors.password}
              />
              <Button
                type="submit"
                size="lg"
                loading={submitting}
                className="mt-2 w-full"
              >
                {isRegister ? "Create account" : "Sign in"}
              </Button>
            </Form>
          </div>
        </div>
      </div>
    </Container>
  );
}
