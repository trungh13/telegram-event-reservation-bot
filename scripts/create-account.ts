import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from project root
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const name = process.argv[2] || 'Default Account';
  console.log(`Creating account: ${name}...`);

  const account = await prisma.account.create({
    data: { name },
  });

  const key = `sk_${crypto.randomBytes(24).toString('hex')}`;
  await prisma.apiKey.create({
    data: {
      key,
      accountId: account.id,
    },
  });

  console.log(`
✅ Account Created!
------------------
Name: ${account.name}
ID:   ${account.id}
key:  ${key}

👇 Usage:
telegram: /token ${key}
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
