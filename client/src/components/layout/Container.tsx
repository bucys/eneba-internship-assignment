import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cx("mx-auto w-full max-w-page px-5", className)}>
      {children}
    </div>
  );
}
