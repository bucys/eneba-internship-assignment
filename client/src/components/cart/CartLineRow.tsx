import { Trash2 } from "lucide-react";
import { Link } from "react-router";
import type { CartLine } from "../../api/cart";
import { cartErrorMessage, useCartActions } from "../../lib/cart";
import { cx } from "../../lib/cx";
import { formatPrice } from "../../lib/money";
import { CoverImage } from "../product/CoverImage";
import { Price } from "../product/Price";
import { useToast } from "../ui/toastContext";
import { QuantityStepper } from "./QuantityStepper";

const UPDATE_ERROR = "Could not update your cart. Please try again.";

type CartLineRowProps = {
  line: CartLine;
  onRemoveStart: () => void;
  onRemoveFail: () => void;
};

export function CartLineRow({
  line,
  onRemoveStart,
  onRemoveFail,
}: CartLineRowProps) {
  const { setQuantity, remove, isPending } = useCartActions();
  const toast = useToast();
  const { product, available } = line;

  async function handleQuantity(quantity: number) {
    try {
      await setQuantity(line.offer_id, quantity, line.max_quantity);
    } catch (error) {
      toast.show({
        message: cartErrorMessage(error, UPDATE_ERROR),
        variant: "error",
      });
    }
  }

  async function handleRemove() {
    onRemoveStart();
    try {
      await remove(line.offer_id);
      toast.show({ message: "Removed from cart.", variant: "success" });
    } catch (error) {
      onRemoveFail();
      toast.show({
        message: cartErrorMessage(error, UPDATE_ERROR),
        variant: "error",
      });
    }
  }

  return (
    <li className="flex gap-4 rounded-sm bg-surface p-4">
      <div className="w-16 shrink-0 self-start md:w-20">
        <CoverImage url={product.cover_image_url} alt="" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Link
            to={`/products/${product.slug}`}
            className={cx(
              "font-semibold wrap-break-word transition-colors hover:text-cta",
              available ? "text-fg" : "text-fg-muted",
            )}
          >
            {product.name}
          </Link>
          <span className="text-sm text-fg-muted">
            {product.platform.name} · {product.region.name}
          </span>
          <span className="text-sm text-fg-soft">
            Sold by{" "}
            <span className="font-semibold text-fg">{line.seller.name}</span>
          </span>
          {line.quantity_reduced && (
            <p className="text-sm text-fg-soft">
              Only {line.max_quantity} available, so we lowered the quantity.
            </p>
          )}
          {!available && (
            <p className="text-sm font-semibold text-fg-soft">
              No longer available
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {available ? (
            <QuantityStepper
              value={line.quantity}
              max={line.max_quantity}
              itemName={product.name}
              disabled={isPending}
              onChange={(quantity) => void handleQuantity(quantity)}
            />
          ) : (
            <span />
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex flex-col items-end">
              {line.line_total && (
                <Price price={line.line_total} className="items-end" />
              )}
              <span className="text-xs text-fg-muted">
                {formatPrice(line.unit_price)} each
              </span>
            </div>
            <button
              type="button"
              aria-label={`Remove ${product.name}`}
              data-cart-remove
              aria-disabled={isPending || undefined}
              onClick={() => !isPending && void handleRemove()}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-fg-soft transition-colors hover:bg-surface-deep hover:text-fg aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              <Trash2 aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
