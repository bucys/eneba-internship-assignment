import { cx } from "../../lib/cx";

export const labelClasses = "text-sm font-semibold text-fg-soft";
export const hintClasses = "text-xs text-fg-muted";
export const errorClasses = "text-sm text-danger";

export function controlClasses(hasError: boolean, className?: string) {
  return cx(
    "min-h-11 w-full rounded-sm border bg-surface px-3 text-sm text-fg transition-colors placeholder:text-fg-muted",
    hasError ? "border-danger" : "border-fg-muted hover:border-fg-soft",
    className,
  );
}

export function describedBy(...ids: Array<string | false | undefined>) {
  const joined = ids.filter(Boolean).join(" ");
  return joined === "" ? undefined : joined;
}
