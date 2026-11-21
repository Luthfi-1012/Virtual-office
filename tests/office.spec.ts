import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openFixture(page: Page, client: string) {
  await page.goto('/');
  await expect(page.getByText('Tersambung ke penyimpanan lokal', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Brief baru', exact: true }).click();
  await page.getByRole('button', { name: 'Isi contoh Kopi Senja' }).click();
  await page.getByLabel('Nama klien sintetis').fill(client);
}

test('preserves recovery identity when snapshot authorization fails after a committed mutation', async ({ page }) => {
  await openFixture(page, 'Kopi Sesi Berubah');
  const before = await page.locator('.job-card').count();
  let posts = 0;
  let rejectedSnapshot = false;
  await page.route('**/api/office', route => {
    if (route.request().method() === 'POST') { posts++; return route.continue(); }
    if (posts && !rejectedSnapshot) {
      rejectedSnapshot = true;
      return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Sesi snapshot ditolak.' }) });
    }
    return route.continue();
  });
  await page.getByRole('button', { name: 'Proses uji lokal', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Periksa koneksi' }).click();
  await expect(page.getByRole('region', { name: 'Form brief' })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Operasi ditemukan' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Paket pekerjaan' }).getByRole('heading', { name: 'Kopi Sesi Berubah', exact: true })).toBeVisible();
  await expect(page.locator('.job-card')).toHaveCount(before + 1);
  expect(posts).toBe(1);
});

for (const choice of ['reapply', 'discard']) test(`retains a conflicted revision draft until explicit ${choice}`, async ({ page, context }) => {
  await openFixture(page, `Kopi Konflik ${choice}`);
  await page.getByRole('button', { name: 'Proses uji lokal', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Form brief' })).toHaveCount(0);
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByTestId('package-version')).toHaveText('Versi 1');
  await page.getByRole('button', { name: 'Revisi brief' }).click();
  await page.getByLabel('Tagline').fill('Draf milik tab pertama.');
  await other.getByRole('button', { name: 'Revisi brief' }).click();
  await other.getByLabel('Tagline').fill('Perubahan dari tab kedua.');
  await other.getByRole('button', { name: 'Simpan versi baru' }).click();
  await expect(other.getByTestId('package-version')).toHaveText('Versi 2');
  await page.getByRole('button', { name: 'Simpan versi baru' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(/versi/i);
  await page.getByRole('button', { name: 'Periksa koneksi' }).click();
  await expect(page.getByTestId('package-version')).toHaveText('Versi 2');
  await expect(page.getByLabel('Tagline')).toHaveValue('Draf milik tab pertama.');
  await expect(page.getByRole('button', { name: 'Simpan versi baru' })).toBeDisabled();
  if (choice === 'reapply') {
    await page.getByRole('button', { name: 'Terapkan draf ke versi terbaru' }).click();
    await page.getByRole('button', { name: 'Simpan versi baru' }).click();
    await expect(page.getByTestId('package-version')).toHaveText('Versi 3');
    await expect(page.getByTestId('job-status')).toHaveText('Menunggu founder');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.frameLocator('iframe').getByRole('heading', { level: 1 })).toHaveText('Draf milik tab pertama.');
  } else {
    await page.getByRole('button', { name: 'Buang draf' }).click();
    await expect(page.getByRole('region', { name: 'Form brief' })).toHaveCount(0);
    await expect(page.getByTestId('package-version')).toHaveText('Versi 2');
  }
  await other.close();
});

test('reconciles a committed request after lost response and reload without resending', async ({ page }) => {
  await openFixture(page, 'Kopi Respons Hilang');
  const before = await page.locator('.job-card').count();
  let posts = 0;
  await page.route('**/api/office', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    posts++;
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    await route.abort('connectionfailed');
  });
  await page.getByRole('button', { name: 'Proses uji lokal', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Hasil operasi belum diketahui');
  await expect(page.getByRole('button', { name: 'Brief baru', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Operasi ditemukan' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Paket pekerjaan' }).getByRole('heading', { name: 'Kopi Respons Hilang', exact: true })).toBeVisible();
  await expect(page.locator('.job-card')).toHaveCount(before + 1);
  await expect(page.getByTestId('package-version')).toHaveText('Versi 1');
  expect(posts).toBe(1);
});

test('retries an unrecorded operation explicitly with the same identity', async ({ page }) => {
  await openFixture(page, 'Kopi Kirim Ulang');
  const before = await page.locator('.job-card').count();
  const keys: string[] = [];
  await page.route('**/api/office', route => {
    if (route.request().method() !== 'POST') return route.continue();
    keys.push(route.request().postDataJSON().key);
    return keys.length === 1 ? route.abort('connectionfailed') : route.continue();
  });
  await page.getByRole('button', { name: 'Proses uji lokal', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Hasil operasi belum diketahui');
  await expect(page.getByRole('button', { name: 'Kirim ulang operasi yang sama' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Periksa koneksi' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Operasi belum tercatat');
  await expect(page.locator('.job-card')).toHaveCount(before);
  await page.getByRole('button', { name: 'Kirim ulang operasi yang sama' }).click();
  await expect(page.getByRole('region', { name: 'Form brief' })).toHaveCount(0);
  await expect(page.getByTestId('job-status')).toHaveText('Menunggu founder');
  await expect(page.getByRole('region', { name: 'Paket pekerjaan' }).getByRole('heading', { name: 'Kopi Kirim Ulang', exact: true })).toBeVisible();
  await expect(page.locator('.job-card')).toHaveCount(before + 1);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
});

test('renders hostile structured text inertly in an opaque preview without external requests', async ({ page }, testInfo) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const sandboxWarnings: string[] = [];
  page.on('console', message => {
    if (!['error', 'warning'].includes(message.type())) return;
    if (message.text() === "Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.") sandboxWarnings.push(message.text());
    else errors.push(message.text());
  });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['http:', 'https:'].includes(url.protocol) && url.hostname !== '127.0.0.1') { external.push(url.origin); return route.abort(); }
    return route.continue();
  });
  await openFixture(page, 'Kopi Uji Isolasi');
  const hostile = '<img src="https://example.invalid/x" onerror="alert(1)">';
  await page.getByLabel('Tagline').fill(hostile);
  await page.getByLabel('Deskripsi bisnis').fill('</style><script>alert(1)</script> Data uji keamanan sintetis.');
  await page.getByRole('button', { name: 'Proses uji lokal', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Form brief' })).toHaveCount(0);
  await expect(page.getByTestId('job-status')).toHaveText('Menunggu founder');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('heading', { level: 1 })).toHaveText(hostile);
  await expect(frame.locator('script, img, iframe, form, object, embed, link')).toHaveCount(0);
  expect(await frame.locator('body').evaluate(() => window.origin)).toBe('null');
  await page.getByRole('button', { name: 'Ponsel', exact: true }).click();
  await frame.getByText('Jam buka & lokasi', { exact: true }).click();
  await expect(frame.getByText('Jalan Contoh No. 12, Kota Fiktif')).toBeVisible();
  expect(await frame.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('iframe').screenshot({ path: testInfo.outputPath('isolated-preview-mobile.png') });
  testInfo.annotations.push({ type: 'browser-note', description: `${sandboxWarnings.length} sandbox policy diagnostics; reproduced on a script-free native disclosure control. Sandbox permissions remain empty.` });
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('rejects stale approval from another tab and refreshes the new package version', async ({ page, context }) => {
  await openFixture(page, 'Kopi Dua Tab');
  await page.getByRole('button', { name: 'Proses uji lokal', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Form brief' })).toHaveCount(0);
  await expect(page.getByTestId('job-status')).toHaveText('Menunggu founder');
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByTestId('package-version')).toHaveText('Versi 1');
  await page.getByRole('button', { name: 'Revisi brief' }).click();
  await page.getByLabel('Tagline').fill('Paket versi kedua.');
  await page.getByRole('button', { name: 'Simpan versi baru' }).click();
  await expect(page.getByTestId('package-version')).toHaveText('Versi 2');
  await other.getByRole('button', { name: 'Setujui paket internal' }).click();
  await expect(other.getByRole('main').getByRole('alert')).toContainText(/versi/i);
  await expect(other.getByRole('button', { name: 'Setujui paket internal' })).toBeDisabled();
  await other.getByRole('button', { name: 'Periksa koneksi' }).click();
  await expect(other.getByTestId('package-version')).toHaveText('Versi 2');
  await expect(other.getByTestId('job-status')).toHaveText('Menunggu founder');
  await other.getByRole('button', { name: 'Riwayat', exact: true }).click();
  await expect(other.getByText(/Founder menyetujui versi paket internal ini/)).toHaveCount(0);
  await other.close();
});

test('local brief produces reviewable isolated preview and version-bound approval', async ({ page }, testInfo) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['http:', 'https:'].includes(url.protocol) && url.hostname !== '127.0.0.1') { external.push(url.origin); return route.abort(); }
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByText('Tersambung ke penyimpanan lokal', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('office-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Brief baru', exact: true }).click();
  await page.getByRole('button', { name: 'Proses uji lokal', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Lengkapi');
  await page.getByRole('button', { name: 'Isi contoh Kopi Senja' }).click();
  await page.getByRole('button', { name: 'Proses uji lokal', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Form brief' })).toHaveCount(0);
  await expect(page.getByTestId('job-status')).toHaveText('Menunggu founder');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Preview website internal"]');
  await expect(frame.getByRole('heading', { level: 1 })).toHaveText('Ruang jeda, secangkir cerita.');
  await frame.getByText('Jam buka & lokasi', { exact: true }).click();
  await expect(frame.getByText('Jalan Contoh No. 12, Kota Fiktif')).toBeVisible();
  expect(await page.locator('iframe').getAttribute('sandbox')).toBe('');
  await page.screenshot({ path: testInfo.outputPath('office-preview.png'), fullPage: true });
  await page.getByRole('button', { name: 'Invoice', exact: true }).click();
  await expect(page.getByTestId('invoice-total')).toContainText('5.500.000');
  await expect(page.getByText('terkirim (simulasi)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tahan paket' }).click();
  await expect(page.getByRole('region', { name: 'Form brief' })).toHaveCount(0);
  await expect(page.getByTestId('job-status')).toHaveText('Menunggu founder');
  await page.getByRole('button', { name: 'Setujui paket internal' }).click();
  await expect(page.getByTestId('job-status')).toHaveText('Disetujui internal');
  await page.reload();
  await expect(page.getByTestId('job-status')).toHaveText('Disetujui internal');
  await page.getByRole('button', { name: 'Revisi brief' }).click();
  await page.getByLabel('Tagline').fill('Cerita baru di setiap cangkir.');
  await page.getByRole('button', { name: 'Simpan versi baru' }).click();
  await expect(page.getByRole('region', { name: 'Form brief' })).toHaveCount(0);
  await expect(page.getByTestId('job-status')).toHaveText('Menunggu founder');
  await expect(page.getByTestId('package-version')).toContainText('2');
  await page.getByRole('button', { name: 'Riwayat', exact: true }).click();
  await expect(page.getByText(/Founder menyetujui versi paket internal ini/)).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('office agents remain honest and usable on mobile, keyboard and offline', async ({ page, context }, testInfo) => {
  await page.goto('/');
  await expect(page.getByText('Tersambung ke penyimpanan lokal', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pilih Backend Agent', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backend Agent', exact: true })).toBeVisible();
  await expect(page.getByTestId('native-status')).toHaveText('Koneksi terputus · status tidak diketahui');
  await expect(page.getByRole('button', { name: /^Pause/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Daftar agent', exact: true }).click();
  await page.getByRole('button', { name: 'Detail Billing Agent', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Billing Agent', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Detail Billing Agent', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('office-mobile.png'), fullPage: true });
  await context.setOffline(true);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Offline');
  await expect(page.getByRole('button', { name: 'Brief baru', exact: true })).toBeDisabled();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Periksa koneksi' }).click();
  await expect(page.getByText('Tersambung ke penyimpanan lokal', { exact: true })).toBeVisible();
});
