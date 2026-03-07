# Umami 2FA Implementation Summary

Date: March 7, 2026
Environment: Vercel + Supabase Postgres

## Overview

Implemented local-login 2FA with:

- TOTP via authenticator app (QR + manual key)
- One-time recovery codes
- Trusted device option ("Trust this device for 30 days")
- Security-focused tests (unit + E2E)

SSO behavior is unchanged and remains out of scope.

## Data model

Added to `User` model:

- `twoFactorEnabled` (boolean)
- `twoFactorSecret` (encrypted string)
- `twoFactorRecoveryCodes` (JSON array of hashes)
- `twoFactorChallenge` (single-use login challenge id)

Migration:

- `prisma/migrations/15_add_two_factor_auth/migration.sql`

## API behavior

### `POST /api/auth/login`

Input:

- `username`
- `password`
- optional `trustedToken`

Behavior:

- Returns `{ token, user }` if 2FA not required.
- Returns `{ twoFactorRequired: true, challengeToken }` when second factor is required.
- For 2FA users, valid `trustedToken` bypasses challenge.

### `POST /api/auth/login/2fa`

Input:

- `challengeToken`
- `code` (TOTP or recovery code)
- optional `rememberDevice`

Behavior:

- Verifies challenge token + factor.
- Rejects replayed/expired challenge.
- Returns `{ token, user }`.
- Returns `trustedToken` when `rememberDevice=true`.

### 2FA profile endpoints

- `POST /api/me/2fa/setup`
- `POST /api/me/2fa/enable`
- `POST /api/me/2fa/disable`
- `POST /api/me/2fa/recovery-codes`

All sensitive 2FA settings changes require current-password re-auth.

## Security model

- No auth token issued for enrolled users until second factor verifies.
- Challenge/setup/trust tokens are signed + encrypted and purpose-bound.
- Challenge token TTL: 5m.
- Setup token TTL: 10m.
- Trust token TTL: 30d.
- Recovery codes are hashed at rest and one-time-use.
- 2FA secret is encrypted at rest.

Trusted device binding:

- `trustKey = hash(user.password, user.twoFactorSecret, secret())`
- Trust token invalidates when password changes, 2FA secret changes, or `APP_SECRET` changes.

## UX changes

### Login page

- Two-step login flow for enrolled users.
- Added OTP autofill-friendly field (`autocomplete="one-time-code"`).
- Added "Trust this device for 30 days" switch.

### Profile settings

- Added 2FA management section:
  - enable
  - disable
  - regenerate recovery codes
- Improved dialog layout and visual hierarchy:
  - responsive modal sizing/overflow
  - improved action button variants (primary/quiet/danger)
  - copyable manual key field
  - controlled QR rendering

## Testing

### Unit tests

`src/lib/__tests__/two-factor.test.ts` covers:

- token purpose/expiry/tamper checks
- TOTP window behavior
- recovery code hashing + one-time consume
- secret encryption/decryption
- trusted token validation and invalidation cases

### E2E security tests

`cypress/e2e/security-2fa.cy.ts` covers:

- enrollment and enforced second factor
- challenge replay rejection
- recovery code one-time behavior
- trusted-token bypass
- tampered trusted-token fallback to challenge
- password re-auth enforcement for disable/regenerate

### API exposure test

`cypress/e2e/api-user.cy.ts` verifies sensitive 2FA fields are not exposed in user list/admin responses.

## Deployment notes

- `APP_SECRET` must be stable and set in environment.
- `DATABASE_URL` for runtime pooled connection.
- `DIRECT_URL` for migration path.
- Production deploy should run `prisma migrate deploy`.

## Current runtime behavior

- If trust-device is not selected: 2FA required on every new login.
- If trust-device is selected: 2FA skipped on that browser/device for up to 30 days.
- Existing active sessions are not forcibly invalidated by enabling 2FA.

## Key changed files

- `prisma/schema.prisma`
- `prisma/migrations/15_add_two_factor_auth/migration.sql`
- `src/lib/two-factor.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/login/2fa/route.ts`
- `src/app/api/me/2fa/*`
- `src/app/login/LoginForm.tsx`
- `src/app/(main)/settings/profile/TwoFactorSettingsButton.tsx`
- `src/lib/__tests__/two-factor.test.ts`
- `cypress/e2e/security-2fa.cy.ts`
