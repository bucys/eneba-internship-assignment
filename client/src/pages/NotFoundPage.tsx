import { Container } from "../components/layout/Container";
import { LinkButton } from "../components/ui/Button";

export function NotFoundPage() {
  return (
    <Container className="flex flex-col items-start gap-4 py-16">
      <p className="text-sm font-semibold text-fg-soft">404</p>
      <h1 className="text-2xl font-extrabold md:text-3xl">Page not found</h1>
      <p className="text-fg-soft">
        This page does not exist or is not built yet.
      </p>
      <LinkButton to="/" className="mt-2">
        Go to homepage
      </LinkButton>
    </Container>
  );
}
