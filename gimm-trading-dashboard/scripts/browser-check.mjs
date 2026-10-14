import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const fixtureArguments = ['--experimental-strip-types', 'scripts/preview.ts', '--ci'];
if (!process.argv.includes('--fresh')) fixtureArguments.push('--built');
const docker = process.argv.includes('--docker');
const fixture = docker ? null : spawn(process.execPath, fixtureArguments, { env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
const errors = [];
const checks = [];
function check(name) { checks.push(name); console.log(`PASS: ${name}`); }

try {
  const connection = docker ? { url: 'http://127.0.0.1:3100', username: 'preview', password: 'gimm-local-preview-only' } : await new Promise((resolve, reject) => {
    let output = '', stderr = '';
    const timeout = setTimeout(() => reject(new Error('Preview startup timed out')), 120000);
    fixture.stderr.on('data', data => { stderr += data.toString(); });
    fixture.stdout.on('data', data => {
      output += data.toString();
      const match = /GIMM_PREVIEW_READY (.+)\n/.exec(output);
      if (match) { clearTimeout(timeout); resolve(JSON.parse(match[1])); }
    });
    fixture.once('exit', code => { clearTimeout(timeout); reject(new Error(`Preview exited (${code}): ${stderr || output}`)); });
  });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'en-GB', timezoneId: 'Europe/Berlin', acceptDownloads: true });
  await context.route('**/*', route => route.request().url().startsWith(connection.url) ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const screenshot = async name => {
    await page.evaluate(() => window.scrollTo(0, 0));
    return page.screenshot({ path: resolve(artifacts, name + '.png'), fullPage: !name.includes('trade-detail') });
  };
  const chartsReady = () => page.waitForFunction(() => document.querySelectorAll('.chart-skeleton').length === 0, undefined, { timeout: 15000 });
  const noOverflow = async width => {
    const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    assert.ok(dimensions.content <= dimensions.viewport + 1, `Page overflows at ${width}px: ${JSON.stringify(dimensions)}`);
  };

  await page.goto(connection.url + '/login');
  await page.getByRole('heading', { name: 'Dein Dashboard wartet.' }).waitFor();
  await screenshot('login-desktop');
  await page.getByLabel('Benutzername', { exact: true }).fill(connection.username);
  await page.getByLabel('Passwort', { exact: true }).fill(connection.password);
  await page.getByRole('button', { name: 'Passwort anzeigen' }).click();
  assert.equal(await page.getByLabel('Passwort', { exact: true }).getAttribute('type'), 'text');
  await page.getByRole('button', { name: 'Passwort verbergen' }).click();
  await page.getByRole('button', { name: 'Zum Dashboard' }).click();
  await page.waitForURL(/\/dashboard/);
  await page.getByRole('heading', { name: 'Master Trading Dashboard' }).waitFor();
  await chartsReady();
  assert.ok(await page.locator('canvas').count() >= 4, 'Expected rendered charts');
  await noOverflow(1440);
  await screenshot('overview-desktop');
  await page.screenshot({ path: resolve(artifacts, 'overview-desktop-viewport.png') });
  check('desktop login, password toggle, authenticated dashboard and rendered charts');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('h1')).color === 'rgb(32, 33, 57)', undefined, { timeout: 5000 });
  assert.equal(await page.locator('h1').evaluate(element => getComputedStyle(element).color), 'rgb(32, 33, 57)', 'Light-mode headings must remain readable');
  await screenshot('overview-light');
  await page.reload();
  await page.getByRole('button', { name: 'Switch to dark mode' }).waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await chartsReady();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  check('light and dark modes, rendered charts and persisted theme after reload');
  await page.getByRole('heading', { name: 'Traders Skill Level', exact: true }).waitFor();
  assert.ok(await page.locator('.skill-radar').getAttribute('aria-label'));
  assert.equal(await page.getByText('NINJA RANK', { exact: true }).count(), 0);
  await page.getByText('How your score works', { exact: true }).click();
  await page.getByText('How your score works', { exact: true }).click();
  check('0–100 skill score, radar and score explanation');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('combobox', { name: 'Dashboard outcome', exact: true }).selectOption('loss');
  assert.ok((await page.locator('.metric-value').first().textContent()).startsWith('-'));
  assert.equal(await page.locator('.skill-rank>strong').textContent(), '0/ 100');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByRole('combobox', { name: 'Dashboard instrument', exact: true }).selectOption('XAU/USD');
  for (const pair of await page.locator('tbody .pair-cell').allTextContents()) assert.ok(pair.includes('XAU/USD'));
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.locator('[aria-label="Calendar values"]').getByRole('button', { name: 'Win rate', exact: true }).click();
  assert.ok((await page.locator('.calendar-cell.has-trades strong').first().textContent()).includes('%'));
  await page.locator('[aria-label="Calendar values"]').getByRole('button', { name: 'Net P&L', exact: true }).click();
  assert.ok(await page.locator('.calendar-week').count() >= 4);
  check('dashboard filters update score, metrics, recent trades and calendar values');



  await page.getByRole('button', { name: 'Balance', exact: true }).click();
  await page.getByRole('button', { name: 'Drawdown', exact: true }).click();
  await page.getByRole('img', { name: 'Drawdown from cumulative realized trading P&L' }).waitFor();
  await page.getByRole('button', { name: 'P&L', exact: true }).click();
  check('equity, balance and drawdown modes');

  const navigate = async label => {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: label, exact: true }).click();
    await page.waitForLoadState('networkidle');
  };
  await navigate('Trade journal');
  await page.getByRole('heading', { name: 'Every trade. Every lesson.' }).waitFor();
  await page.getByRole('searchbox', { name: 'Search trades' }).fill('XAU/USD');
  assert.ok(await page.locator('tbody tr').count() > 0);
  for (const instrument of await page.locator('tbody .pair-cell').allTextContents()) assert.ok(instrument.includes('XAU/USD'));
  await page.getByRole('combobox', { name: 'Trade outcome' }).selectOption('loss');
  for (const pnl of await page.locator('tbody .table-pnl').allTextContents()) assert.ok(pnl.trim().startsWith('-'));
  await page.getByRole('searchbox', { name: 'Search trades' }).fill('nothing-matches-this');
  await page.getByRole('heading', { name: 'No trades match your filters' }).waitFor();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloading;
  const csv = await readFile(await download.path(), 'utf8');
  assert.ok(csv.includes('Net EUR')); assert.ok(csv.split('\r\n').length > 30, 'Export should include all filtered trades');
  await page.getByRole('button', { name: 'Next trade page' }).click();
  assert.ok((await page.locator('.table-footer').textContent()).includes('13–24'));
  await page.getByRole('button', { name: 'Previous trade page' }).click();
  await page.getByRole('button', { name: /View trade/ }).first().click();
  await page.getByRole('dialog').waitFor();
  await screenshot('trade-detail-desktop');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('button', { name: /View trade/ }).first().evaluate(element => element === document.activeElement), true, 'Closing the dialog should restore focus to its trade button');
  await screenshot('journal-desktop');
  check('journal search, combined filters, empty state, full CSV export, pagination and accessible trade dialog');

  await navigate('Trading calendar');
  await page.locator('.calendar-cell.has-trades').first().click();
  await page.locator('.calendar-day-detail').waitFor();
  await page.locator('.day-trade').first().click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Close trade details' }).click();
  const monthBefore = await page.locator('.calendar-controls strong').textContent();
  await page.getByRole('button', { name: 'Previous month' }).click();
  assert.notEqual(await page.locator('.calendar-controls strong').textContent(), monthBefore);
  await page.getByRole('button', { name: 'Next month' }).click();
  await chartsReady();
  await screenshot('calendar-desktop');
  check('calendar month navigation, daily breakdown and linked trade details');

  await navigate('Analytics');
  await page.getByRole('heading', { name: 'Understand your edge.' }).waitFor();
  await chartsReady();
  await page.getByRole('heading', { name: 'Recorded confluence outcomes' }).waitFor();
  await page.getByRole('heading', { name: 'MFE & MAE · 30 minutes' }).waitFor();
  await page.getByRole('img', { name: 'MFE versus MAE for trades with both 30 minute measurements' }).waitFor();
  const excursionChart = page.getByRole('img', { name: 'MFE versus MAE for trades with both 30 minute measurements' });
  await excursionChart.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const chart = document.querySelector('[aria-label="MFE versus MAE for trades with both 30 minute measurements"] canvas');
    if (!chart) return false;
    const pixels = chart.getContext('2d').getImageData(0, 0, chart.width, chart.height).data;
    let markers = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 100 && pixels[i] < 180 && pixels[i + 1] > 90 && pixels[i + 1] < 160 && pixels[i + 2] > 200 && pixels[i + 3] > 100 || pixels[i] < 50 && pixels[i + 1] > 160 && pixels[i + 2] < 160 && pixels[i + 3] > 100 || pixels[i] > 200 && pixels[i + 1] < 100 && pixels[i + 2] < 150 && pixels[i + 3] > 100) markers++;
    return markers > 100;
  }, undefined, { timeout: 10000 });
  await noOverflow(1440);
  await page.getByRole('combobox', { name: 'Setup group' }).selectOption('Setup');
  await page.getByRole('combobox', { name: 'Minimum sample size' }).selectOption('10');
  await page.getByRole('button', { name: 'Win rate', exact: true }).click();
  await screenshot('analytics-desktop');
  check('analytics charts, setup group, minimum sample and metric switching');

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Analytics', exact: true }).click();
    await page.getByRole('heading', { name: 'MFE & MAE · 30 minutes' }).waitFor();
    await chartsReady(); await noOverflow(width);
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Overview', exact: true }).click();
    await page.getByRole('heading', { name: 'Master Trading Dashboard' }).waitFor();
    await chartsReady(); await noOverflow(width);
    if (width === 390) await screenshot('overview-mobile');
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Journal', exact: true }).click();
    await page.getByRole('heading', { name: 'Every trade. Every lesson.' }).waitFor();
    await noOverflow(width);
    if (width === 390) await screenshot('journal-mobile');
  }
  check('mobile navigation and contained layouts at 390px and 320px');
  await page.getByRole('combobox', { name: 'Account filter' }).selectOption('Backtest');
  await page.getByRole('heading', { name: 'Your journal starts with your next trade' }).waitFor();
  await page.getByRole('combobox', { name: 'Account filter' }).selectOption('Forwardtesting');
  await page.getByRole('button', { name: '30D', exact: true }).click();
  await page.waitForURL(/period=30d/);
  assert.ok(page.url().includes('view=journal'));
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByRole('heading', { name: 'Master Trading Dashboard' }).waitFor();
  await page.getByRole('combobox', { name: 'Account filter' }).selectOption('all');
  await page.waitForURL(/account=all/);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Balance' && button.disabled));
  assert.equal(await page.getByRole('button', { name: 'Balance', exact: true }).isDisabled(), true, 'Independent account balances must not be presented as a consolidated account curve');
  check('account and period filters preserve views and prevent misleading combined balances');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.waitForURL(/\/login/);
  await noOverflow(320);
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('login-mobile');
  await page.goto(connection.url + '/dashboard');
  await page.waitForURL(/\/login/);
  check('logout clears access to protected dashboard');
  assert.deepEqual(errors, [], 'No browser runtime, hydration or chart errors expected');
  check('no browser runtime, hydration or chart console errors');
  await writeFile(resolve(artifacts, 'browser-report.json'), JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  await writeFile(resolve(artifacts, 'browser-report.json'), JSON.stringify({ checks, errors, failure: String(error) }, null, 2));
  throw error;
} finally {
  await browser?.close();
  if (fixture && fixture.exitCode === null && fixture.signalCode === null) {
    const exited = once(fixture, 'exit'); fixture.kill('SIGTERM');
    const timeout = setTimeout(() => fixture.kill('SIGKILL'), 10000);
    await exited; clearTimeout(timeout);
  }
}
