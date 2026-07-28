import * as OTPAuth from 'otpauth';
import { expect, test } from '@playwright/test';
import { type Auth, addUser, deleteUser, loginViaApi } from './helpers';

test.describe('2FA security', () => {
  test.describe.configure({ mode: 'serial' });

  const username = `mfa-user-${Date.now()}`;
  const password = 'password12345';

  let adminAuth: Auth;
  let userId = '';

  test.beforeAll(async ({ request }) => {
    adminAuth = await loginViaApi(request);
    await addUser(request, adminAuth, username, password, 'user');

    const response = await request.post('/api/auth/login', {
      data: { username, password },
    });
    const body = await response.json();

    userId = body.user.id;
  });

  test.afterAll(async ({ request }) => {
    if (!userId) {
      return;
    }

    await deleteUser(request, adminAuth, userId);
  });

  test('requires two-step login, blocks challenge replay, and enforces secure recovery/disable flows', async ({
    request,
  }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: { username, password },
    });
    const loginBody = await loginResponse.json();
    const authToken = loginBody.token;

    const setupResponse = await request.post('/api/me/2fa/setup', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { currentPassword: password },
    });
    const { setupToken, manualCode } = await setupResponse.json();

    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(manualCode),
    });

    const enableResponse = await request.post('/api/me/2fa/enable', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { setupToken, code: totp.generate() },
    });
    const enableBody = await enableResponse.json();
    const recoveryCode = enableBody.recoveryCodes[0];

    const challengeResponse = await request.post('/api/auth/login', {
      data: { username, password },
    });
    const challengeBody = await challengeResponse.json();
    const challengeToken = challengeBody.challengeToken;

    expect(challengeBody.twoFactorRequired).toBe(true);

    const verifyResponse = await request.post('/api/auth/login/2fa', {
      data: { challengeToken, code: totp.generate(), rememberDevice: true },
    });
    const verifyBody = await verifyResponse.json();
    const twoFactorToken = verifyBody.token;
    const trustedToken = verifyBody.trustedToken;

    expect(verifyBody.user.twoFactorEnabled).toBe(true);
    expect(trustedToken).toBeTruthy();

    const replayResponse = await request.post('/api/auth/login/2fa', {
      data: { challengeToken, code: totp.generate() },
    });
    expect(replayResponse.status()).toBe(401);

    const trustedLoginResponse = await request.post('/api/auth/login', {
      data: { username, password, trustedToken },
    });
    const trustedLoginBody = await trustedLoginResponse.json();
    expect(trustedLoginBody.token).toBeTruthy();
    expect(trustedLoginBody.twoFactorRequired).not.toBe(true);

    const tamperedTrustedResponse = await request.post('/api/auth/login', {
      data: { username, password, trustedToken: `x${trustedToken.slice(1)}` },
    });
    const tamperedTrustedBody = await tamperedTrustedResponse.json();
    expect(tamperedTrustedBody.twoFactorRequired).toBe(true);

    const recoveryChallengeResponse = await request.post('/api/auth/login', {
      data: { username, password },
    });
    const recoveryChallengeBody = await recoveryChallengeResponse.json();
    const recoveryChallengeToken = recoveryChallengeBody.challengeToken;

    await request.post('/api/auth/login/2fa', {
      data: { challengeToken: recoveryChallengeToken, code: recoveryCode },
    });

    const reusedRecoveryChallenge = await request.post('/api/auth/login', {
      data: { username, password },
    });
    const reusedRecoveryChallengeBody = await reusedRecoveryChallenge.json();

    const reusedRecoveryResponse = await request.post('/api/auth/login/2fa', {
      data: { challengeToken: reusedRecoveryChallengeBody.challengeToken, code: recoveryCode },
    });
    expect(reusedRecoveryResponse.status()).toBe(401);

    const wrongRecoveryPassword = await request.post('/api/me/2fa/recovery-codes', {
      headers: { Authorization: `Bearer ${twoFactorToken}` },
      data: { currentPassword: 'wrong-password' },
    });
    expect(wrongRecoveryPassword.status()).toBe(400);

    const wrongDisablePassword = await request.post('/api/me/2fa/disable', {
      headers: { Authorization: `Bearer ${twoFactorToken}` },
      data: { currentPassword: 'wrong-password' },
    });
    expect(wrongDisablePassword.status()).toBe(400);

    await request.post('/api/me/2fa/disable', {
      headers: { Authorization: `Bearer ${twoFactorToken}` },
      data: { currentPassword: password },
    });

    const disabledLoginResponse = await request.post('/api/auth/login', {
      data: { username, password },
    });
    const disabledLoginBody = await disabledLoginResponse.json();
    expect(disabledLoginBody.token).toBeTruthy();
    expect(disabledLoginBody.twoFactorRequired).not.toBe(true);
  });
});
