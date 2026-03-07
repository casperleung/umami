import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: process.env.DIRECT_URL || env('DATABASE_URL'),
  },
});
