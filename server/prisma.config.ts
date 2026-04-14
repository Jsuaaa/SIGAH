import path from 'node:path';
import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  earlyAccess: true,
  schema: path.resolve(__dirname, 'prisma/schema.prisma'),
  migrate: {
    async seed() {
      const { execSync } = await import('node:child_process');
      execSync('node prisma/seed.js', { stdio: 'inherit' });
    },
  },
});
