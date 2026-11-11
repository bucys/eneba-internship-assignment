import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { feedbackVariants, type FeedbackVariant } from "./feedbackVariants";

type AlertProps = {
  variant?: FeedbackVariant;
  role?: "alert" | "status";
  children: ReactNode;
};

export function Alert({ variant = "info", role, children }: AlertProps) {
  const { Icon, accent, border } = feedbackVariants[variant];
  const resolvedRole = role ?? (variant === "error" ? "alert" : "status");

  return (
    <div
      role={resolvedRole}
      className={cx(
        "flex items-start gap-3 rounded-sm border bg-surface p-4 text-sm text-fg",
        border,
      )}
    >
      <Icon aria-hidden="true" className={cx("size-5 shrink-0", accent)} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
