import type { OrderItem } from "../../api/orders";
import {
  keySlotId,
  type KeySlotRef,
  type OrderKeysState,
} from "../../lib/orderKeys";
import { KeySlot } from "./KeySlot";

type OrderKeysProps = {
  item: OrderItem;
  keys: OrderKeysState;
};

export function OrderKeys({ item, keys }: OrderKeysProps) {
  // One slot per purchased unit, so a short keys response shows an error, never fewer slots.
  const count = item.quantity;
  const redeemText =
    count > 1
      ? `Redeem these keys on ${item.platform_name}.`
      : `Redeem this key on ${item.platform_name}.`;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <ul
        aria-label={`Keys for ${item.product_name}`}
        className="flex flex-col gap-2"
      >
        {Array.from({ length: count }, (_, index) => {
          const slot: KeySlotRef = {
            orderItemId: item.id,
            index,
            label:
              count > 1
                ? `key ${index + 1} of ${count} for ${item.product_name}`
                : `key for ${item.product_name}`,
          };
          const state = keys.slotState(slot);

          return (
            <KeySlot
              key={keySlotId(item.id, index)}
              label={slot.label}
              code={keys.codeFor(slot)}
              state={state}
              error={keys.errorFor(slot)}
              onToggle={() =>
                state === "revealed" ? keys.hide(slot) : keys.reveal(slot)
              }
              onRetry={() => keys.reveal(slot)}
              onCopied={() => keys.announceCopied(slot)}
            />
          );
        })}
      </ul>
      <p className="text-sm text-fg-soft">{redeemText}</p>
    </div>
  );
}
