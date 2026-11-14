// @vitest-environment jsdom
import "../../test/dom";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { Stepper } from "./Stepper";

function renderStepper(current: 1 | 2 | 3) {
  render(
    <MemoryRouter>
      <Stepper current={current} />
    </MemoryRouter>,
  );
  return within(screen.getByRole("list", { name: "Checkout progress" }));
}

describe("Stepper", () => {
  it("marks Cart current with no links on the cart", () => {
    const list = renderStepper(1);

    const steps = list.getAllByRole("listitem");
    expect(steps[0]).toHaveAttribute("aria-current", "step");
    expect(steps[0]).toHaveTextContent("Cart");
    expect(list.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links the completed Cart step back to the cart during payment", () => {
    const list = renderStepper(2);

    expect(list.getByRole("link", { name: "Cart, completed" })).toHaveAttribute(
      "href",
      "/cart",
    );
    expect(list.getAllByRole("listitem")[1]).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("shows Cart and Payment completed and Done current after paying", () => {
    const list = renderStepper(3);

    const steps = list.getAllByRole("listitem");
    expect(steps[0]).toHaveTextContent("Cart, completed");
    expect(steps[1]).toHaveTextContent("Payment, completed");
    expect(steps[2]).toHaveAttribute("aria-current", "step");
    expect(list.queryByRole("link")).not.toBeInTheDocument();
  });
});
