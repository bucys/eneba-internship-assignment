import { Link } from "react-router";
import { Container } from "./Container";

const footerLinkClasses =
  "inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-link transition-colors hover:text-fg";

export function Footer() {
  return (
    <footer className="mt-16 bg-surface-deep">
      <Container className="flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xl font-extrabold lowercase">eneba</span>
          <p className="max-w-prose text-sm text-fg-muted">
            Demo project for an internship assignment. Not affiliated with
            Eneba. No real payments.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex gap-6">
            <li>
              <Link to="/store" className={footerLinkClasses}>
                Store
              </Link>
            </li>
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
