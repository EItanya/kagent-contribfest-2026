import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { marked } from 'marked';

test('workshop builds only required images and installs once after the code exercises', async () => {
  const guide = await readFile(new URL('../participant-guide.md', import.meta.url), 'utf8');
  const chapters = new Map(guide.split(/^## /m).slice(1).map((chapter) => {
    const newline = chapter.indexOf('\n');
    return [chapter.slice(0, newline), chapter.slice(newline + 1)];
  }));
  const commands = (text) => marked.lexer(text)
    .filter((token) => token.type === 'code' && token.lang?.startsWith('sh'))
    .map((token) => token.text).join('\n');
  const setup = commands(chapters.get('Prepare the Environment and Start Builds'));
  const installation = commands(chapters.get('Install the Updated Controller and UI'));
  const packaged = commands(chapters.get('Verify the Packaged UI'));
  const all = commands(guide);
  assert.match(setup, /git clone --branch main https:\/\/github\.com\/kagent-dev\/kagent\.git/);
  assert.match(guide, /Select the `main` branch\./);
  assert.doesNotMatch(setup, /git (?:switch|checkout)\b/);
  assert.doesNotMatch(guide, /ccb2dd350e06be990618f3e464fbb07d0d67ca3d|pinned source|pinned workshop|updates have been merged/);
  assert.match(setup, /make build-golang-adk build-claude-harness build-codex-harness VERSION=0\.0\.0-contribfest/);
  assert.doesNotMatch(setup, /make (?:kagent-cli-deploy|build-controller|build-ui)\b/);
  assert.match(installation, /make build-controller build-ui VERSION=0\.0\.0-contribfest AWK=awk BUILD_PROTO_GENERATE= &&\nmake kagent-cli-deploy/);
  assert.equal((all.match(/^make kagent-cli-deploy\b/gm) ?? []).length, 1);
  assert.equal((all.match(/^make build-golang-adk\b/gm) ?? []).length, 1);
  assert.equal((all.match(/^make build-controller build-ui\b/gm) ?? []).length, 1);
  assert.equal((all.match(/^corepack yarn install --immutable$/gm) ?? []).length, 1);
  assert.equal((all.match(/^make proto-lint proto-generate AWK=awk$/gm) ?? []).length, 1);
  assert.doesNotMatch(all, /^make (?:build(?:\s|$)|build-all\b|build-sandbox-guest\b|helm-dev\b|helm-install\b)|^corepack yarn build\b/m);
  assert.doesNotMatch(all, /VERSION="\$VERSION"/);
  assert.doesNotMatch(guide, /conference wi-fi|stale|old chart artifacts|presenter rehearsal/i);
  assert.doesNotMatch(all, /^helm (?:template|uninstall|list)\b/m);
  assert.doesNotMatch(packaged, /^make |rollout restart/m);
  assert.ok(guide.indexOf('<!-- lab:backend-ui-tests -->') < guide.indexOf('make build-controller build-ui VERSION='));
});

