import { expect, test, type Page } from '@playwright/test';
import { agents } from '../src/lib/agents';
import type { QoderWakeSnapshot } from '../src/lib/qoderwake';

const checkedAt = '2026-11-20T07:00:00.000Z';
function fixture(active = true): QoderWakeSnapshot {
  return {
    status: 'live', checkedAt, version: '1.2.22',
    daemon: { deviceStatus: 'online', sessionsTotal: active ? 1 : 0, sessionsRunning: active ? 1 : 0, agentCount: 8 },
    board: { total: active ? 1 : 0, byStatus: { waiting: 0, pending: 0, running: active ? 1 : 0, done: 0, failed: 0, cancelled: 0 }, attention: { approval: 0, acceptance: 0 }, generatedAt: checkedAt },
    wakers: agents.map(agent => ({ id: `agent-${agent.id}`, name: agent.name, status: 'online', executionLocation: 'local', onlineStatus: 'online', connectionStatus: 'connected', sessionCount: active && agent.id === 'backend' ? 1 : 0, taskCount: active && agent.id === 'backend' ? 1 : 0 })),
    tasks: active ? [{ id: 'task-test', title: '第 5 次运行 — Validasi API Kopi Senja', type: 'direct_session', status: 'running', rawStatus: 'running', assigneeId: 'agent-backend', assigneeName: 'Backend Agent', sourceType: 'conversation', sourceName: 'Backend Agent', updatedAt: checkedAt, lastActiveAt: checkedAt }] : [],
    activities: active ? [{ id: 'session-test', wakerId: 'agent-backend', title: 'Menyiapkan kontrak API', status: 'running', startedAt: checkedAt, lastActiveAt: checkedAt, endedAt: null, source: 'console', scenario: 'direct' }] : [],
    message: null,
  };
}
const disconnected: QoderWakeSnapshot = { status: 'disconnected', checkedAt: '2026-11-20T07:00:10.000Z', version: null, daemon: null, board: null, wakers: [], tasks: [], activities: [], message: 'CLI tidak tersedia untuk pengujian.' };
async function disableWebGL(page: Page) {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
}
async function capture(page: Page, name: string) {
  if (process.env.OFFICE_CAPTURE === '1') await page.screenshot({ path: `.local/visual-refinement/snapshot-${name}-fixture-1440x1000.png`, fullPage: false });
}
async function open(page: Page, snapshot: () => QoderWakeSnapshot) {
  await page.clock.install({ time: new Date(checkedAt) });
  await page.route('**/api/qoderwake', route => route.fulfill({ json: snapshot() }));
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-scene-ready', 'true');
  await expect(page.getByRole('button', { name: 'Periksa koneksi' })).toBeEnabled();
}

test('labels fresh snapshots without streaming claims and preserves original task titles', async ({ page }) => {
  await open(page, () => fixture());
  await page.getByRole('button', { name: 'Pilih Backend Agent', exact: true }).click();
  await expect(page.getByTestId('native-status')).toContainText('Task aktif · running');
  await expect(page.getByRole('complementary').getByText('第 5 次运行 — Validasi API Kopi Senja', { exact: true })).toBeVisible();
  await expect(page.getByTestId('snapshot-status')).toHaveText('Terbaru');
  await expect(page.getByTestId('snapshot-checked')).toHaveAttribute('datetime', checkedAt);
  await expect(page.locator('.mode-banner')).toContainText('Snapshot QoderWake');
  await expect(page.locator('.mode-banner')).not.toContainText('LIVE');
  await expect(page.getByText('Simulasi kantor', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pause/ })).toHaveCount(0);
  const backend = page.getByRole('button', { name: 'Pilih Backend Agent', exact: true });
  const before = await backend.getAttribute('style');
  await page.getByRole('button', { name: 'Lanjutkan simulasi kantor' }).click();
  await page.clock.runFor(500);
  expect(await backend.getAttribute('style')).toBe(before);
  await page.getByRole('button', { name: 'Hentikan semua gerakan simulasi' }).click();
  await capture(page, 'fresh-active');
});

