# 0003. Rationale: Eneba design system and UI foundation

Decision record for [index.md](index.md). `/develop` builds from `index.md`; this file explains why.

## Context

The assignment grades "Eneba styling" directly: colors, typography, spacing, and components should follow eneba.com (`docs/reference/Eneba Internship Assignment.pdf`). Every journey (purchase, discovery, landing) shows the same header, prices, product cards, buttons, and form fields. Without one shared foundation, each feature would invent its own button and price format, the look would drift, and fixing it later would touch every page.

Spec 0001 already picked Tailwind CSS for styling with "Eneba tokens in the theme", and React Router in library mode, but neither is installed yet. The client is still the Vite starter screen. The scope commits to "accessibility basics from day one" and a 3 to 4 day build budget, and the developer must be able to explain every line in review.

Eneba's own site has no CSS variables. Its colors are hardcoded hex values in compiled CSS, it uses a 10px root font size trick, and a few of its color pairs (pink discount text, red error text on purple) fail WCAG AA contrast. So "copy Eneba" and "accessible" are in tension for a handful of values.

Money arrives from the API as integer cents (client `AGENTS.md`), and the discount percent is a server derived value whose rounding is pinned in feature 15 (spec 0002). Anything the UI shows about price has to respect both.

## Options considered

### Option 1: Tailwind v4 theme tokens plus hand built components

Put Eneba's values in a Tailwind v4 `@theme` block in CSS, and write small React components on native elements (`<button>`, `<input>`, `<select>`, `<a>`), with ARIA wired by hand (basis: spec 0001 styling choice; the installed `tailwind-css-patterns` skill).

**Pros**:
- No new runtime library beyond what spec 0001 already chose. Every line is plain React and Tailwind.
- Native elements carry most keyboard and screen reader behavior for free.
- Tokens become utilities (`bg-surface`) automatically in v4, with no JS config file.

**Cons**:
- Complex widgets (combobox, dialog with focus trap) must be built by hand when needed.
- No ready made component docs, so `design.md` has to be written.

### Option 2: Headless library (React Aria Components or Radix) plus Tailwind

Same tokens, but interactive components come from a headless (unstyled) accessibility library, styled with Tailwind.

**Pros**:
- Focus management, keyboard handling, and ARIA for menus, dialogs, and comboboxes are battle tested.
- The search combobox in feature 14 would come almost for free.

**Cons**:
- A sizable dependency with its own API and concepts to learn and explain in review.
- Most of this feature's components (button, input, card, price) gain nothing from it.

### Option 3: shadcn/ui

Copy styled Radix based components into the repo with the shadcn CLI, then restyle them to Eneba.

**Pros**:
- Fastest way to get many polished components.
- The code lives in the repo, so it can be edited.

**Cons**:
- Ships its own visual language and token naming, which you would fight to reach the Eneba look.
- Pulls in Radix, `class-variance-authority`, and a CLI workflow. It needs explicit approval under your global rules, and it is the hardest option to explain line by line.

### Option 4: CSS Modules with CSS variables, no Tailwind

Plain CSS custom properties for tokens and a `.module.css` per component.

**Pros**:
- Closest to how Eneba's own CSS works. No build plugin.

**Cons**:
- Contradicts the accepted spec 0001 styling decision.
- More files per component and slower iteration than utilities.

## Rationale

Option 1 fits the two forces that matter most here: the developer must explain every line, and the budget is 3 to 4 days. The components this feature needs are mostly static (button, input, card, price, layout), where native HTML already provides the accessibility a headless library would add. The one place that would truly benefit (the search combobox) is a single widget in feature 14, and writing it by hand to the WAI-ARIA pattern is a stronger review story than importing it. It also honors spec 0001's accepted Tailwind choice instead of reopening it.

Fidelity follows the assignment ("matches eneba.com"): tokens were read from eneba.com's live CSS, not guessed, and the engineer chose a close match. Where Eneba fails contrast, only the failing pairs were lightened (pink discount text to `#ed8ea8`, red error text to `#f68a9f`) and the original hues were kept as fills where they pass with dark or white text. This keeps the scope's "accessibility from day one" promise at the smallest visible cost.

