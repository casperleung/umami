import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { createAuthToken } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { checkPassword } from '@/lib/password';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { createTwoFactorChallengeToken, isTrustedDeviceTokenValid } from '@/lib/two-factor';
import { getAllUserTeams, getUserByUsername, updateUser } from '@/queries/prisma';

export async function POST(request: Request) {
  const schema = z.object({
    username: z.string(),
    password: z.string(),
    trustedToken: z.string().optional(),
  });

  const { body, error } = await parseRequest(request, schema, { skipAuth: true });

  if (error) {
    return error();
  }

  const { username, password, trustedToken } = body;

  const user = await getUserByUsername(username, { includePassword: true, includeTwoFactor: true });

  if (!user || !checkPassword(password, user.password)) {
    return unauthorized({ code: 'incorrect-username-password' });
  }

  const { id, role } = user;

  const trustedDevice = trustedToken ? isTrustedDeviceTokenValid(trustedToken, user) : false;

  if (user.twoFactorEnabled && !trustedDevice) {
    const challengeId = randomBytes(16).toString('hex');

    await updateUser(id, {
      twoFactorChallenge: challengeId,
    });

    return json({
      twoFactorRequired: true,
      challengeToken: createTwoFactorChallengeToken({
        userId: id,
        challengeId,
      }),
    });
  }

  if (user.twoFactorChallenge) {
    await updateUser(id, { twoFactorChallenge: null });
  }

  const token = await createAuthToken(id, role);
  const teams = await getAllUserTeams(id);

  return json({
    token,
    user: {
      id,
      username,
      role,
      createdAt: user.createdAt,
      isAdmin: role === ROLES.admin,
      twoFactorEnabled: user.twoFactorEnabled,
      teams,
    },
  });
}
