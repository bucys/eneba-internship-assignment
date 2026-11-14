import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { STORE_PATH } from "../../lib/storeParams";

const linkClasses =
  "inline-flex min-h-11 items-center text-fg-soft transition-colors hover:text-cta";

/** Home › Store › product (spec 0015 AC-15). */
export function ProductBreadcrumb({ name }: { name: string }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 text-sm">
        <li>
          <Link to="/" className={linkClasses}>
            Home
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="size-4 text-fg-muted" />
        </li>
        <li>
          <Link to={STORE_PATH} className={linkClasses}>
            Store
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="size-4 text-fg-muted" />
        </li>
        <li className="min-w-0">
          <span aria-current="page" className="line-clamp-1 text-fg">
            {name}
          </span>
        </li>
      </ol>
    </nav>
  );
}
