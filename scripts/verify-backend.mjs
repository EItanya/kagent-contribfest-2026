import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

export async function verifyBackend(source, ui, snippet) {
  const root = await mkdtemp(join(tmpdir(), 'kagent-controller-lab-'));
  function run(command, args, cwd = root) {
    const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `Backend check failed: ${command} ${args.join(' ')}`);
  }
  function replaceOnce(text, before, after) {
    assert.equal(text.split(before).length, 2, `Backend source anchor changed: ${before.slice(0, 100)}`);
    return text.replace(before, () => after);
  }
  try {
    const filter = (filename) => !['bin', 'dist', 'node_modules', '.git', 'tmp', '.venv', 'build'].includes(basename(filename)) && !basename(filename).startsWith('.env');
    await cp(join(source, 'go'), join(root, 'go'), { recursive: true, filter });
    const helper = join(root, 'go/core/internal/service/agentstatus');
    await mkdir(helper, { recursive: true });
    await writeFile(join(helper, 'status.go'), snippet('backend-helper') + '\n');
    await writeFile(join(helper, 'status_test.go'), snippet('backend-tests') + '\n');
    run('gofmt', ['-w', helper]);
    run('go', ['test', './core/internal/service/agentstatus', '-count=1', '-v'], join(root, 'go'));
    if (process.env.LAB_BACKEND_UNIT_ONLY === '1') return;

    for (const directory of ['proto', 'scripts', 'telemetry']) {
      await cp(join(source, directory), join(root, directory), { recursive: true, filter });
    }
    await cp(join(source, 'Makefile'), join(root, 'Makefile'));
    await symlink(ui, join(root, 'ui'), 'dir');
    const proto = join(root, 'proto/kagent/api/v1/agents.proto');
    let contract = await readFile(proto, 'utf8');
    const oldMessage = contract.match(/message Agent \{[\s\S]*?\n\}/)?.[0];
    assert.ok(oldMessage, 'Agent response message missing');
    contract = replaceOnce(contract, oldMessage, snippet('backend-proto'));
    await writeFile(proto, contract);
    run('make', ['proto-lint', 'proto-generate']);

    const handler = join(root, 'go/core/internal/grpcserver/agent.go');
    let handlerSource = await readFile(handler, 'utf8');
    handlerSource = replaceOnce(handlerSource, '\t"github.com/kagent-dev/kagent/go/core/internal/service/kubecrud"', '\t"github.com/kagent-dev/kagent/go/core/internal/service/agentstatus"\n\t"github.com/kagent-dev/kagent/go/core/internal/service/kubecrud"');
    const start = handlerSource.indexOf('\treturn &apiv1.Agent{', handlerSource.indexOf('func (s *agentServer) agent('));
    const end = handlerSource.indexOf('\n\t}, nil', start);
    assert.ok(start !== -1 && end !== -1, 'Agent mapper changed');
    handlerSource = handlerSource.slice(0, start) + snippet('backend-mapper') + handlerSource.slice(end + '\n\t}, nil'.length);
    await writeFile(handler, handlerSource);
    const tests = join(root, 'go/core/internal/grpcserver/agent_test.go');
    await writeFile(tests, (await readFile(tests, 'utf8')) + '\n' + snippet('backend-api-test') + '\n');
    run('gofmt', ['-w', handler, tests]);
    run('go', ['test', './core/internal/service/agentstatus', './core/internal/grpcserver', '-run', 'TestRevisionState$|TestAgentService', '-count=1', '-v'], join(root, 'go'));
    console.log('Backend snippets passed generation and focused Go/API tests.');
  } finally {
    if (process.env.KEEP_LAB === '1') console.log(`Reference backend: ${root}`);
    else await rm(root, { recursive: true, force: true });
  }
}