// @vitest-environment jsdom
import "../../test/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfferList } from "./OfferList";

vi.mock("../../lib/env", () => ({
  env: { apiUrl: "https://api.example.test" },
}));

describe("OfferList", () => {
  it("is the #offers jump target with no scroll margin of its own", () => {
    render(<OfferList offers={[]} bestOfferId={null} />);

    const section = screen.getByRole("region", { name: "All offers" });
    expect(section).toHaveAttribute("id", "offers");
    // html scroll-padding-top already clears the sticky header; a scroll-mt would add to it.
    expect(section.className).not.toMatch(/scroll-m/);
  });
});
