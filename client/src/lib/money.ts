export type Money = { amount: number; currency: "EUR" };

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: Money["currency"]) {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-IE", { style: "currency", currency });
    formatters.set(currency, formatter);
  }
  return formatter;
}

// `amount` is integer cents. Dividing by 100 happens only here, at display time.
export function formatPrice(money: Money): string {
  return formatterFor(money.currency).format(money.amount / 100);
}
