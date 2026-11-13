import { describe, expect, it } from "vitest";
import {
  CARD_MESSAGES,
  firstInvalidField,
  formatCardNumber,
  formatExpiry,
  validateCardForm,
  type CardFormValues,
} from "./cardInput";

const VALID: CardFormValues = {
  card_number: "4242 4242 4242 4242",
  card_expiry: "12/30",
  card_cvc: "123",
  card_name: "Jane Buyer",
};

describe("formatCardNumber", () => {
  it.each([
    ["", ""],
    ["4242", "4242"],
    ["42424", "4242 4"],
    ["4242424242424242", "4242 4242 4242 4242"],
    ["4242-4242 abc 4242", "4242 4242 4242"],
    ["12345678901234567890123", "1234 5678 9012 3456 789"],
  ])("formats %j as %j", (input, expected) => {
    expect(formatCardNumber(input)).toBe(expected);
  });
});

describe("formatExpiry", () => {
  it.each([
    ["1", "1"],
    ["12", "12"],
    ["122", "12/2"],
    ["1227", "12/27"],
    ["12/27", "12/27"],
    ["12/279", "12/27"],
    ["ab", ""],
  ])("formats %j as %j", (input, expected) => {
    expect(formatExpiry(input)).toBe(expected);
  });
});

describe("validateCardForm", () => {
  it("accepts a valid form, including a 4 digit CVC", () => {
    expect(validateCardForm(VALID)).toEqual({});
    expect(validateCardForm({ ...VALID, card_cvc: "1234" })).toEqual({});
  });

  it.each([
    ["card_number", "4242 4242 424"],
    ["card_number", ""],
    ["card_expiry", "13/27"],
    ["card_expiry", "00/27"],
    ["card_expiry", "1/27"],
    ["card_cvc", "12"],
    ["card_cvc", "12345"],
    ["card_name", "   "],
  ] as const)("rejects %s %j with the server message", (field, value) => {
    expect(validateCardForm({ ...VALID, [field]: value })).toEqual({
      [field]: CARD_MESSAGES[field],
    });
  });

  it("leaves Luhn and a past expiry to the server", () => {
    expect(
      validateCardForm({
        ...VALID,
        card_number: "4242 4242 4242 4241",
        card_expiry: "01/20",
      }),
    ).toEqual({});
  });
});

describe("firstInvalidField", () => {
  it("returns the first invalid field in form order", () => {
    expect(firstInvalidField({ card_name: "x", card_expiry: "y" })).toBe(
      "card_expiry",
    );
    expect(firstInvalidField({})).toBeUndefined();
  });
});
