import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

test('reference UI filters Agent status and preserves selection on reload', {
  skip: !process.env.REFERENCE_UI_URL && 'Set REFERENCE_UI_URL to the isolated reference Vite server.',
}, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(new URL('/agents', process.env.REFERENCE_UI_URL).href);
    const filter = page.getByRole('combobox', { name: 'Filter by status', exact: true });
    await filter.waitFor();
    const rows = page.locator('[data-testid="agents-table"] tbody tr[data-row-key]');
    await rows.first().waitFor();
    const before = await rows.count();
    await filter.click();
    await page.locator('.ant-select-item-option').filter({ hasText: /^Ready$/ }).click();
    await page.waitForURL(/status=ready/);
    await page.waitForFunction(() => {
      const tags = [...document.querySelectorAll('[data-testid^="agent-revision-"]')];
      return tags.length > 0 && tags.every((tag) => tag.textContent === 'Ready');
    });
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByTestId('agents-filters-pill-status-ready').waitFor();
    await page.getByTestId('agents-filters-pill-clear').click();
    await page.waitForURL((url) => !url.searchParams.has('status'));
    await page.waitForFunction((count) => document.querySelectorAll('[data-testid="agents-table"] tbody tr[data-row-key]').length === count, before);
    assert.equal(await rows.count(), before);
    await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
    await page.screenshot({ path: new URL('../test-results/reference-ui.png', import.meta.url).pathname });
  } finally {
    await browser.close();
  }
});