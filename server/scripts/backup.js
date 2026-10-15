// Run: npm run backup. DATABASE_URL is read from the server environment;
// credentials are passed through libpq environment variables, not argv.
require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
  await fs.mkdir(output, { recursive: true });
  const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get('sslmode') || 'prefer' };
  await new Promise((resolve, reject) => {
    const child = spawn(process.env.PG_DUMP_PATH || 'pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', path.join(output, 'database.dump')], { env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.resume();
    child.on('error', () => reject(new Error('pg_dump unavailable; install PostgreSQL client tools or set PG_DUMP_PATH.')));
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('Database backup failed; check connection and pg_dump version.')));
  });
  await fs.cp(path.join(root, 'uploads'), path.join(output, 'uploads'), { recursive: true });
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), database: 'database.dump', files: 'uploads', note: 'Protect this directory: it contains student data. Pause uploads for a fully consistent DB/file snapshot.' }, null, 2));
  console.log(`Backup saved: ${output}`);
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
