import { LoaderCircle } from "lucide-react";
import { cx } from "../../lib/cx";

type SpinnerProps = {
  className?: string;
};

export function Spinner({ className }: SpinnerProps) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cx("size-4 animate-spin", className)}
    />
  );
}
