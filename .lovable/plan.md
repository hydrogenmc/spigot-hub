
# Membership & Payments Build Plan

Big scope — here's what I'll ship end-to-end. Confirm and I'll execute.

## 1. Auth (Lovable Cloud / Supabase)
- Enable **email verification** in Cloud auth settings (users must confirm email before login succeeds).
- Update `/auth` page: Sign in, Sign up, Forgot password, Remember me checkbox (controls `persistSession`).
- New `/reset-password` public route (handles `type=recovery` hash, calls `updateUser({password})`).
- New `/account` route (authenticated): change email, change password, view membership status & expiry.
- Password rules: min 8 chars + HIBP leaked-password check via `configure_auth`.
- Existing `_authenticated` gate already protects routes. Rate-limiting, CSRF, hashing, session security are handled by Supabase Auth + the publishable key flow.

## 2. Roles
- Reuse existing `app_role` enum + `user_roles` table. Add value `vip` to the enum.
- Auto-assign `member` to every new signup via the existing `handle_new_user` trigger (extend it to insert `('member')` into `user_roles`).
- Keep `admin` as is. `has_role()` already exists.

## 3. New tables (migration)
- `membership_plans` (name, duration_days nullable=lifetime, price_php, active, sort_order).
- `vip_memberships` (user_id, plan_id, starts_at, expires_at nullable, source, payment_id).
- `payments` (user_id, plan_id, amount_php, method gcash|maya, provider=paymongo, provider_ref, status pending|paid|failed|expired, raw jsonb, created_at, paid_at).
- `download_logs` (user_id, resource_id, created_at) — for daily limit counting.
- `download_limits` settings stored in existing `site_settings` (`member_daily_limit`, `vip_daily_limit` nullable=unlimited).
- Add `resources.access_tier` text default `'free'` ∈ {free, vip}.
- All tables: GRANTs + RLS (users see own rows; admins manage all).
- Trigger: when a `payments` row flips to `paid`, insert/extend `vip_memberships` and insert `('vip')` into `user_roles` (delete on expiry via a scheduled check).

## 4. Helper SQL functions (SECURITY DEFINER)
- `is_active_vip(uid uuid) returns bool` — checks unexpired `vip_memberships`.
- `downloads_today(uid uuid) returns int`.
- `can_download(uid uuid, resource_id uuid) returns jsonb` — returns `{allowed, reason}` enforcing free/vip + daily limit.

## 5. Download flow rewrite
- `getDownloadUrl` serverFn (already exists) becomes auth-required (`requireSupabaseAuth`).
  - Calls `can_download`; rejects with clear error.
  - Logs to `download_logs`.
  - Returns signed URL as today.
- Resource detail page: if guest → "Sign in to download" CTA. If member viewing VIP → "Requires VIP" + Upgrade button. If over daily limit → "Daily limit reached".

## 6. PayMongo checkout (GCash/Maya)
- Add secret `PAYMONGO_SECRET_KEY` via `secrets--add_secret`.
- ServerFn `createCheckout({plan_id, method})`:
  - Creates a PayMongo **Checkout Session** with line item = plan, payment_method_types = [`gcash`] or [`paymaya`], success_url/cancel_url to `/billing/return`.
  - Inserts `payments` row (status=pending, provider_ref=session id).
  - Returns hosted checkout URL → client redirects.
- Public server route `/api/public/paymongo/webhook`:
  - Verifies `Paymongo-Signature` HMAC with webhook secret.
  - On `checkout_session.payment.paid` → mark payment `paid`, trigger activates VIP.
- `/billing/return` page polls payment status until paid/failed.

## 7. UI additions
- `/membership` route: lists active plans, GCash/Maya buttons → PayMongo redirect. VIP badge on header avatar when active.
- Resource cards: small "VIP" pill on vip-tier resources.
- `_authenticated/admin.tsx`: new tabs
  - **Users**: list, search, grant/revoke admin/vip manually, view membership expiry.
  - **Plans**: CRUD `membership_plans`.
  - **Payments**: list `payments` with filters, manual mark-paid as a safety net.
  - **Settings**: GCash/Maya display info (shown on /membership for transparency), payment instructions, member daily limit, vip daily limit. Saves to `site_settings`.
  - **Memberships**: list active VIPs with expiry.
- Header: when logged in show avatar dropdown (Account, Membership, Sign out). When guest, show Sign in.

## 8. Cleanup
- Remove "No login required" copy from index/about/anywhere it appears.

## Technical notes
- Server functions: `auth.functions.ts`, `billing.functions.ts`, `membership.functions.ts`, `admin-users.functions.ts`, `admin-plans.functions.ts` (all client-safe paths under `src/lib/`).
- PayMongo webhook lives at `src/routes/api/public/paymongo.webhook.ts`.
- HIBP password check via `supabase--configure_auth({password_hibp_enabled: true})`.
- Rate limiting: relying on Supabase Auth's built-in. No custom rate limiter (per platform constraint).
- Email verification: enable in `configure_auth` (auto_confirm_email=false). Default Supabase auth emails will be sent — branded templates are out of scope unless you want them.

## Out of scope unless you say otherwise
- Branded auth email templates (custom domain emails).
- Apple/Microsoft/SAML SSO (you didn't ask — Google can be added in 1 step if you want).
- Refunds UI.

Reply **go** to proceed, or tell me what to adjust (e.g. "skip Google", "add Google", "lifetime only", "no daily limit").
