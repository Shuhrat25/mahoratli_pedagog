require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

async function main() {
  if (process.env.DEMO_SEED !== 'true') {
    console.log('Demo seeding is disabled.');
    return;
  }
  const prisma = new PrismaClient();
  try {
    if (await prisma.user.count()) {
      console.log('Database already contains users; existing data retained.');
      return;
    }
  } finally {
    await prisma.$disconnect();
  }
  fs.mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'prisma', 'seed.js')], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Demo seeding failed.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
