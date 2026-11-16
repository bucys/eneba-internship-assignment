import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { productQuery } from "../../api/products";
import { cartErrorMessage, useCartActions } from "../../lib/cart";
import { useToast } from "../ui/toastContext";

const ADD_FAILED = "Could not add to cart. Please try again.";

/** Adds one offer and reports the outcome in a toast (spec 0016 AC-12). */
export function useAddToCart() {
  const { add, isPending } = useCartActions();
  const toast = useToast();

  async function addToCart(offerId: number, stock: number) {
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
        message: cartErrorMessage(error, ADD_FAILED),
        variant: "error",
      });
    }
  }

  return { addToCart, isPending };
}

/**
 * Adds a product's best offer from a card. The list has no offer ids, so this reads the
 * product detail first: its `best_offer_id` is the cheapest offer in stock, the one the
 * product page buys and the card's "From" price shows.
 */
export function useQuickAddToCart(slug: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { addToCart, isPending } = useAddToCart();
  const [isResolving, setIsResolving] = useState(false);

  async function quickAdd() {
    setIsResolving(true);
    try {
      const { data } = await queryClient.fetchQuery(productQuery(slug));
      const offer = data.offers.find((o) => o.id === data.best_offer_id);
      if (!offer) {
        toast.show({
          message: "This product is out of stock.",
          variant: "error",
        });
        return;
      }
      await addToCart(offer.id, offer.stock);
    } catch (error) {
      toast.show({
        message: cartErrorMessage(error, ADD_FAILED),
        variant: "error",
      });
    } finally {
      setIsResolving(false);
    }
  }

  return { quickAdd, isPending: isResolving || isPending };
}
