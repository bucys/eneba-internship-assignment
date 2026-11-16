import { Button } from "../ui/Button";
import { useAddToCart } from "./useAddToCart";

type AddToCartButtonProps = {
  offerId: number;
  stock: number;
  /** Added for screen readers only, for example "from KeyHub", so each offer's button has its own name. */
  context?: string;
  size?: "md" | "lg";
  className?: string;
};

export function AddToCartButton({
  offerId,
  stock,
  context,
  size = "md",
  className,
}: AddToCartButtonProps) {
  const { addToCart, isPending } = useAddToCart();

  return (
    <Button
      size={size}
      loading={isPending}
      onClick={() => void addToCart(offerId, stock)}
      className={className}
    >
      Add to cart
      {context && <span className="sr-only"> {context}</span>}
    </Button>
  );
}
