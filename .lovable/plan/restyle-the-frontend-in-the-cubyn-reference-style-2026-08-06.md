# Restyle the frontend in the Cubyn reference style

Goal: make CubynDev look like the reference site (cubynf.lovable.app) — calm, editorial, high-craft, mostly monochrome surfaces with thin hairline borders — while keeping the existing neo-green + black palette exactly as-is. No color token changes.

## What changes visually

**Hero (home)**
- Left-aligned instead of centered, on a tall quiet section with a faint grid texture instead of the glow blob and floating particles.
- Small pill eyebrow with a dot ("FREE RESOURCES · VIP FROM ₱99/MONTH"), uppercase, tracked, muted.
- Two-line headline: first line in full foreground, second line dimmed — big, tight leading, display font.
- One-paragraph subcopy, then two buttons on the left: solid primary CTA with arrow, and a quiet outlined secondary.
- Stats move out of glass cards into a slim inline row under the buttons.

**Feature strip**
- Four flat columns separated by hairline rules: bare icon, small bold title, two lines of muted copy. No glass cards, no icon chips, no rounded panels.

**Sections**
- Consistent header pattern: title on the left, one-line muted description beneath, "View all →" aligned right.
- Generous vertical rhythm, sections separated by hairline top borders rather than floating cards.
- Pricing keeps both plans but flattens: bordered panels, no glow ring, green reserved for the VIP accent and checkmarks.

**Cards (resources)**
- Flatter: thin border, subtle surface, square-ish corners, no lift/glow on hover — just a border and title color shift.
- Tier badge stays (VIP / Free) but as a small text pill, with the meta row (MC version, downloads) as quiet single-line text and a "View details →" affordance.

**Header**
- Slimmer, centered nav pill group, transparent until scroll then a thin border with a soft blur. "Sign in" as text link, "Sign up" as compact solid button.

**Footer**
- Same structure, lighter treatment: hairline top border, plain background instead of glass.

## Scope

- `src/routes/index.tsx` — full home layout rework.
- `src/components/SiteHeader.tsx`, `SiteFooter.tsx`, `ResourceCard.tsx` — shared shell restyle, which carries the new look onto every page.
- `src/routes/resources.index.tsx` — page header + filter chrome aligned to the flatter style.
- `src/styles.css` — add a few presentation utilities (hairline rule, grid backdrop, flat surface) and soften the body glow; color tokens untouched.
- Particles component stops being used on the home hero (kept in the codebase).

## Not changing

Colors and design tokens, copy/content sources (site settings still drive hero text), routing, data fetching, auth, admin panel, or any business logic.
