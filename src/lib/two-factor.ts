import { randomBytes } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { decrypt, encrypt, hash, secret } from '@/lib/crypto';
import { createSecureToken, parseSecureToken } from '@/lib/jwt';
import { checkPassword, hashPassword } from '@/lib/password';

export const TWO_FACTOR_CHALLENGE_PURPOSE = 'two-factor-challenge';
export const TWO_FACTOR_SETUP_PURPOSE = 'two-factor-setup';
export const TWO_FACTOR_TRUST_PURPOSE = 'two-factor-trust';
export const TWO_FACTOR_TRUST_DAYS = 30;

const TWO_FACTOR_ISSUER = 'Umami';
const TWO_FACTOR_DIGITS = 6;
const TWO_FACTOR_PERIOD = 30;
const TWO_FACTOR_WINDOW = 1;
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface TokenPayload {
  purpose: string;
  userId: string;
}

export interface TwoFactorChallengePayload extends TokenPayload {
  purpose: typeof TWO_FACTOR_CHALLENGE_PURPOSE;
  challengeId: string;
}

export interface TwoFactorSetupPayload extends TokenPayload {
  purpose: typeof TWO_FACTOR_SETUP_PURPOSE;
  secretCode: string;
}

export interface TwoFactorTrustPayload extends TokenPayload {
  purpose: typeof TWO_FACTOR_TRUST_PURPOSE;
  trustKey: string;
}

function getSecureRandomChars(length: number, chars: string) {
  const size = chars.length;
  const max = 256 - (256 % size);
  let output = '';

  while (output.length < length) {
    const bytes = randomBytes(length);

    for (const value of bytes) {
      if (value >= max) {
        continue;
      }

      output += chars[value % size];

      if (output.length === length) {
        break;
      }
    }
  }

  return output;
}

function createTotp(secretCode: string, label = 'umami') {
  return new OTPAuth.TOTP({
    issuer: TWO_FACTOR_ISSUER,
    label,
    algorithm: 'SHA1',
    digits: TWO_FACTOR_DIGITS,
    period: TWO_FACTOR_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretCode),
  });
}

export function sanitizeTotpCode(code: string) {
  return String(code || '').replace(/\s+/g, '');
}

export function normalizeRecoveryCode(code: string) {
  return String(code || '')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();
}

export function getRecoveryCodeHashes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((code): code is string => typeof code === 'string');
}

export function createTwoFactorSetup(username: string) {
  const secretCode = OTPAuth.Secret.fromUTF8(
    getSecureRandomChars(32, 'abcdefghijklmnopqrstuvwxyz0123456789'),
  ).base32;
  const totp = createTotp(secretCode, username);

  return {
    secretCode,
    otpauthUri: totp.toString(),
  };
}

export function validateTotpCode(secretCode: string, code: string, timestamp?: number) {
  const token = sanitizeTotpCode(code);

  if (!/^\d{6}$/.test(token)) {
    return false;
  }

  const totp = createTotp(secretCode);

  return (
    totp.validate({
      token,
      window: TWO_FACTOR_WINDOW,
      ...(timestamp ? { timestamp } : {}),
    }) !== null
  );
}

export async function createTwoFactorQrCode(otpauthUri: string) {
  return QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 200,
  });
}

export function createRecoveryCodes() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const code = getSecureRandomChars(8, RECOVERY_CODE_CHARS);

    return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
  });
}

export function hashRecoveryCodes(codes: string[]) {
  return codes.map(code => hashPassword(normalizeRecoveryCode(code)));
}

export function consumeRecoveryCode(code: string, hashes: string[]) {
  const normalized = normalizeRecoveryCode(code);

  const index = hashes.findIndex(hash => checkPassword(normalized, hash));

  if (index === -1) {
    return { valid: false, remaining: hashes };
  }

  return {
    valid: true,
    remaining: hashes.filter((_, i) => i !== index),
  };
}

export function encryptTwoFactorSecret(secretCode: string) {
  return encrypt(secretCode, secret());
}

export function decryptTwoFactorSecret(encryptedSecret: string) {
  return decrypt(encryptedSecret, secret());
}

export function createTwoFactorChallengeToken(
  payload: Omit<TwoFactorChallengePayload, 'purpose'>,
  options?: any,
) {
  return createSecureToken({ ...payload, purpose: TWO_FACTOR_CHALLENGE_PURPOSE }, secret(), {
    expiresIn: '5m',
    ...options,
  });
}

export function parseTwoFactorChallengeToken(token: string): TwoFactorChallengePayload | null {
  const payload = parseSecureToken(token, secret()) as TwoFactorChallengePayload;

  if (
    !payload ||
    payload.purpose !== TWO_FACTOR_CHALLENGE_PURPOSE ||
    !payload.userId ||
    !payload.challengeId
  ) {
    return null;
  }

  return payload;
}

export function createTwoFactorSetupToken(
  payload: Omit<TwoFactorSetupPayload, 'purpose'>,
  options?: any,
) {
  return createSecureToken({ ...payload, purpose: TWO_FACTOR_SETUP_PURPOSE }, secret(), {
    expiresIn: '10m',
    ...options,
  });
}

export function parseTwoFactorSetupToken(token: string): TwoFactorSetupPayload | null {
  const payload = parseSecureToken(token, secret()) as TwoFactorSetupPayload;

  if (
    !payload ||
    payload.purpose !== TWO_FACTOR_SETUP_PURPOSE ||
    !payload.userId ||
    !payload.secretCode
  ) {
    return null;
  }

  return payload;
}

export function createTwoFactorTrustKey(password: string, twoFactorSecret: string) {
  return hash(password, twoFactorSecret, secret());
}

export function createTwoFactorTrustToken(
  payload: Omit<TwoFactorTrustPayload, 'purpose'>,
  options?: any,
) {
  return createSecureToken({ ...payload, purpose: TWO_FACTOR_TRUST_PURPOSE }, secret(), {
    expiresIn: `${TWO_FACTOR_TRUST_DAYS}d`,
    ...options,
  });
}

export function parseTwoFactorTrustToken(token: string): TwoFactorTrustPayload | null {
  const payload = parseSecureToken(token, secret()) as TwoFactorTrustPayload;

  if (
    !payload ||
    payload.purpose !== TWO_FACTOR_TRUST_PURPOSE ||
    !payload.userId ||
    !payload.trustKey
  ) {
    return null;
  }

  return payload;
}

export function isTrustedDeviceTokenValid(
  token: string,
  user: { id?: string; password?: string; twoFactorSecret?: string },
) {
  const payload = parseTwoFactorTrustToken(token);

  if (!payload || !user?.id || !user?.password || !user?.twoFactorSecret) {
    return false;
  }

  if (payload.userId !== user.id) {
    return false;
  }

  return payload.trustKey === createTwoFactorTrustKey(user.password, user.twoFactorSecret);
}
