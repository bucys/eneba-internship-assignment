import {
  Gamepad,
  Gamepad2,
  Joystick,
  Monitor,
  Puzzle,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import {
  PLATFORM_LINKS,
  platformHref,
  type PlatformSlug,
} from "../../lib/platformLinks";
import { STORE_PATH } from "../../lib/storeParams";
import { Container } from "../layout/Container";

// Generic lucide icons, never brand logos (spec 0015 AC-7).
const PLATFORM_ICONS: Record<PlatformSlug, LucideIcon> = {
  steam: Monitor,
  playstation: Gamepad,
  xbox: Joystick,
  nintendo: Puzzle,
};

const SHORTCUTS: { label: string; to: string; Icon: LucideIcon }[] = [
  { label: "All games", to: STORE_PATH, Icon: Gamepad2 },
  ...PLATFORM_LINKS.map(({ slug, label }) => ({
    label,
    to: platformHref(slug),
    Icon: PLATFORM_ICONS[slug],
  })),
];

/** Icon plus label links into the store, right under the hero. */
export function PlatformShortcuts() {
  return (
    <Container className="py-6 md:py-8">
      <nav aria-label="Shop by platform">
        <ul className="-mx-2 flex overflow-x-auto [scrollbar-width:none] md:justify-center md:gap-6">
          {SHORTCUTS.map(({ label, to, Icon }) => (
            <li key={to} className="shrink-0">
              <Link
                to={to}
                className="flex min-h-11 min-w-22 flex-col items-center gap-2 rounded-sm px-2 py-2 text-sm font-semibold text-fg transition-colors hover:text-cta"
              >
                <Icon aria-hidden="true" className="size-8" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Container>
  );
}
