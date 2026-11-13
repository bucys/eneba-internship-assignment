import type { Cart, CartLine } from "../api/cart";
import type { Order, OrderItem } from "../api/orders";

const eur = (amount: number) => ({ amount, currency: "EUR" as const });

export function cartLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    offer_id: 1,
    quantity: 1,
    max_quantity: 10,
    available: true,
    quantity_reduced: false,
    unit_price: eur(1999),
    line_total: eur(1999),
    seller: { name: "KeyHub" },
    product: {
      slug: "elden-ring",
      name: "Elden Ring",
      cover_image_url: "https://shared.steamstatic.com/elden.jpg",
      platform: { slug: "steam", name: "Steam" },
      region: { slug: "global", name: "Global" },
    },
    ...overrides,
  };
}

export function cart(lines: CartLine[], overrides: Partial<Cart> = {}): Cart {
  const total = lines.reduce(
    (sum, line) => sum + (line.line_total?.amount ?? 0),
    0,
  );
  return {
    lines,
    item_count: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: eur(total),
    can_checkout: lines.length > 0,
    ...overrides,
  };
}

export function orderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    product: {
      slug: "elden-ring",
      cover_image_url: "https://shared.steamstatic.com/elden.jpg",
    },
    product_name: "Elden Ring",
    platform_name: "Steam",
    region_name: "Global",
    seller_name: "KeyHub",
    quantity: 2,
    unit_price: eur(1999),
    line_total: eur(3998),
    ...overrides,
  };
}

export function order(overrides: Partial<Order> = {}): Order {
  return {
    ulid: "01jcheckoutorder0000000000",
    status: "paid",
    total: eur(3998),
    paid_at: "2026-11-13T10:24:51Z",
    items: [orderItem()],
    ...overrides,
  };
}

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
