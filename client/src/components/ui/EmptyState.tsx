import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  message: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-sm border border-surface px-6 py-12 text-center">
      <h2 className="text-xl font-extrabold">{title}</h2>
      <p className="max-w-prose text-sm text-fg-soft">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
