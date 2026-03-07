import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { badRequest, json, unauthorized } from '@/lib/response';
import {
  createRecoveryCodes,
  encryptTwoFactorSecret,
  hashRecoveryCodes,
  parseTwoFactorSetupToken,
  validateTotpCode,
} from '@/lib/two-factor';
import { getUser, updateUser } from '@/queries/prisma';

export async function POST(request: Request) {
  const schema = z.object({
    setupToken: z.string(),
    code: z.string(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const payload = parseTwoFactorSetupToken(body.setupToken);

  if (!payload || payload.userId !== auth.user.id) {
    return unauthorized({ code: 'invalid-two-factor-setup' });
  }

  const user = await getUser(auth.user.id, { includeTwoFactor: true });

  if (user.twoFactorEnabled) {
    return badRequest({ code: 'two-factor-already-enabled' });
  }

  if (!validateTotpCode(payload.secretCode, body.code)) {
    return unauthorized({ code: 'invalid-two-factor-code' });
  }

  const recoveryCodes = createRecoveryCodes();

  await updateUser(auth.user.id, {
    twoFactorEnabled: true,
    twoFactorSecret: encryptTwoFactorSecret(payload.secretCode),
    twoFactorRecoveryCodes: hashRecoveryCodes(recoveryCodes),
    twoFactorChallenge: null,
  });

  return json({ twoFactorEnabled: true, recoveryCodes });
}
