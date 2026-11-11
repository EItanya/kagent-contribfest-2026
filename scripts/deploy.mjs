import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const accountId = '7d33c874b75a7afed3a44c6126896050';
const { values } = parseArgs({
  options: {
    project: { type: 'string', default: process.env.CLOUDFLARE_PAGES_PROJECT || 'kagent-contribfest-2026' },
    branch: { type: 'string', default: 'main' },
    create: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(`Usage: npm run deploy -- [options]

  --project NAME   Pages project (default: kagent-contribfest-2026)
  --branch NAME    Deployment branch (default: main)
  --create         Create a new Pages project with main as its production branch
  --dry-run        Build and print Wrangler commands without contacting Cloudflare

Deployments are restricted to the Solo.io account (${accountId}).
First run npm run cloudflare:login, or set CLOUDFLARE_API_TOKEN for CI.
Do not commit credentials.`);
  process.exit(0);
}

if (!/^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/.test(values.project)) {
  console.error('Use a Pages project name of 1-58 lowercase letters, digits, or hyphens, beginning and ending with a letter or digit.');
  process.exit(1);
}
if (!values.branch.trim()) {
  console.error('Deployment branch cannot be empty.');
  process.exit(1);
}

for (const variable of ['CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID']) {
  if (process.env[variable] && process.env[variable] !== accountId) {
    console.error(`Refusing deployment: ${variable} must match the Solo.io account (${accountId}).`);
    process.exit(1);
  }
}

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run([fileURLToPath(new URL('build.mjs', import.meta.url))]);
console.log(`Cloudflare account: Solo.io (${accountId})`);

const commands = [];
if (values.create) commands.push(['pages', 'project', 'create', values.project, '--production-branch', 'main']);
commands.push(['pages', 'deploy', 'dist', '--project-name', values.project, '--branch', values.branch]);

for (const command of commands) {
  console.log(`wrangler ${command.map((argument) => JSON.stringify(argument)).join(' ')}`);
  if (!values['dry-run']) {
    run([fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url)), ...command]);
  }
}