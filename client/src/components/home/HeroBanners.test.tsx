// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Banner } from "../../api/home";
import { FeaturedBanner } from "./FeaturedBanner";
import { HeroCompact, HeroSplit } from "./HeroBanners";

vi.mock("../../lib/env", () => ({
  env: { apiUrl: "https://api.example.test" },
}));

function banner(id: number, title: string): Banner {
  const slug = title.toLowerCase().replace(/\W+/g, "-");
  return {
    id,
    title,
    tagline: `${title} tagline`,
    cta_label: "Buy now",
    image_url: `https://img.example.test/banner-${id}.webp`,
    product: {
      slug,
      name: title,
      type: "game",
      cover_image_url: `https://img.example.test/cover-${id}.jpg`,
      platform: { slug: "steam", name: "Steam" },
      region: { slug: "global", name: "Global" },
      price: { amount: 1999, currency: "EUR" },
      list_price: null,
      discount_percent: null,
    },
  };
}

const BANNERS = [
  banner(1, "Cyberpunk 2077"),
  banner(2, "Elden Ring"),
  banner(3, "Hades"),
  banner(4, "Celeste"),
];

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("HeroSplit", () => {
  it("shows the first banner featured and the next two as side tiles", () => {
    renderWithRouter(<HeroSplit title="Featured" banners={BANNERS} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAccessibleName(/Cyberpunk 2077/);
    expect(links[0]).toHaveClass("col-span-2");
    expect(links[1]).toHaveAccessibleName(/Elden Ring/);
    expect(links[2]).toHaveAccessibleName(/Hades/);
    expect(screen.queryByText("Celeste")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Featured" })).toHaveClass(
      "sr-only",
    );
  });

  it("stretches a single side tile over both rows with two banners", () => {
    renderWithRouter(
      <HeroSplit title="Featured" banners={BANNERS.slice(0, 2)} />,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[1]).toHaveClass("row-span-2");
  });

  it("spans the featured slot across the full width with one banner", () => {
    renderWithRouter(
      <HeroSplit title="Featured" banners={BANNERS.slice(0, 1)} />,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveClass("col-span-3");
  });
});

describe("FeaturedBanner", () => {
  it("uses the banner art and keeps its text when the art fails", () => {
    const { container } = renderWithRouter(
      <FeaturedBanner banner={BANNERS[0]} />,
    );

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", BANNERS[0].image_url);
    expect(img).toHaveAttribute("alt", "");

    fireEvent.error(img as HTMLImageElement);

    expect(container.querySelector("img")).toBeNull();
    const link = screen.getByRole("link");
    expect(link).toHaveAccessibleName(/Cyberpunk 2077/);
    expect(link).toHaveAttribute("href", "/products/cyberpunk-2077");
    expect(screen.getByText("Buy now")).toBeInTheDocument();
  });

  it("shows the tagline only from xl, where it clears the art's subject", () => {
    renderWithRouter(<FeaturedBanner banner={BANNERS[0]} />);

    // jsdom applies no Tailwind CSS, so the breakpoint is checked through the classes.
    const tagline = screen.getByText("Cyberpunk 2077 tagline");
    expect(tagline).toHaveClass("hidden", "xl:line-clamp-2");
  });
});

describe("HeroCompact", () => {
  it("shows only the first banner as one link, with the featured art and no tagline", () => {
    const { container } = renderWithRouter(
      <HeroCompact title="Featured" banners={BANNERS} />,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/products/cyberpunk-2077");
    expect(links[0]).toHaveTextContent("Cyberpunk 2077");
    expect(links[0]).toHaveTextContent("Buy now");
    expect(screen.queryByText("Cyberpunk 2077 tagline")).toBeNull();

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", BANNERS[0].image_url);
    expect(images[0]).toHaveAttribute("alt", "");
    expect(images[0]).toHaveAttribute("loading", "eager");
    expect(images[0]).toHaveAttribute("fetchpriority", "high");
  });

  it("has no carousel controls", () => {
    renderWithRouter(<HeroCompact title="Featured" banners={BANNERS} />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows the price with its discount when there is one", () => {
    const discounted: Banner = {
      ...BANNERS[0],
      product: {
        ...BANNERS[0].product,
        list_price: { amount: 5999, currency: "EUR" },
        discount_percent: 66,
      },
    };
    renderWithRouter(<HeroCompact title="Featured" banners={[discounted]} />);

    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("€19.99");
    expect(link).toHaveTextContent("€59.99");
    expect(link).toHaveTextContent("-66%");
  });

  it("drops the art on a load error and keeps the text and link", () => {
    const { container } = renderWithRouter(
      <HeroCompact title="Featured" banners={BANNERS} />,
    );

    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).toBeNull();
    const link = screen.getByRole("link");
    expect(link).toHaveAccessibleName(/Cyberpunk 2077/);
    expect(link).toHaveAttribute("href", "/products/cyberpunk-2077");
  });
});
