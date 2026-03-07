import * as OTPAuth from 'otpauth';
import { secret } from '@/lib/crypto';
import { createSecureToken } from '@/lib/jwt';
import {
  consumeRecoveryCode,
  createRecoveryCodes,
  createTwoFactorChallengeToken,
  createTwoFactorSetup,
  createTwoFactorSetupToken,
  createTwoFactorTrustKey,
  createTwoFactorTrustToken,
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  hashRecoveryCodes,
  isTrustedDeviceTokenValid,
  normalizeRecoveryCode,
  parseTwoFactorChallengeToken,
  parseTwoFactorSetupToken,
  parseTwoFactorTrustToken,
  sanitizeTotpCode,
  TWO_FACTOR_CHALLENGE_PURPOSE,
  TWO_FACTOR_SETUP_PURPOSE,
  TWO_FACTOR_TRUST_PURPOSE,
  validateTotpCode,
} from '@/lib/two-factor';

describe('two-factor security helpers', () => {
  const setup = createTwoFactorSetup('admin');

  it('accepts valid totp codes within the allowed time window', () => {
    const timestamp = Date.now();
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(setup.secretCode),
    });

    const token = totp.generate({ timestamp });

    expect(validateTotpCode(setup.secretCode, token, timestamp)).toBe(true);
    expect(validateTotpCode(setup.secretCode, token, timestamp + 90000)).toBe(false);
  });

  it('creates challenge/setup tokens that are purpose-bound and expiring', () => {
    const challengeToken = createTwoFactorChallengeToken({ userId: 'user-1', challengeId: 'abc' });
    expect(parseTwoFactorChallengeToken(challengeToken)).toMatchObject({
      purpose: TWO_FACTOR_CHALLENGE_PURPOSE,
      userId: 'user-1',
      challengeId: 'abc',
    });

    const setupToken = createTwoFactorSetupToken({
      userId: 'user-1',
      secretCode: setup.secretCode,
    });
    expect(parseTwoFactorSetupToken(setupToken)).toMatchObject({
      purpose: TWO_FACTOR_SETUP_PURPOSE,
      userId: 'user-1',
      secretCode: setup.secretCode,
    });

    const tamperedToken = `x${challengeToken.slice(1)}`;
    expect(parseTwoFactorChallengeToken(tamperedToken)).toBeNull();

    const wrongPurpose = createSecureToken(
      { purpose: 'wrong', userId: 'user-1', challengeId: 'abc' },
      secret(),
      { expiresIn: '5m' },
    );
    expect(parseTwoFactorChallengeToken(wrongPurpose)).toBeNull();

    const expiredToken = createTwoFactorChallengeToken(
      { userId: 'user-1', challengeId: 'abc' },
      { expiresIn: '-1s' },
    );
    expect(parseTwoFactorChallengeToken(expiredToken)).toBeNull();
  });

  it('stores recovery codes as hashes and prevents reuse', () => {
    const recoveryCodes = createRecoveryCodes();
    const hashes = hashRecoveryCodes(recoveryCodes);

    expect(hashes).toHaveLength(recoveryCodes.length);
    expect(hashes).not.toContain(recoveryCodes[0]);

    const firstUse = consumeRecoveryCode(recoveryCodes[0], hashes);

    expect(firstUse.valid).toBe(true);
    expect(firstUse.remaining).toHaveLength(hashes.length - 1);

    const secondUse = consumeRecoveryCode(recoveryCodes[0], firstUse.remaining);

    expect(secondUse.valid).toBe(false);
  });

  it('encrypts and decrypts two-factor secrets', () => {
    const encrypted = encryptTwoFactorSecret(setup.secretCode);

    expect(encrypted).not.toBe(setup.secretCode);
    expect(decryptTwoFactorSecret(encrypted)).toBe(setup.secretCode);
  });

  it('creates trusted-device tokens that are user-bound and revokable', () => {
    const encryptedSecret = encryptTwoFactorSecret(setup.secretCode);
    const trustKey = createTwoFactorTrustKey('password-hash', encryptedSecret);
    const token = createTwoFactorTrustToken({ userId: 'user-1', trustKey });

    expect(parseTwoFactorTrustToken(token)).toMatchObject({
      purpose: TWO_FACTOR_TRUST_PURPOSE,
      userId: 'user-1',
      trustKey,
    });

    expect(
      isTrustedDeviceTokenValid(token, {
        id: 'user-1',
        password: 'password-hash',
        twoFactorSecret: encryptedSecret,
      }),
    ).toBe(true);

    expect(
      isTrustedDeviceTokenValid(token, {
        id: 'user-2',
        password: 'password-hash',
        twoFactorSecret: encryptedSecret,
      }),
    ).toBe(false);

    expect(
      isTrustedDeviceTokenValid(token, {
        id: 'user-1',
        password: 'password-hash-changed',
        twoFactorSecret: encryptedSecret,
      }),
    ).toBe(false);

    const expiredToken = createTwoFactorTrustToken(
      { userId: 'user-1', trustKey },
      { expiresIn: '-1s' },
    );
    expect(parseTwoFactorTrustToken(expiredToken)).toBeNull();
  });

  it('normalizes token inputs for secure comparisons', () => {
    expect(normalizeRecoveryCode('ab-cd 1234')).toBe('ABCD1234');
    expect(sanitizeTotpCode(' 123 456 ')).toBe('123456');
  });
});
