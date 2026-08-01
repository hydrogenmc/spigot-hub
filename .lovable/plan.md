## Goal

Strip the Credits economy and Leaderboard entirely (downloads are now gated purely by Free vs VIP + daily download limits), then run a pre-publish pass.

## 1. Remove the Leaderboard

- Delete `src/routes/leaderboard.tsx` and `src/lib/credits.functions.ts`.
- `SiteHeader`: remove the `/leaderboard` nav item, the "Credits & Leaderboard" dropdown entry, the `Coins` credit-balance pill next to the avatar, and the "(N credits)" suffix in the mobile menu.
- `membership.tsx`: replace the "VIP badge on leaderboard" plan perk with a real perk (e.g. "Unlimited daily downloads").

## 2. Remove credits from the app surface

- `resources.$slug.tsx`: drop the `credit` tier badge, the `insufficient_credits` reason string, and the "N Credits deducted" toast — tier pill becomes Free / VIP only.
- `resources.functions.ts` (`getDownloadUrl`): remove the credit-tier branch, `credits_balance` lookup, and `cost`/`remainingBalance` in the response.
- `admin-ext.functions.ts`: remove `adminAdjustCredits`; narrow bulk-tier + CSV import schemas to `free | vip` and stop writing `credit_cost`; drop `credits_balance` from the users list.
- `admin.tsx`: remove the Adjust-credits action and Credits column in Users, the "Signup bonus / Daily login credits" settings fields (keep the download-limit fields), the `credit_cost` CSV column, and the "Credits spent" audit stat.
- `auth.functions.ts`: drop `credits_balance` / `last_daily_claim_at` from `getMe` and delete the `claimDailyCredits` server fn.
- `audit.functions.ts`: remove `credits_spent` from the totals.
- `site-settings.ts`: remove `CreditSettings` and the `credits` key.
- `auth.tsx` and `index.tsx`: fix copy — "earn credits" / "Get 20 free credits" / "Daily login credits" become download-focused wording.

## 3. Database cleanup (one migration)

- Drop functions `claim_daily_credits`, `admin_adjust_credits`, `apply_ledger_to_balance`, and the ledger trigger.
- Simplify `can_download` / `consume_download` to handle only `free` and `vip` (no balance check, no deduction, no ledger write) while keeping admin/VIP bypass and daily limits.
- Update `validate_resource_access_tier` to allow only `free`/`vip`; set any leftover `credit` resources to `free` and `credit_cost = 0` first.
- Drop `credits_ledger`, `profiles.credits_balance`, `profiles.last_daily_claim_at`, `resources.credit_cost`, and the `cost` column usage in audit logs (keep the column but stop writing, or drop it).
- Remove `signup_bonus` / `daily_login` from `site_settings.data`, and drop the credits insert from `handle_new_user`.

## 4. Pre-publish checklist (my recommendations)

1. **Security scan** — run the scanner and resolve any critical findings (publishing is blocked otherwise); re-verify RLS + GRANTs on every public table after the migration.
2. **Auth settings** — confirm email verification on, leaked-password protection on, Google provider configured, and the site/redirect URLs include the production domain (otherwise Google sign-in breaks after publish).
3. **SEO/meta** — verify every route has a unique title + description with the CubynDev branding, plus og/twitter tags on the home and resource pages.
4. **Dead code** — delete `src/routes/index.tsx.bak`, and remove any unused imports left after the credit removal; typecheck must be clean.
5. **Membership/payments smoke test** — receipt upload → OCR → auto-approval → VIP role → VIP download, end to end.
6. **Limits sanity** — member 5/day enforced, VIP/admin unlimited; verify the daily-limit denial message reads clearly.
7. **Admin bootstrap** — confirm `adminPromoteSelf` is locked (an admin already exists) so it can't be abused on the live site.
8. **404 / error states** — confirm unknown routes and failed loaders render a branded page, not a raw error.

**Website Performance**

Optimize:

Lazy loading

Image optimization

Code splitting

Fast loading

Mobile performance

Accessibility

Keyboard navigation

SEO structure

Sitemap

Robots.txt

Meta descriptions

Open Graph images

Structured data

## Technical notes

- All server-fn edits keep the thin-wrapper shape; no runtime helpers added at module scope.
- CSV template and bulk-tier UI will be regenerated without the `credit_cost` column, so old templates will simply have an ignored extra column.
- Nothing in the VIP/download-limit path changes behaviorally for admins or VIP-role users.