test('keeps the refresh loading beyond 15 seconds and accepts a late snapshot', async ({ page }) => {
  await page.clock.install({ time: new Date(checkedAt) });
  let release: () => void = () => undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/qoderwake', async route => {
    await gate;
    await route.fulfill({ json: fixture(false) });
  });
  const nativeRequest = page.waitForRequest(request => request.url().endsWith('/api/qoderwake'));
  await page.goto('/');
  await nativeRequest;
  await expect(page.locator('canvas')).toHaveAttribute('data-scene-ready', 'true');
  const refresh = page.getByRole('button', { name: 'Periksa koneksi' });
  await expect(refresh).toBeDisabled();
  await page.clock.fastForward(16000);
  try { await expect(refresh).toBeDisabled({ timeout: 1000 }); } finally { release(); }
  await expect(refresh).toBeEnabled();
  await expect(page.getByTestId('snapshot-status')).toHaveText('Terbaru');
  await expect(page.getByTestId('snapshot-checked')).toHaveAttribute('datetime', checkedAt);
});

for (const failure of ['disconnected', 'network', 'malformed'] as const) {
  test(`retains last successful time, hides old records and recovers after ${failure}`, async ({ page }) => {
    let broken = false;
    await open(page, () => fixture());
    await page.route('**/api/qoderwake', route => broken
      ? failure === 'network' ? route.abort() : route.fulfill({ json: failure === 'malformed' ? { status: 'live' } : disconnected })
      : route.fulfill({ json: fixture() }));
    await page.getByRole('button', { name: 'Pilih Backend Agent', exact: true }).click();
    broken = true;
    await page.getByRole('button', { name: 'Periksa koneksi' }).click();
    await expect(page.getByTestId('snapshot-status')).toHaveText('Koneksi terputus');
    await expect(page.getByTestId('snapshot-success')).toHaveAttribute('datetime', checkedAt);
    await expect(page.getByRole('complementary').getByText('第 5 次运行 — Validasi API Kopi Senja', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Tersambung ke penyimpanan lokal', { exact: true })).toBeVisible();
    await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'false');
    if (failure === 'network') await capture(page, 'disconnected');
    broken = false;
    await page.getByRole('button', { name: 'Periksa koneksi' }).click();
    await expect(page.getByTestId('snapshot-status')).toHaveText('Terbaru');
    await expect(page.getByTestId('native-status')).toContainText('Task aktif · running');
  });
}

test('expires without a network call and freezes animation instead of claiming idle', async ({ page }) => {
  let reads = 0;
  await open(page, () => { reads++; return fixture(false); });
  await page.getByRole('button', { name: 'Lanjutkan simulasi kantor' }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'true');
  await page.clock.fastForward(61000);
  await expect(page.getByTestId('snapshot-status')).toHaveText('Kedaluwarsa');
  await expect(page.getByTestId('native-status')).toContainText('Kedaluwarsa');
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'false');
  await expect(page.getByRole('button', { name: 'Lanjutkan simulasi kantor' })).toBeDisabled();
  await expect(page.getByTestId('snapshot-success')).toHaveAttribute('datetime', checkedAt);
  expect(reads).toBe(1);
  await capture(page, 'stale');
});

