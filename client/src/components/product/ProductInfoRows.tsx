import { Gamepad2, Globe, KeyRound, type LucideIcon } from "lucide-react";
import type { ProductDetail } from "../../api/products";

type InfoRow = { Icon: LucideIcon; title: string; text: string };

/** Three facts built only from real data, no other claims (spec 0015 AC-17). */
export function ProductInfoRows({ product }: { product: ProductDetail }) {
  const rows: InfoRow[] = [
    {
      Icon: Gamepad2,
      title: product.platform.name,
      text: `Activate on ${product.platform.name}`,
    },
    {
      Icon: Globe,
      title: product.region.name,
      text: `${product.region.name} key`,
    },
    {
      Icon: KeyRound,
      title: "Digital key",
      text: "Revealed on your order page right after payment",
    },
  ];

  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {rows.map(({ Icon, title, text }) => (
        <li key={title + text} className="flex items-start gap-3">
          <Icon
            aria-hidden="true"
            className="mt-0.5 size-6 shrink-0 text-accent"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-extrabold text-fg">{title}</span>
            <span className="text-sm text-fg-soft">{text}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
