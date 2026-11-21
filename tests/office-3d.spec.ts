import { test, expect } from '@playwright/test';

test('3D office is the primary workspace with functional camera controls', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Tersambung ke penyimpanan lokal', { exact: true })).toBeVisible();
  const canvas = page.locator('canvas[data-engine="three.js"]');
  await expect(canvas).toHaveAttribute('data-scene-ready', 'true', { timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Pilih Backend Agent', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pilih Backend Agent', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Detail agent' }).getByRole('heading', { name: 'Backend Agent', exact: true })).toBeVisible();
  await expect(page.getByTestId('native-status')).toHaveText('Koneksi terputus · status tidak diketahui');
  const zoom = page.getByTestId('scene-zoom');
  const initial = await zoom.textContent();
  await page.getByRole('button', { name: 'Perbesar tampilan', exact: true }).click();
  await expect(zoom).not.toHaveText(initial!);
  await page.getByRole('button', { name: 'Sesuaikan kantor', exact: true }).click();
  await expect(zoom).toHaveText('100%');
  await page.getByRole('button', { name: 'Fokus Development Room', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Detail agent' }).getByRole('heading', { name: 'Development Room', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Seluruh kantor', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('office-3d-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('redraws the 3D selection ring without camera movement', async ({ page }) => {
  await page.addInitScript(() => {
    for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const original = context.prototype.drawElements;
      context.prototype.drawElements = function (this: WebGLRenderingContext, ...args: unknown[]) {
        Reflect.set(window, '__officeDrawCalls', Number(Reflect.get(window, '__officeDrawCalls') ?? 0) + 1);
        return Reflect.apply(original, this, args);
      } as typeof original;
    }
  });
  await page.goto('/');
  const canvas = page.locator('canvas[data-engine="three.js"]');
  await expect(canvas).toHaveAttribute('data-scene-ready', 'true', { timeout: 30000 });
  const before = await page.evaluate(() => Number(Reflect.get(window, '__officeDrawCalls')));
  await page.getByRole('button', { name: 'Pilih Backend Agent', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Detail agent' }).getByRole('heading', { name: 'Backend Agent', exact: true })).toBeVisible();
  const after = await page.evaluate(() => Number(Reflect.get(window, '__officeDrawCalls')));
  expect(after).toBeGreaterThan(before);
});

test('HTML agent access remains available when WebGL cannot initialize', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.goto('/');
  await expect(page.getByText('Tampilan 3D tidak tersedia. Gunakan daftar agent untuk memilih peran.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Detail Billing Agent', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Detail agent' }).getByRole('heading', { name: 'Billing Agent', exact: true })).toBeVisible();
});

test('declares an original favicon without a browser 404', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /\/icon\.svg/);
  const icon = await page.request.get('/icon.svg');
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toContain('image/svg+xml');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test('caps canvas pixel density on high-DPI displays', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const canvas = page.locator('canvas[data-engine="three.js"]');
    await expect(canvas).toHaveAttribute('data-scene-ready', 'true', { timeout: 30000 });
    const metrics = await canvas.evaluate((element: HTMLCanvasElement) => ({
      width: element.width,
      cssWidth: element.getBoundingClientRect().width,
      dpr: window.devicePixelRatio,
    }));
    expect(metrics.dpr).toBe(2);
    expect(metrics.width).toBeGreaterThan(metrics.cssWidth);
    expect(metrics.width / metrics.cssWidth).toBeLessThanOrEqual(1.51);
  } finally {
    await context.close();
  }
});

test('runs realtime 4-agent activities without simulation buttons and honors reduced motion automatically', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.route('**/api/qoderwake', route => route.fulfill({ json: {
    status: 'disconnected', checkedAt: new Date().toISOString(), version: null,
    daemon: null, board: null, wakers: [], tasks: [], wakerTasks: [], activities: [], credits: null,
    message: 'Fixture offline: status native tidak dibaca.',
  } }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const canvas = page.locator('canvas[data-engine="three.js"]');
  await expect(canvas).toHaveAttribute('data-scene-ready', 'true', { timeout: 30000 });
  await expect(canvas).toHaveAttribute('data-motion-running', 'true');
  await expect(page.getByRole('button', { name: /lanjut simulasi/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /hentikan semua/i })).toHaveCount(0);

  const liveActivity = page.getByTestId('live-activity');
  await expect(liveActivity).toBeVisible();
  await expect(liveActivity).toContainText('agent bekerja di meja');

  const hotspot = page.getByRole('button', { name: 'Pilih Project Manager / Orchestrator', exact: true });
  const initial = await hotspot.getAttribute('style');
  await expect.poll(() => hotspot.getAttribute('style')).not.toBe(initial);

  await expect.poll(() => liveActivity.textContent(), { timeout: 45000 }).toMatch(/4 agent bekerja di meja/);
  const hotspots = page.locator('.agent-hotspot');
  const firstStyles = await hotspots.evaluateAll(elements => elements.map(element => element.getAttribute('style')));
  const firstActivity = await liveActivity.textContent();
  const first = await page.screenshot({ path: testInfo.outputPath('office-activities-before.png') });
  await page.waitForTimeout(10000);
  const second = await page.screenshot({ path: testInfo.outputPath('office-activities-after.png') });
  expect(second.equals(first)).toBe(false);
  const secondStyles = await hotspots.evaluateAll(elements => elements.map(element => element.getAttribute('style')));
  expect(secondStyles.filter((style, index) => style !== firstStyles[index]).length).toBeGreaterThanOrEqual(2);
  expect(await liveActivity.textContent()).not.toBe(firstActivity);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(canvas).toHaveAttribute('data-motion-running', 'false');
  await expect(liveActivity).toHaveText('Preferensi kurangi gerak aktif.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(canvas).toHaveAttribute('data-motion-running', 'true');
  expect(errors).toEqual([]);
});
