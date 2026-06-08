
# Revised Membership & Payments Plan

Switching from PayMongo to **semi-automated GCash/Maya receipt verification with OCR**, plus a full **Credits** economy. Confirm and I'll execute end-to-end.

## 1. Auth (production-ready)

- Email + password, **email verification required** (`auto_confirm_email: false`).
- HIBP leaked-password check on signup/change (`password_hibp_enabled: true`).
- `/auth` redesign: Sign in, Sign up, Forgot password, **Remember me** (toggles `persistSession`).
- New public `/reset-password` route (handles `type=recovery`, calls `updateUser({password})`).
- New `/account` route (authenticated): change email/password, view membership + credits + downloads.
- Sign-out hygiene: cancel queries, clear cache, `signOut`, replace-navigate to `/auth`.
- Brute-force/rate-limit/CSRF/hashing/token security = handled by Supabase Auth (Lovable Cloud) — that's the platform guarantee, no custom layer.
- All Zod-validated inputs (client + server).

## 2. Roles

- `app_role` already extended: `admin`, `vip`, `member`. New signup auto-gets `member` (existing trigger).
- `member` = default, limited daily downloads, earns Credits, no VIP resources.
- `vip` = unlimited downloads, VIP badge, access to VIP resources. Auto-granted on approved payment, auto-revoked at expiry.
- `admin` = full control.

## 3. Resource access tiers

Drop the current `access_tier ∈ {free, vip}` and replace with **`access_tier ∈ {free, credit, vip}`** + `credit_cost int` on `resources`.

- **Free** → any logged-in user (subject to daily limit).
- **Credit** → deducts `credit_cost` on download (insufficient → blocked).
- **VIP** → requires active VIP membership.

Guest behaviour: browse / search / view / screenshots / descriptions only. Download button shows "Sign in to download" CTA.

## 4. Credits economy

New table `credits_ledger(user_id, delta, reason, ref_id, created_at)` — single source of truth (append-only). `profiles.credits_balance` cached column maintained by trigger.

Earning rules (admin-editable in `site_settings`):
- Signup bonus: **+20** (one-time, via trigger on profile creation).
- Daily login: **+N** (claimable once per UTC day from `/account`).
- Activity rewards: hook stubs for future (e.g. first download bonus).

Spending: download a credit resource → server fn deducts atomically (within a SECURITY DEFINER fn that re-checks balance).

Leaderboard: public read of `profiles` top-by-`credits_balance` (display name + balance only — no email).

## 5. Daily download limits

`site_settings` → `member_daily_limit` (default 10), `vip_daily_limit` (null = unlimited).

`can_download(uid, resource_id)` SECURITY DEFINER fn enforces tier + limit + credit balance, returns `{allowed, reason, cost}`.

`getDownloadUrl` server fn:
- Requires auth (`requireSupabaseAuth`).
- Calls `can_download`.
- If credit tier → wraps deduction + download log in a single SQL fn to avoid race.
- Logs `download_logs`.
- Returns signed URL.

## 6. Payments — semi-automated GCash/Maya + OCR

**No PayMongo.** Manual sends to project's GCash/Maya, automated receipt scan.

### Tables
- `membership_plans` (already exists — keep).
- `payment_settings` lives in `site_settings.payment` jsonb: `{gcash_number, gcash_name, maya_number, maya_name, instructions, ocr_confidence_threshold (default 0.8)}`.
- `payment_receipts` — new:
  - `user_id`, `plan_id`, `method ∈ {gcash, maya}`, `image_url` (storage), `status ∈ {pending, auto_approved, approved, rejected, flagged}`,
  - OCR fields: `ocr_reference`, `ocr_amount_php`, `ocr_paid_at`, `ocr_method`, `ocr_confidence`, `ocr_raw` jsonb,
  - validation: `duplicate_reference bool`, `duplicate_image_hash bool`, `amount_match bool`, `flags text[]`,
  - admin: `reviewed_by`, `reviewed_at`, `admin_notes`.
