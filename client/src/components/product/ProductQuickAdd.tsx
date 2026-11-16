import { ShoppingCartPlus } from "lucide-react";
import { cx } from "../../lib/cx";
import { useQuickAddToCart } from "../cart/useAddToCart";
import { Button, LinkButton } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

type QuickAddProps = {
  slug: string;
  name: string;
  className?: string;
};

/** Round cart plus icon button, pinned over the card's bottom right corner. */
export function QuickAddIconButton({ slug, name, className }: QuickAddProps) {
  const { quickAdd, isPending } = useQuickAddToCart(slug);

  return (
    <button
      type="button"
      aria-label={`Add ${name} to cart`}
      aria-busy={isPending || undefined}
      aria-disabled={isPending || undefined}
      onClick={() => {
        if (!isPending) void quickAdd();
      }}
      className={cx(
        "absolute right-3 bottom-3 inline-flex size-11 items-center justify-center rounded-full bg-cta text-cta-fg transition-colors hover:bg-cta-hover",
        isPending && "cursor-wait",
        className,
      )}
    >
      {isPending ? (
        <Spinner />
      ) : (
        <ShoppingCartPlus aria-hidden="true" className="size-5" />
      )}
    </button>
  );
}

/** Add to cart plus View offers, stacked under the card body. */
export function QuickAddActions({ slug, name, className }: QuickAddProps) {
  const { quickAdd, isPending } = useQuickAddToCart(slug);

  return (
    <div className={cx("flex flex-col gap-2 px-3 pb-3", className)}>
      {/* aria-label, because Button's flex wrapper makes Chromium add a space before a hidden span. */}
      <Button
        loading={isPending}
        aria-label={`Add to cart, ${name}`}
        onClick={() => void quickAdd()}
      >
        Add to cart
      </Button>
      <LinkButton variant="secondary" to={`/products/${slug}#offers`}>
        View offers <span className="sr-only">for {name}</span>
      </LinkButton>
    </div>
  );
}
