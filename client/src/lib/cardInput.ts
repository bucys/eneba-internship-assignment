/** The four card fields, in form order (used to focus the first invalid one). */
export const CARD_FIELDS = [
  "card_number",
  "card_expiry",
  "card_cvc",
  "card_name",
] as const;

export type CardField = (typeof CARD_FIELDS)[number];

export type CardFormValues = Record<CardField, string>;

export type CardFieldErrors = Partial<Record<CardField, string>>;

// The server's messages (spec 0009 AC-3), so a client and a server error read the same.
export const CARD_MESSAGES: Record<CardField, string> = {
  card_number: "Enter a valid card number.",
  card_expiry: "Enter the expiry date as MM/YY.",
  card_cvc: "Enter the 3 or 4 digit security code.",
  card_name: "Enter the name on the card.",
};

const MAX_CARD_DIGITS = 19;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/** Digits in groups of four, at most 19 digits: "4242424242" → "4242 4242 42". */
export function formatCardNumber(value: string): string {
  const digits = digitsOnly(value).slice(0, MAX_CARD_DIGITS);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/**
 * Adds the slash once a digit follows the month: "122" → "12/2". Two digits stay "12",
 * so Backspace over the slash is never undone.
 */
export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length > 2
    ? `${digits.slice(0, 2)}/${digits.slice(2)}`
    : digits;
}

/**
 * Required fields and basic format only. Luhn, a past expiry, and declines are the server's call (AC-12).
 */
export function validateCardForm(values: CardFormValues): CardFieldErrors {
  const errors: CardFieldErrors = {};
  const number = values.card_number.replace(/[\s-]/g, "");

  if (!/^[0-9]{12,19}$/.test(number)) {
    errors.card_number = CARD_MESSAGES.card_number;
  }
  if (!/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(values.card_expiry)) {
    errors.card_expiry = CARD_MESSAGES.card_expiry;
  }
  if (!/^[0-9]{3,4}$/.test(values.card_cvc)) {
    errors.card_cvc = CARD_MESSAGES.card_cvc;
  }
  if (values.card_name.trim() === "") {
    errors.card_name = CARD_MESSAGES.card_name;
  }
  return errors;
}

export function firstInvalidField(
  errors: CardFieldErrors,
): CardField | undefined {
  return CARD_FIELDS.find((field) => errors[field] !== undefined);
}