Smaller calls made in the design conversation (engineer's picks): dark theme only, as Eneba has no light theme. Metropolis self hosted via Fontsource (Unlicense, no third party request). lucide-react icons, already in the default stack. Tailwind's default breakpoints with Eneba's 1240px container, because the visual difference from Eneba's 600, 930, and 1200 breakpoints is negligible and standard names are easier to explain. A text wordmark instead of Eneba's logo file, to avoid hosting a trademark publicly. A whole card link with no buy button, because seller comparison belongs on the product page. A yellow `focus-visible` ring. CSS transitions instead of Framer Motion. Unit tests for pure logic only (Alpha tier).

Calls made while writing the spec (runner up in brackets): the root font size stays 16px so Tailwind's default type scale matches Eneba's pixel sizes exactly and user font scaling works [copy Eneba's 62.5% root, which breaks every Tailwind rem value]. The discount percent comes from the server and is never computed in the client, so the store and deals block cannot disagree [a client helper, dropped from the test list for this reason]. React Router data mode (`createBrowserRouter` with a layout route) so the 404 page and dev only lazy route are simple [declarative `<Routes>`]. A 3:4 card image ratio as one constant until seed images exist [square]. The product path `/products/<slug>` [`/p/<slug>`]. A toast built on React context with a 4 second lifetime for info and success (paused on hover or focus), error toasts that stay until dismissed (WCAG 2.2.1), and a cap of 3 [a toast library]. A cross check on a second model (Sonnet) then closed 13 smaller gaps (button sizes, cart as a link, price edge cases, grid columns, headings, favicon) and fixed a contrast contradiction: `danger-bg` was listed as an error border at 2.3 to 2.9:1, so error borders use `danger` instead.

## References

**Project sources**:
- `docs/reference/Eneba Internship Assignment.pdf`, the "Eneba styling" requirement
- Spec 0001 (Tailwind with Eneba tokens, React Router library mode, Vitest)
- Spec 0002 (money in integer cents, `list_price_cents`, server derived discount, unique product `slug`, `cover_image_url`)
- `client/AGENTS.md` (money formatting with `Intl.NumberFormat`, test conventions)
- `docs/scope/scope.md` feature 4 and the "accessibility basics from day one" scope decision
- Installed skill `tailwind-css-patterns`

**Practices & standards**:
- WCAG 2.1 AA contrast (1.4.3 text 4.5:1, 1.4.11 non text 3:1), focus visible (2.4.7), bypass blocks (2.4.1)
- WAI-ARIA Authoring Practices: combobox pattern (for feature 14), live regions for toasts
- Native HTML controls before ARIA ("first rule of ARIA")
- `prefers-reduced-motion`

**Links** (web verified on 2026-11-11 during the design study):
- eneba.com home: https://www.eneba.com/
- eneba.com store (product card markup): https://www.eneba.com/store
- Tailwind CSS theme variables: https://tailwindcss.com/docs/theme
- Tailwind CSS with Vite: https://tailwindcss.com/docs/installation/using-vite
- Fontsource Metropolis: https://fontsource.org/fonts/metropolis
- `@fontsource/metropolis` on npm (Unlicense): https://registry.npmjs.org/@fontsource/metropolis

### Evidence: eneba.com token study (2026-11-11)

Read with curl from eneba.com's HTML and its compiled CSS (`main.*.css`, home chunk). Counts are occurrences in the main CSS.

| Hex | Count | Observed role |
|---|---|---|
| `#ffffff` | 117 | body text |
| `#fad318` | 91 | buy button background, black text |
| `#351183` | 43 | surfaces |
| `#b3aac9` | 41 | secondary text |
| `#23c299` | 31 | success green |
| `#4618ac` | 28 | body and sticky header background |
| `#5825cc` | 19 | panels |
| `#e76a8c` | 17 | discount and old price pink |
| `#f0a613` | 17 | orange (role inferred) |
| `#dcd8e6` | 15 | labels |
| `#1f0a4d` | 12 | footer and nav background, header border |
| `#d32252`, `#eb002e` | 7, 3 | error red |
| `#3ddcb3` | 6 | price text (inferred from class) |
| `#c5b1f1` | 5 | link like text |

Typography: Metropolis woff2 at weights 400, 600, 800 (78, 44, 41 uses for 800, 600, 400), fallback Arial and Helvetica. Root `font-size: 62.5%`, body 1.6rem. Common sizes 1.2, 1.4, 1.6, 2, 2.4rem (12 to 24px). Container `max-width: calc(1200px + 40px)` with 20px padding. Breakpoints 600, 930, 1200. Transitions 150ms ease in out. Header: sticky, logo, search (placeholder "Search for games, top-ups and more"), settings, wishlist, cart, log in. Store card: image, title, region, "From", struck through price, discount badge, bold price.

Not verified: rendered screenshots, hover and focus colors, footer layout, store grid column count.

Contrast measured for the decision (on `#4618ac` page, `#351183` surface, `#5825cc` panel):

| Text | Page | Surface | Panel |
|---|---|---|---|
| `#ffffff` | 10.6 | 13.5 | 8.2 |
| `#dcd8e6` | 7.6 | 9.6 | 5.9 |
| `#b3aac9` | 4.8 | 6.1 | 3.7 (fails) |
| `#c5b1f1` | 5.5 | 7.0 | 4.3 (fails) |
| `#fad318` | 7.3 | 9.2 | 5.6 |
| `#3ddcb3` | 6.1 | 7.8 | 4.7 |
| `#e76a8c` | 3.4 (fails) | 4.4 (fails) | 2.7 (fails) |
| `#ed8ea8` (adjusted) | 4.6 | 5.8 | 3.5 (fails) |
| `#eb002e` | 2.3 (fails) | 2.9 (fails) | 1.8 (fails) |
| `#f68a9f` (adjusted) | 4.6 | 5.8 | 3.6 (fails) |

Fills: black on `#fad318` 14.4, black on `#e76a8c` 6.8, white on `#eb002e` 4.6.