test('pauses and resumes local idle motion, then freezes immediately when that Waker receives a task', async ({ page }) => {
  let snapshot = fixture(false);
  const methods: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/qoderwake')) methods.push(request.method()); });
  await open(page, () => snapshot);
  const hotspot = page.getByRole('button', { name: 'Pilih Project Manager / Orchestrator', exact: true });
  await page.getByRole('button', { name: 'Lanjutkan simulasi kantor' }).click();
  await page.clock.runFor(500);
  await page.getByRole('button', { name: 'Jeda simulasi kantor' }).click();
  const position = await hotspot.getAttribute('style');
  await page.clock.runFor(1000);
  expect(await hotspot.getAttribute('style')).toBe(position);
  await page.getByRole('button', { name: 'Lanjutkan simulasi kantor' }).click();
  await page.clock.runFor(500);
  expect(await hotspot.getAttribute('style')).not.toBe(position);
  snapshot = fixture();
  snapshot.tasks[0].assigneeId = 'agent-pm';
  snapshot.tasks[0].assigneeName = agents[0].name;
  snapshot.wakers[0].taskCount = 1;
  await page.getByRole('button', { name: 'Periksa koneksi' }).click();
  await expect(page.getByTestId('native-status')).toContainText('Task aktif · running');
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'false');
  const held = await hotspot.getAttribute('style');
  await page.clock.runFor(1000);
  expect(await hotspot.getAttribute('style')).toBe(held);
  expect(methods.every(method => method === 'GET')).toBe(true);
});

