import type { ReactNode } from "react";
import { Button } from "./Button";

type ErrorStateProps = {
  title?: string;
  message?: string;
} & (
  | { onRetry: () => void; action?: never }
  | { action: ReactNode; onRetry?: never }
);

/** Pass `onRetry` for the standard "Try again" button, or `action` to replace it. */
export function ErrorState({
  title = "Something went wrong",
  message = "Please try again in a moment.",
  onRetry,
  action,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-sm border border-surface px-6 py-12 text-center">
      <h2 className="text-xl font-extrabold">{title}</h2>
      <p className="max-w-prose text-sm text-fg-soft">{message}</p>
      <div className="mt-2">
        {action ?? (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
