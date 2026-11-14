import { STORE_PATH } from "./storeParams";

/** Seeded platform slugs (spec 0004), matching the store `platform` param (spec 0012). */
export const PLATFORM_LINKS = [
  { slug: "steam", label: "Steam" },
  { slug: "playstation", label: "PlayStation" },
  { slug: "xbox", label: "Xbox" },
  { slug: "nintendo", label: "Nintendo" },
] as const;

export type PlatformSlug = (typeof PLATFORM_LINKS)[number]["slug"];

export function platformHref(slug: PlatformSlug): string {
  return `${STORE_PATH}?platform=${slug}`;
}