- Unique index on `ocr_reference` (when not null) — DB-level duplicate guard.
- Storage: private bucket `receipts/` — users upload own, admins read all (RLS).

### Flow
1. User picks plan on `/membership`, sees GCash/Maya number + name + instructions (from `site_settings`).
2. User pays externally, uploads receipt screenshot.
3. Server fn `submitReceipt({plan_id, method, file})`:
   - Uploads to private bucket.
   - Computes SHA-256 of image bytes; rejects if matches an existing row → `duplicate_image_hash`.
   - Calls **Lovable AI Gateway** (`google/gemini-2.5-flash`) with the image + structured-output schema → extracts `{reference, amount, datetime, method}` + self-reported `confidence`.
   - Runs validators:
     - Reference uniqueness (DB lookup).
     - `amount === plan.price_php`.
     - Method matches user selection.
     - Date within last 7 days.
     - Detected method in receipt matches.
   - Computes final confidence = `min(model_confidence, 1.0) * pass_ratio`.
4. Decision:
   - If `confidence >= threshold` **and** all validators pass **and** no duplicates → status `auto_approved`, insert `payments` row (status=paid), trigger grants/extends VIP automatically (existing `handle_payment_paid` trigger), notify user.
   - Else → status `flagged` / `rejected`, surface reason to user, queue for admin.

### Admin review dashboard
New tab "Payments" in `/admin`:
- List receipts (filter by status), thumbnail, OCR fields, confidence, flags.
- Approve → activates VIP. Reject → keep record, add note. Optional re-run OCR.

### Auto-expiry
`pg_cron` daily job removes expired `vip` roles for users whose `vip_memberships.expires_at < now()`.

## 7. UI

- Header: avatar dropdown (Account, Membership, Credits, Sign out) when signed in; "Sign in" otherwise. VIP badge when active.
- `/membership` — plan cards, GCash/Maya details, upload-receipt form, status of last submission.
- `/credits` — balance, daily-claim button, ledger, leaderboard.
- `/account` — profile + security + membership/credits summary.
- Resource cards/detail — Free / Credit (cost) / VIP pill. Disabled download CTA with clear reason for guests / under-credit / no-VIP / limit-reached.
- Remove all "no login required" copy.

## 8. Admin panel additions

Tabs: Users (search, grant/revoke admin/vip, adjust credits, view downloads), Plans (CRUD), Payments (review queue), Memberships (active VIPs + expiry), Credits (leaderboard, manual adjust, reward rules), Settings (payment info, OCR threshold, daily limits, signup/daily-login credit amounts). One-click save per section.

## 9. Cleanup
- Drop pending PayMongo plan items (no secrets added, no PayMongo code shipped yet).
- Remove "No login required" copy site-wide.

## Technical Notes
- New server fns under `src/lib/`: `auth.functions.ts`, `credits.functions.ts`, `receipts.functions.ts`, `admin-credits.functions.ts`, `admin-receipts.functions.ts`. Existing `resources.functions.ts` updated for auth-required downloads.
- OCR via Lovable AI Gateway → no extra secrets, no Tesseract install needed, edge-runtime safe. Structured output via tool-calling schema.
- Image hashing in the server fn (Web Crypto `crypto.subtle.digest('SHA-256', bytes)`).
- All new public tables get explicit `GRANT`s + RLS.
- Validation: Zod everywhere; max image size 5 MB; only image/png|jpg|webp.

## Out of scope (unless you say otherwise)
- Branded auth email templates.
- Google/Apple/SAML SSO (1-step add later).
- Refunds UI / partial refunds.
- SMS/email-OTP for high-value actions.
- Receipt re-OCR via a different model.

Reply **go** to build it all in one pass, or tell me what to tweak (e.g. "signup bonus 50", "limit 5/day", "skip credits", "skip leaderboard").