test('keeps snapshot data and failed-refresh history accessible without WebGL', async ({ page }) => {
  await disableWebGL(page);
  await page.clock.install({ time: new Date(checkedAt) });
  let snapshot = fixture();
  await page.route('**/api/qoderwake', route => route.fulfill({ json: snapshot }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Detail Backend Agent', exact: true }).click();
  await expect(page.getByTestId('snapshot-status')).toHaveText('Terbaru');
  await expect(page.getByTestId('native-status')).toContainText('Task aktif · running');
  snapshot = disconnected;
  await page.getByRole('button', { name: 'Periksa koneksi' }).click();
  await expect(page.getByTestId('snapshot-status')).toHaveText('Koneksi terputus');
  await expect(page.getByTestId('snapshot-success')).toHaveAttribute('datetime', checkedAt);
  await expect(page.getByRole('complementary').getByText('第 5 次运行 — Validasi API Kopi Senja', { exact: true })).toHaveCount(0);
});

for (const malformed of [{ board: {} }, { wakers: [null] }, { activities: [{ ...fixture().activities[0], lastActiveAt: 'invalid' }] }]) {
  test(`rejects malformed nested snapshot ${Object.keys(malformed)[0]} without losing success time`, async ({ page }) => {
    await disableWebGL(page);
    await page.clock.install({ time: new Date(checkedAt) });
    let broken = false;
    await page.route('**/api/qoderwake', route => route.fulfill({ json: broken ? { ...fixture(), checkedAt: '2026-11-20T07:00:01.000Z', ...malformed } : fixture() }));
    await page.goto('/');
    await expect(page.getByTestId('snapshot-status')).toHaveText('Terbaru');
    broken = true;
    await page.getByRole('button', { name: 'Periksa koneksi' }).click();
    await expect(page.getByTestId('snapshot-status')).toHaveText('Koneksi terputus');
    await expect(page.getByTestId('snapshot-success')).toHaveAttribute('datetime', checkedAt);
  });
}

test('does not restart native refresh after going offline during the office request', async ({ page, context }) => {
  await disableWebGL(page);
  await page.clock.install({ time: new Date(checkedAt) });
  await page.route('**/api/qoderwake', route => route.fulfill({ json: fixture() }));
  await page.goto('/');
  await expect(page.getByTestId('snapshot-status')).toHaveText('Terbaru');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let entered = false;
  await page.route('**/api/office', async route => {
    const response = await route.fetch();
    entered = true;
    await gate;
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Periksa koneksi' }).click();
  await expect.poll(() => entered).toBe(true);
  await context.setOffline(true);
  await expect(page.getByTestId('snapshot-status')).toHaveText('Koneksi terputus');
  release();
  await expect(page.getByRole('button', { name: 'Periksa koneksi' })).toBeEnabled();
  await expect(page.getByTestId('snapshot-status')).toHaveText('Koneksi terputus');
  await expect(page.getByText('Koneksi lokal belum terkonfirmasi', { exact: true })).toBeVisible();
  await context.setOffline(false);
});

test('does not let an in-flight response overwrite an offline state', async ({ page, context }) => {
  await open(page, () => fixture());
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let entered = false;
  await page.route('**/api/qoderwake', async route => { entered = true; await gate; await route.fulfill({ json: fixture() }).catch(() => {}); });
  await page.getByRole('button', { name: 'Periksa koneksi' }).click();
  await expect.poll(() => entered).toBe(true);
  await context.setOffline(true);
  await expect(page.getByTestId('snapshot-status')).toHaveText('Koneksi terputus');
  release();
  await expect(page.getByRole('button', { name: 'Periksa koneksi' })).toBeEnabled();
  await expect(page.getByTestId('snapshot-status')).toHaveText('Koneksi terputus');
  await expect(page.getByTestId('snapshot-success')).toHaveAttribute('datetime', checkedAt);
  await context.setOffline(false);
  await expect(page.getByTestId('snapshot-status')).toHaveText('Koneksi terputus');
});

for (const { id, action, name } of [
  { id: 'pm', action: 'Minum kopi di pantry', name: 'idle-pantry' },
  { id: 'design', action: 'Membaca buku di sudut fokus', name: 'idle-focus' },
  { id: 'delivery', action: 'Bermain konsol di lounge', name: 'idle-lounge' },
]) {
  test(`reaches ${name} locally with a selectable figure and a real pause`, async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    const methods: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('/api/')) methods.push(request.method()); });
    const snapshot = fixture(false);
    const companions = id === 'delivery' ? ['agent-design', 'agent-frontend'] : ['agent-qa', 'agent-delivery', 'agent-billing'];
    const eligible = new Set([`agent-${id}`, ...companions]);
    snapshot.wakers.forEach(waker => {
      if (!eligible.has(waker.id)) {
        waker.status = 'offline';
        waker.onlineStatus = 'offline';
        waker.connectionStatus = 'disconnected';
      }
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, () => snapshot);
    const agent = agents.find(item => item.id === id)!;
    const hotspot = page.getByRole('button', { name: `Pilih ${agent.name}`, exact: true });
    await hotspot.click();
    const start = await hotspot.getAttribute('style');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: 'Lanjutkan simulasi kantor' }).click();
    const hint = page.getByTestId('simulation-hint');
    for (let second = 0; second < 35 && !(await hint.textContent())?.includes(action); second++) await page.clock.runFor(1000);
    await expect(hint).toContainText(action);
    expect(await hotspot.getAttribute('style')).not.toBe(start);
    await expect(page.getByTestId('native-status')).toHaveText('Tanpa task aktif pada snapshot');
    await expect(page.getByText('Bukan aktivitas Waker sebenarnya', { exact: true })).toBeVisible();
    await capture(page, name);
    await page.getByRole('button', { name: 'Jeda simulasi kantor' }).click();
    const stopped = await hotspot.getAttribute('style');
    await page.clock.runFor(7000);
    expect(await hotspot.getAttribute('style')).toBe(stopped);
    await hotspot.click();
    await expect(page.getByRole('complementary', { name: 'Detail agent' }).getByRole('heading', { name: agent.name, exact: true })).toBeVisible();
    expect(methods.length).toBeGreaterThan(0);
    expect(methods.every(method => method === 'GET')).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('honors reduced motion changes and never resumes automatically', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, () => fixture(false));
  await expect(page.getByRole('button', { name: 'Lanjutkan simulasi kantor' })).toBeDisabled();
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'false');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Lanjutkan simulasi kantor' }).click();
  await page.clock.runFor(300);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'false');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'false');
  await page.getByRole('button', { name: 'Lanjutkan simulasi kantor' }).click();
  await page.getByRole('button', { name: 'Hentikan semua gerakan simulasi' }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'false');
});
