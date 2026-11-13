import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { LinkButton } from "./Button";
import { buttonClasses } from "./buttonClasses";

type PaginationProps = {
  page: number;
  lastPage: number;
  hrefFor: (page: number) => string;
  /** The nav's accessible name, for example "Order pages". */
  label: string;
};

function PageLink({
  to,
  children,
}: {
  to: string | null;
  children: ReactNode;
}) {
  if (to === null) {
    return (
      <span
        aria-disabled="true"
        className={buttonClasses(
          "secondary",
          "md",
          "cursor-not-allowed gap-1 opacity-50",
        )}
      >
        {children}
      </span>
    );
  }
  return (
    <LinkButton to={to} variant="secondary" className="gap-1">
      {children}
    </LinkButton>
  );
}

/** Previous and Next links with "Page X of Y"; renders nothing for a single page. */
export function Pagination({
  page,
  lastPage,
  hrefFor,
  label,
}: PaginationProps) {
  if (lastPage <= 1) return null;

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3">
      <PageLink to={page > 1 ? hrefFor(page - 1) : null}>
        <ChevronLeft aria-hidden="true" className="size-4" />
        Previous
      </PageLink>
      <span className="text-sm text-fg-soft">
        Page {page} of {lastPage}
      </span>
      <PageLink to={page < lastPage ? hrefFor(page + 1) : null}>
        Next
        <ChevronRight aria-hidden="true" className="size-4" />
      </PageLink>
    </nav>
  );
}
