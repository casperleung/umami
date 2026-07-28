import { z } from 'zod';
import { createAuthToken } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import prisma from '@/lib/prisma';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import {
  consumeRecoveryCode,
  createTwoFactorTrustKey,
  createTwoFactorTrustToken,
  decryptTwoFactorSecret,
  getRecoveryCodeHashes,
  parseTwoFactorChallengeToken,
  validateTotpCode,
} from '@/lib/two-factor';
import { getAllUserTeams, getUser } from '@/queries/prisma';

export async function POST(request: Request) {
  const schema = z.object({
    challengeToken: z.string(),
    code: z.string(),
    rememberDevice: z.boolean().optional(),
  });

  const { body, error } = await parseRequest(request, schema, { skipAuth: true });

  if (error) {
    return error();
  }

  const { challengeToken, code, rememberDevice } = body;
  const payload = parseTwoFactorChallengeToken(challengeToken);

  if (!payload) {
    return unauthorized({ code: 'expired-two-factor-challenge' });
  }

  const user = await getUser(payload.userId, { includePassword: true, includeTwoFactor: true });

  if (!user?.id || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return unauthorized({ code: 'two-factor-required' });
  }

  if (user.twoFactorChallenge !== payload.challengeId) {
    return unauthorized({ code: 'expired-two-factor-challenge' });
  }

  let data: Record<string, any> = {
    twoFactorChallenge: null,
  };
  let valid = false;

  try {
    const secretCode = decryptTwoFactorSecret(user.twoFactorSecret);
    valid = validateTotpCode(secretCode, code);
  } catch {
    // If secret decryption fails (e.g. key rotation mismatch), still allow recovery code fallback.
    valid = false;
  }

  if (!valid) {
    const hashes = getRecoveryCodeHashes(user.twoFactorRecoveryCodes);
    const recovery = consumeRecoveryCode(code, hashes);

    if (recovery.valid) {
      valid = true;
      data = {
        ...data,
        twoFactorRecoveryCodes: recovery.remaining,
      };
    }
  }

  if (!valid) {
    return unauthorized({ code: 'invalid-two-factor-code' });
  }

  const updated = await prisma.client.user.updateMany({
    where: {
      id: user.id,
      twoFactorChallenge: payload.challengeId,
    },
    data,
  });

  if (!updated.count) {
    return unauthorized({ code: 'expired-two-factor-challenge' });
  }

  const token = await createAuthToken(user.id, user.role, user.password);
  const teams = await getAllUserTeams(user.id);
  const trustedToken =
    rememberDevice && user.password && user.twoFactorSecret
      ? createTwoFactorTrustToken({
          userId: user.id,
          trustKey: createTwoFactorTrustKey(user.password, user.twoFactorSecret),
        })
      : null;

  return json({
    token,
    ...(trustedToken ? { trustedToken } : {}),
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      isAdmin: user.role === ROLES.admin,
      twoFactorEnabled: true,
      teams,
    },
  });
}
