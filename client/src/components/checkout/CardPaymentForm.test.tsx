// @vitest-environment jsdom
import "../../test/dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CARD_MESSAGES } from "../../lib/cardInput";
import { CardPaymentForm } from "./CardPaymentForm";

type Props = Parameters<typeof CardPaymentForm>[0];

function renderForm(props: Partial<Props> = {}) {
  const onSubmit = vi.fn();
  const view = render(
    <CardPaymentForm
      onSubmit={onSubmit}
      pending={false}
      totalLabel="€19.99"
      {...props}
    />,
  );
  return { onSubmit, user: userEvent.setup(), ...view };
}

const field = {
  number: () => screen.getByLabelText("Card number"),
  expiry: () => screen.getByLabelText("Expiry"),
  cvc: () => screen.getByLabelText("CVC"),
  name: () => screen.getByLabelText("Name on card"),
};

async function fillValidCard(user: ReturnType<typeof userEvent.setup>) {
  await user.type(field.number(), "4242424242424242");
  await user.type(field.expiry(), "1229");
  await user.type(field.cvc(), "123");
  await user.type(field.name(), "Jane Buyer");
}

describe("CardPaymentForm", () => {
  // covers: AC-11
  it("groups the card number in fours and adds the expiry slash as you type", async () => {
    const { user } = renderForm();

    await user.type(field.number(), "4242424242424242");
    await user.type(field.expiry(), "1229");

    expect(field.number()).toHaveValue("4242 4242 4242 4242");
    expect(field.expiry()).toHaveValue("12/29");
  });

  it("keeps only digits in the CVC", async () => {
    const { user } = renderForm();

    await user.type(field.cvc(), "1a2b3");

    expect(field.cvc()).toHaveValue("123");
  });

  it("labels Pay with the total", () => {
    renderForm({ totalLabel: "€42.00" });

    expect(screen.getByRole("button", { name: "Pay €42.00" })).toBeEnabled();
  });

  // covers: AC-12
  it("shows four messages, focuses Card number, and sends nothing on an empty submit", async () => {
    const { onSubmit, user } = renderForm();

    await user.click(screen.getByRole("button", { name: /^Pay/ }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.number()).toHaveFocus();
    for (const message of Object.values(CARD_MESSAGES)) {
      expect(screen.getByText(message)).toBeInTheDocument();
    }
  });

  // covers: AC-17
  it("links each field error to its input with aria-describedby and aria-invalid", async () => {
    const { user } = renderForm();

    await user.click(screen.getByRole("button", { name: /^Pay/ }));

    expect(field.expiry()).toHaveAttribute("aria-invalid", "true");
    expect(field.expiry()).toHaveAccessibleDescription(
      CARD_MESSAGES.card_expiry,
    );
  });

  it("sends the typed values once the card passes the format checks", async () => {
    const { onSubmit, user } = renderForm();

    await fillValidCard(user);
    await user.click(screen.getByRole("button", { name: "Pay €19.99" }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      card_number: "4242 4242 4242 4242",
      card_expiry: "12/29",
      card_cvc: "123",
      card_name: "Jane Buyer",
    });
  });

  // covers: AC-17
  it("submits with Enter from a field", async () => {
    const { onSubmit, user } = renderForm();

    await fillValidCard(user);
    await user.type(field.name(), "{Enter}");

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  // covers: AC-12
  it("locks the fields and shows Processing payment while pending", () => {
    renderForm({ pending: true });

    expect(
      screen.getByRole("button", { name: /Processing payment/ }),
    ).toBeInTheDocument();
    expect(field.number()).toBeDisabled();
    expect(field.name()).toBeDisabled();
  });

  // covers: AC-12
  it("does not submit again while pending", async () => {
    const { onSubmit, user, rerender } = renderForm();
    await fillValidCard(user);

    rerender(
      <CardPaymentForm onSubmit={onSubmit} pending totalLabel="€19.99" />,
    );
    await user.click(
      screen.getByRole("button", { name: /Processing payment/ }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables Pay but keeps the fields editable while the cart refreshes", () => {
    renderForm({ disabled: true });

    expect(screen.getByRole("button", { name: "Pay €19.99" })).toBeDisabled();
    expect(field.number()).toBeEnabled();
  });

  // covers: AC-13
  it("shows a server field error under its field and focuses the first invalid one", () => {
    renderForm({
      fieldErrors: {
        card_expiry: "This card has expired.",
        card_number: "Enter a valid card number.",
      },
    });

    expect(field.number()).toHaveFocus();
    expect(field.expiry()).toHaveAccessibleDescription(
      "This card has expired.",
    );
  });

  // covers: AC-13
  it("shows a form error in an alert above Pay", () => {
    renderForm({ formError: "Your card was declined." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your card was declined.",
    );
  });
});
