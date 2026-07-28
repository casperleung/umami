import prisma from '@/lib/prisma';
import { json, unauthorized } from '@/lib/response';

// Pinged on a schedule (see vercel.json) purely to keep the Supabase free-tier
// project from auto-pausing after 7 days with no database activity.
export async function GET(request: Request) {
  if (process.env.CRON_SECRET) {
    const auth = request.headers.get('authorization');

    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return unauthorized();
    }
  }

  await prisma.client.$queryRaw`select 1`;

  return json({ ok: true });
}
