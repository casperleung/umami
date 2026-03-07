import { z } from 'zod';
import { checkPassword } from '@/lib/password';
import { parseRequest } from '@/lib/request';
import { badRequest, json } from '@/lib/response';
import { getUser, updateUser } from '@/queries/prisma';

export async function POST(request: Request) {
  const schema = z.object({
    currentPassword: z.string(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const user = await getUser(auth.user.id, { includePassword: true, includeTwoFactor: true });

  if (!checkPassword(body.currentPassword, user.password)) {
    return badRequest({ message: 'Current password is incorrect' });
  }

  if (!user.twoFactorEnabled) {
    return badRequest({ code: 'two-factor-not-enabled' });
  }

  await updateUser(auth.user.id, {
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorRecoveryCodes: null,
    twoFactorChallenge: null,
  });

  return json({ twoFactorEnabled: false });
}
