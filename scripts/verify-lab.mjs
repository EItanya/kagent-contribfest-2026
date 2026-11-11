import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, symlink, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { marked } from 'marked';
import { verifyBackend } from './verify-backend.mjs';

const source = process.env.KAGENT_SOURCE;
if (!source) throw new Error('Set KAGENT_SOURCE to a kagent checkout with UI dependencies installed.');
const ui = resolve(source, 'ui');
if (process.env.LAB_INSTALL !== '1') await stat(join(ui, 'node_modules'));
const guide = await readFile(new URL('../participant-guide.md', import.meta.url), 'utf8');
const snippets = new Map();
let name;
for (const token of marked.lexer(guide)) {
  if (token.type === 'html') {
    const match = token.text.match(/^<!-- lab:([\w-]+) -->/);
    if (match) name = match[1];
  }
  if (token.type === 'code' && name) {
    snippets.set(name, token.text);
    name = undefined;
  }
}
function snippet(key) {
  assert.ok(snippets.has(key), `Missing lab snippet: ${key}`);
  return snippets.get(key);
}
function replaceOnce(text, before, after) {
  assert.equal(text.split(before).length, 2, `Source anchor changed: ${before.slice(0, 100)}`);
  return text.replace(before, () => after);
}
const sandbox = await mkdtemp(join(tmpdir(), 'kagent-contribfest-'));
try {
  await cp(ui, sandbox, {
    recursive: true,
    filter: (filename) => !['node_modules', 'dist', 'storybook-static', 'test-results', 'playwright-report', '.yarn', '.git'].includes(basename(filename)) && !basename(filename).startsWith('.env'),
  });
  if (process.env.LAB_INSTALL === '1') {
    const install = spawnSync('npm', ['install', '--ignore-scripts', '--package-lock=false', '--no-audit', '--no-fund'], { cwd: sandbox, stdio: 'inherit' });
    if (install.error) throw install.error;
    assert.equal(install.status, 0, 'Isolated UI dependency installation failed');
  } else {
    await symlink(join(ui, 'node_modules'), join(sandbox, 'node_modules'), 'dir');
  }
  const domain = join(sandbox, 'src/api/domain/agents.ts');
  await writeFile(domain, (await readFile(domain, 'utf8')) + '\n' + snippet('helper') + '\n');
  const tests = join(sandbox, 'src/api/domain/agents.test.ts');
  let testSource = await readFile(tests, 'utf8');
  testSource = replaceOnce(testSource,
    'import { agentDescription, agentRevisionState, newConversationBlockedReason, type Agent, type AgentStatus } from "./agents";',
    snippet('test-import'));
  await writeFile(tests, testSource + '\n' + snippet('tests') + '\n');
  const page = join(sandbox, 'src/pages/AgentsPage.tsx');
  let pageSource = await readFile(page, 'utf8');
  pageSource = replaceOnce(pageSource, '  agentRevisionState,\n', '  agentRevisionState,\n  matchesAgentStatus,\n');
  pageSource = replaceOnce(pageSource, 'const FILTER_IDS: readonly string[] = ["ns"];', snippet('filter-ids'));
  const start = pageSource.indexOf('  const filtered = useMemo(() => {');
  const endMarker = '  }, [agents, descriptions, view]);';
  const end = pageSource.indexOf(endMarker, start);
  assert.ok(start !== -1 && end !== -1, 'Filtered calculation changed');
  pageSource = pageSource.slice(0, start) + snippet('filtered') + pageSource.slice(end + endMarker.length);
  const namespaceFilter = '            options: namespaceOptions,\n          },';
  pageSource = replaceOnce(pageSource, namespaceFilter, namespaceFilter + '\n' + snippet('definition'));
  await writeFile(page, pageSource);

  if (process.env.LAB_BACKEND === '1') {
    await verifyBackend(resolve(source), sandbox, snippet);
    if (process.env.LAB_BACKEND_UNIT_ONLY !== '1') {
      let domainSource = await readFile(domain, 'utf8');
      domainSource = replaceOnce(domainSource, '  resource: AgentResource;\n', '  resource: AgentResource;\n  revisionState?: AgentRevisionState;\n');
      domainSource = replaceOnce(domainSource,
        'export function agentRevisionState({ resource: { metadata, status } }: Agent): AgentRevisionState {',
        snippet('backend-ui-state'));
      await writeFile(domain, domainSource + '\n' + snippet('backend-ui-parser') + '\n');
      let updatedTests = await readFile(tests, 'utf8');
      updatedTests = replaceOnce(updatedTests, '  matchesAgentStatus,\n', '  matchesAgentStatus,\n  revisionStateFromApi,\n');
      await writeFile(tests, updatedTests + '\n' + snippet('backend-ui-tests') + '\n');
      const operations = join(sandbox, 'src/api/grpc/operations.ts');
      let operationsSource = await readFile(operations, 'utf8');
      operationsSource = replaceOnce(operationsSource,
        'import type { Agent, AgentResource } from "../domain/agents";',
        'import { revisionStateFromApi, type Agent, type AgentResource } from "../domain/agents";');
      const mapperStart = operationsSource.indexOf('function toAgent(agent: PbAgent): Agent {');
      const mapperEnd = operationsSource.indexOf('\nconst agents:', mapperStart);
      assert.ok(mapperStart !== -1 && mapperEnd !== -1, 'UI Agent mapper changed');
      operationsSource = operationsSource.slice(0, mapperStart) + snippet('backend-ui-mapper') + '\n' + operationsSource.slice(mapperEnd);
      await writeFile(operations, operationsSource);
    }
  }

  function run(tool, args) {
    const result = spawnSync(process.execPath, [join(sandbox, 'node_modules', tool), ...args], { cwd: sandbox, stdio: 'inherit' });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `Lab validation failed: ${tool}`);
  }
  if (process.env.LAB_BACKEND_UNIT_ONLY !== '1') {
    run('vitest/vitest.mjs', ['run', 'src/api/domain/agents.test.ts']);
    run('typescript/bin/tsc', ['--noEmit']);
    console.log('Lab snippets passed existing/new unit tests and UI type checking.');
  }
  if (process.env.KEEP_LAB === '1') console.log(`Reference UI: ${sandbox}`);
} finally {
  if (process.env.KEEP_LAB !== '1') await rm(sandbox, { recursive: true, force: true });
}