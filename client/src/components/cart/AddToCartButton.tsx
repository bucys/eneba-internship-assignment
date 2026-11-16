import { cartErrorMessage, useCartActions } from "../../lib/cart";
import { Button } from "../ui/Button";
import { useToast } from "../ui/toastContext";

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
  const { add, isPending } = useCartActions();
  const toast = useToast();

  async function handleClick() {
    try {
      const [adjustment] = await add(offerId, stock);
      toast.show({
        message: adjustment
          ? `Only ${adjustment.added} available, so we added ${adjustment.added}.`
          : "Added to cart.",
        variant: "success",
        action: { label: "View cart", to: "/cart" },
      });
    } catch (error) {
      toast.show({
        message: cartErrorMessage(
          error,
          "Could not add to cart. Please try again.",
        ),
        variant: "error",
      });
    }
  }

  return (
    <Button
      size={size}
      loading={isPending}
      onClick={() => void handleClick()}
      className={className}
    >
      Add to cart
      {context && <span className="sr-only"> {context}</span>}
    </Button>
  );
}
