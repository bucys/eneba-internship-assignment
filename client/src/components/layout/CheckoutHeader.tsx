import type { CheckoutStep } from "../checkout/Stepper";
import { Stepper } from "../checkout/Stepper";
import { Container } from "./Container";
import { Wordmark } from "./Wordmark";

type CheckoutHeaderProps = {
  step: CheckoutStep;
};

/** The focused cart and checkout header: wordmark and progress only (spec 0015 AC-18). */
export function CheckoutHeader({ step }: CheckoutHeaderProps) {
  return (
    // data-header lets index.css set --header-h to this one row height at every width.
    <header
      data-header="checkout"
      className="sticky top-0 z-10 border-b border-surface-deep bg-bg"
    >
      <Container className="flex items-center justify-between gap-4 py-3">
        <Wordmark />
        <Stepper current={step} />
      </Container>
    </header>
  );
}