test('workshop navigation, controls, persistence, and responsive layout', async () => {
  const root = new URL('../dist/', import.meta.url);
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const name = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (name.includes('..')) throw new Error('Invalid path');
      const type = name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.js') ? 'text/javascript; charset=utf-8' : name.endsWith('.woff2') ? 'font/woff2' : name.endsWith('.svg') ? 'image/svg+xml' : 'text/plain; charset=utf-8';
      const content = await readFile(new URL(name, root));
      response.writeHead(200, { 'Content-Type': type });
      response.end(content);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator('.lesson:not([hidden])').waitFor();
    assert.equal(await page.locator('.lesson:not([hidden])').count(), 1);
    assert.equal(await page.locator('nav a').count(), 12);
    assert.equal(await page.locator('nav a[href="#contribute"]').count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Session slides' }).count(), 0);
    assert.equal((await page.request.get(`http://127.0.0.1:${server.address().port}/slides.html`)).status(), 404);
    assert.equal(await page.locator('nav a[href="#python-runtime"]').count(), 0);
    assert.equal(await page.locator('h1:visible').textContent(), 'What You Will Build');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#6d28d9');
    assert.equal(await page.locator('nav a[aria-current="page"]').evaluate((element) => getComputedStyle(element).color), 'rgb(109, 40, 217)');
    assert.equal(await page.getByRole('heading', { name: 'Start Here', exact: true }).isVisible(), true);
    assert.match(await page.locator('#feature').textContent(), /do not\s+need to install/);
    assert.match(await page.locator('#feature').textContent(), /GitHub Codespaces in the browser/);
    assert.equal(await page.locator('.repository').getAttribute('target'), '_blank');
    assert.equal(await page.locator('.repository').getAttribute('rel'), 'noopener noreferrer');
    const discord = page.getByRole('link', { name: 'kagent Discord', exact: true });
    assert.equal(await discord.getAttribute('href'), 'https://discord.gg/Fu3k65f2k3');
    assert.equal(await discord.getAttribute('target'), '_blank');
    assert.equal(await discord.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(await discord.isVisible(), true);
    await page.locator('nav a[href="#install"]').click();
    await page.waitForFunction(() => document.title.startsWith('Prepare & warm builds'));
    assert.match(await page.title(), /^Prepare & warm builds/);
    const codespacesTab = page.getByRole('tab', { name: 'GitHub Codespaces', exact: true });
    const localTab = page.getByRole('tab', { name: 'VS Code (Local)', exact: true });
    assert.equal(await codespacesTab.getAttribute('aria-selected'), 'true');
    assert.equal(await page.getByRole('tabpanel', { name: 'GitHub Codespaces' }).isVisible(), true);
    assert.equal(await page.locator('#setup-panel-local').isVisible(), false);
    await localTab.click();
    assert.equal(await localTab.getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#setup-panel-codespaces').isVisible(), false);
    assert.equal(await page.getByRole('heading', { name: 'Continue Here for Either Option' }).isVisible(), true);
    await localTab.press('ArrowLeft');
    assert.equal(await codespacesTab.evaluate((tab) => tab === document.activeElement), true);
    assert.equal(await codespacesTab.getAttribute('aria-selected'), 'true');
    await codespacesTab.press('End');
    assert.equal(await localTab.getAttribute('aria-selected'), 'true');
    await localTab.press('ArrowRight');
    assert.equal(await codespacesTab.getAttribute('aria-selected'), 'true');
    await codespacesTab.press('Home');
    await localTab.click();
    const copy = page.locator('.lesson:not([hidden]) .copy-button:visible').first();
    await copy.click();
    await page.waitForFunction(() => document.querySelector('.lesson:not([hidden]) .copy-button').getAttribute('aria-label') === 'Copied');
    assert.equal(await copy.getAttribute('aria-label'), 'Copied');
    assert.match(await page.evaluate(() => navigator.clipboard.readText()), /git clone/);
    await page.getByLabel('Complete', { exact: true }).check();
    assert.equal(await page.locator('.firework-spark').count(), 36);
    assert.equal(await page.locator('.firework-spark').first().evaluate((element) => getComputedStyle(element).animationDuration), '1.2s');
    assert.equal(await page.locator('.firework-spark').last().evaluate((element) => getComputedStyle(element).animationDelay), '0.32s');
    assert.equal(await page.locator('.completion-fireworks').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('.completion-fireworks').evaluate((element) => getComputedStyle(element).pointerEvents), 'none');
    await page.waitForFunction(() => !document.querySelector('.completion-fireworks'));
    await page.reload();
    assert.equal(await page.getByLabel('Complete', { exact: true }).isChecked(), true);
    assert.equal(await page.locator('.completion-fireworks').count(), 0);
    assert.equal(await page.locator('#progress-label').textContent(), '1 / 12 complete');
    await page.getByLabel('Complete', { exact: true }).uncheck();
    assert.equal(await page.locator('.completion-fireworks').count(), 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByLabel('Complete', { exact: true }).check();
    assert.equal(await page.locator('.completion-fireworks').count(), 0);
    assert.equal(await page.locator('#progress-label').textContent(), '1 / 12 complete');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('nav a[href="#function"]').click();
    const helperCode = page.locator('#function pre code.language-ts');
    const sourceLink = page.locator('#function a.source-link').first();
    assert.equal(await sourceLink.getAttribute('href'), 'https://github.com/kagent-dev/kagent/blob/main/ui/src/api/domain/agents.ts');
    assert.equal(await sourceLink.getAttribute('target'), '_blank');
    assert.equal(await sourceLink.getAttribute('rel'), 'noopener noreferrer');
    assert.match(await page.locator('#install .code-context').first().textContent(), /Parent of your kagent checkout/);
    assert.match(await page.locator('#run-ui .code-context').last().textContent(), /kagent\/ui\//);
    assert.equal(await page.locator('.code-context').count(), await page.locator('pre code.language-sh').count());
    assert.ok(await helperCode.locator('.hljs-keyword').count() > 0);
    const guide = await readFile(new URL('../participant-guide.md', import.meta.url), 'utf8');
    const helperSource = guide.match(/<!-- lab:helper -->\s*```ts\n([\s\S]*?)\n```/)[1];
    assert.equal((await helperCode.textContent()).trim(), helperSource);
    await page.locator('#function .copy-button').click();
    await page.waitForFunction(() => document.querySelector('#function .copy-button').getAttribute('aria-label') === 'Copied');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), helperSource);
    await page.locator('nav a[href="#backend"]').click();
    assert.equal(await page.locator('#backend a.source-link[title^="New file"]').first().getAttribute('href'), 'https://github.com/kagent-dev/kagent/tree/main/go/core/internal/service');
    assert.match(await page.locator('#backend .code-context').first().textContent(), /kagent\//);
    assert.match(await page.locator('#backend .code-context').last().textContent(), /kagent\/ui\//);
    assert.ok(await page.locator('#backend code.language-go .hljs-keyword').count() > 0);
    assert.ok(await page.locator('#backend code.language-go .hljs-string').count() > 0);
    assert.notEqual(await page.locator('#backend code.language-go .hljs-keyword').first().evaluate((element) => getComputedStyle(element).color), await page.locator('#backend code.language-go').first().evaluate((element) => getComputedStyle(element).color));
    await page.getByRole('searchbox').fill('zzzz-unmatched');
    assert.equal(await page.locator('#no-results').isVisible(), true);
    await page.getByRole('searchbox').fill('it("matches any selected state"');
    assert.equal(await page.locator('nav li:not([hidden])').count(), 1);
    await page.getByRole('searchbox').fill('');
    for (const id of ['feature', 'install', 'kagent', 'lifecycle', 'run-ui', 'function', 'tests', 'page', 'backend', 'deploy-controller', 'verify', 'deploy']) {
      await page.locator(`nav a[href="#${id}"]`).click();
      await page.waitForFunction((id) => !document.getElementById(id).hidden, id);
      assert.equal(await page.locator('.lesson:not([hidden])').getAttribute('id'), id);
      if (id === 'install') {
        const content = await page.locator('#install').textContent();
        assert.match(content, /cluster created during container startup/);
        assert.match(content, /make build-golang-adk build-claude-harness build-codex-harness VERSION=/);
        assert.doesNotMatch(content, /make kagent-cli-deploy VERSION=/);
        assert.doesNotMatch(content, /scripts\/get-kagent|kind create cluster --name/);
      }
      if (id === 'deploy-controller') {
        const content = await page.locator(`#${id}`).textContent();
        assert.match(content, /make kagent-cli-deploy/);
        assert.match(content, /make build-controller build-ui/);
        assert.match(content, /No separate UI production build or rollout restart is needed/);
        assert.doesNotMatch(content, /kubectl[^\n]*patch deployment/);
      }
      if (id === 'deploy') {
        const content = await page.locator(`#${id}`).textContent();
        assert.match(content, /UI image already installed/);
        assert.doesNotMatch(content, /make kagent-cli-deploy/);
        assert.doesNotMatch(content, /kubectl[^\n]*patch deployment/);
      }
    }
    await page.goto(`http://127.0.0.1:${server.address().port}/#feature`);
    await page.waitForFunction(() => document.title.startsWith('What you will build'));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
    await page.screenshot({ path: new URL('../test-results/desktop.png', import.meta.url).pathname });
    for (const width of [320, 375, 414, 768]) {
      await page.setViewportSize({ width, height: 900 });
      for (const id of ['feature', 'install', 'kagent', 'lifecycle', 'run-ui', 'function', 'tests', 'page', 'backend', 'deploy-controller', 'verify', 'deploy']) {
        await page.goto(`http://127.0.0.1:${server.address().port}/#${id}`);
        await page.locator('.lesson:not([hidden])').waitFor();
        if (id === 'install') {
          await page.getByRole('tab', { name: 'VS Code (Local)', exact: true }).click();
          assert.equal(await page.locator('#setup-panel-local').isVisible(), true);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Local setup overflow at ${width}px`);
          await page.getByRole('tab', { name: 'GitHub Codespaces', exact: true }).click();
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        assert.equal(overflow, false, `Overflow at ${width}px in ${id}`);
      }
    }
    await page.setViewportSize({ width: 375, height: 900 });
    assert.equal(await discord.isVisible(), true);
    assert.equal(await discord.locator('svg').count(), 1);
    await page.getByRole('button', { name: 'Open chapters' }).click();
    assert.equal(await page.locator('#search').evaluate((element) => element === document.activeElement), true);
    await page.locator('nav a[href="#page"]').click();
    await page.waitForFunction(() => !document.getElementById('page').hidden);
    assert.equal(await page.locator('#menu').getAttribute('aria-expanded'), 'false');
    await page.screenshot({ path: new URL('../test-results/mobile.png', import.meta.url).pathname, fullPage: true });
    await page.getByLabel('Complete', { exact: true }).check();
    assert.equal(await page.locator('.firework-spark').count(), 36);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.waitForFunction(() => !document.querySelector('.completion-fireworks'));
    await page.getByRole('button', { name: 'Open chapters' }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#menu').getAttribute('aria-expanded'), 'false');
    assert.deepEqual(errors, []);
    const direct = await context.newPage();
    await direct.goto(new URL('index.html', root).href + '#page');
    await direct.waitForFunction(() => document.title.startsWith('Connect the page'));
    assert.equal(await direct.locator('h1:visible').textContent(), 'Connect the Filter to the Page');
    assert.equal(await direct.locator('.brand img').evaluate((image) => image.complete && image.naturalWidth > 0), true);
    await direct.emulateMedia({ media: 'print' });
    assert.equal(await direct.locator('#setup-panel-local').isVisible(), true);
    assert.equal(await direct.locator('#setup-panel-codespaces').isVisible(), true);
    assert.equal(await direct.locator('.setup-tablist').isVisible(), false);
    await context.close();
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});