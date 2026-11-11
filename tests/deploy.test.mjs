import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/deploy.mjs', import.meta.url));

test('deployment dry-run builds and prints project creation and preview commands', () => {
  const result = spawnSync(process.execPath, [script, '--dry-run', '--create', '--project', 'workshop-test', '--branch', 'preview'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Built 11 chapters/);
  assert.match(result.stdout, /Cloudflare account: Solo\.io \(7d33c874b75a7afed3a44c6126896050\)/);
  assert.match(result.stdout, /"pages" "project" "create" "workshop-test" "--production-branch" "main"/);
  assert.match(result.stdout, /"pages" "deploy" "dist" "--project-name" "workshop-test" "--branch" "preview"/);
});

test('deployment rejects invalid project names before building or publishing', () => {
  const result = spawnSync(process.execPath, [script, '--project', 'Invalid Project'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Pages project name/);
  assert.doesNotMatch(result.stdout, /Built|wrangler/);
});

test('deployment rejects an empty branch', () => {
  const result = spawnSync(process.execPath, [script, '--branch', ''], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /branch cannot be empty/);
});

test('deployment refuses a different Cloudflare account before building', () => {
  for (const variable of ['CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID']) {
    const result = spawnSync(process.execPath, [script, '--dry-run'], {
      encoding: 'utf8',
      env: { ...process.env, [variable]: 'another-account' },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must match the Solo\.io account/);
    assert.doesNotMatch(result.stdout, /Built|wrangler/);
  }
});