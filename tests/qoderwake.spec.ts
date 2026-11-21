import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { agents } from '../src/lib/agents';
import type { QoderWakeSnapshot } from '../src/lib/qoderwake';

const checkedAt = '2026-11-20T07:00:00.000Z';
const characterWakerId = (id: string) => agents.find(agent => agent.id === id)!.wakerId;
const recordedSnapshot = JSON.parse(readFileSync(new URL('./qoderwake-roster-2026-11-21.fixture.json', import.meta.url), 'utf8')) as QoderWakeSnapshot;

function fixture(active = true): QoderWakeSnapshot {
  return {
    status: 'live', checkedAt, version: '1.2.22',
    daemon: { deviceStatus: 'online', sessionsTotal: active ? 1 : 0, sessionsRunning: active ? 1 : 0, agentCount: 8 },
    board: { total: active ? 1 : 0, byStatus: { waiting: 0, pending: 0, running: active ? 1 : 0, done: 0, failed: 0, cancelled: 0 }, attention: { approval: 0, acceptance: 0 }, generatedAt: checkedAt },
    wakers: agents.map(agent => ({ id: agent.wakerId, name: agent.name, status: 'online', executionLocation: 'local', onlineStatus: 'online', connectionStatus: 'connected', sessionCount: active && agent.id === 'backend' ? 1 : 0, taskCount: active && agent.id === 'backend' ? 1 : 0 })),
    tasks: active ? [{ id: 'task-test', title: '第 5 次运行 — Validasi API Kopi Senja', type: 'direct_session', status: 'running', rawStatus: 'running', assigneeId: characterWakerId('backend'), assigneeName: 'Backend Agent', sourceType: 'conversation', sourceName: 'Backend Agent', updatedAt: checkedAt, lastActiveAt: checkedAt }] : [],
    wakerTasks: [],
    activities: active ? [{ id: 'session-test', wakerId: characterWakerId('backend'), title: 'Menyiapkan kontrak API', status: 'running', startedAt: checkedAt, lastActiveAt: checkedAt, endedAt: null, source: 'console', scenario: 'direct' }] : [],
    credits: null,
    message: null,
  };
}

const disconnected: QoderWakeSnapshot = {
  status: 'disconnected', checkedAt: '2026-11-20T07:00:10.000Z', version: null, daemon: null, board: null,
  wakers: [], tasks: [], wakerTasks: [], activities: [], credits: null, message: 'CLI tidak tersedia untuk pengujian.',
};

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

test('maps all eight characters by stable source IDs with metadata-only status', async ({ page }) => {
  await page.route('**/api/qoderwake/workflow', route => route.fulfill({ json: { request: null, run: null, workers: [], pendingConfirmations: [], gate: 'not_started' } }));
  const snapshot = fixture();
  snapshot.wakers.forEach((waker, index) => { waker.name = `Native label ${index}`; });
  await open(page, () => snapshot);
  for (const agent of agents) {
    const hotspot = page.getByRole('button', { name: `Pilih ${agent.name}`, exact: true });
    await expect(hotspot).toHaveAttribute('data-waker-id', agent.wakerId);
    await expect(hotspot).toHaveAttribute('data-waker-status', agent.id === 'backend' ? 'working' : 'online');
  }
});

test('renders all eight recorded Wakers as online in realtime mode without streaming claims', async ({ page }) => {
  const errors: string[] = [];
  let nativeReads = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.clock.install({ time: new Date(recordedSnapshot.checkedAt) });
  await page.route('**/api/qoderwake/workflow', route => route.fulfill({ json: { request: null, run: null, workers: [], pendingConfirmations: [], gate: 'not_started' } }));
  await page.route('**/api/qoderwake', route => { nativeReads++; return route.fulfill({ json: recordedSnapshot }); });
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-scene-ready', 'true');
  await expect(page.getByRole('button', { name: 'Periksa koneksi' })).toBeEnabled();
  for (const agent of agents) {
    const hotspot = page.getByRole('button', { name: `Pilih ${agent.name}`, exact: true });
    await expect(hotspot).toHaveAttribute('data-waker-id', agent.wakerId);
    await expect(hotspot).toHaveAttribute('data-waker-status', 'online');
  }
  await expect(page.getByTestId('snapshot-status')).toHaveText('Terbaru');
  await expect(page.getByTestId('native-status')).toHaveText('Online');
  await expect(page.getByRole('button', { name: /lanjut simulasi/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /hentikan semua/i })).toHaveCount(0);
  await expect(page.getByTestId('live-activity')).toBeVisible();
  await capture(page, 'recorded-live-roster');
  expect(nativeReads).toBe(1);
  expect(errors).toEqual([]);
});

test('labels fresh snapshots cleanly, preserves original task titles, and runs realtime motion immediately', async ({ page }) => {
  await open(page, () => fixture());
  await page.getByRole('button', { name: 'Pilih Backend Agent', exact: true }).click();
  await expect(page.getByTestId('native-status')).toContainText('Bekerja · running');
  await expect(page.getByRole('complementary').getByText('第 5 次运行 — Validasi API Kopi Senja', { exact: true })).toBeVisible();
  await expect(page.getByTestId('snapshot-status')).toHaveText('Terbaru');
  await expect(page.getByTestId('snapshot-checked')).toHaveAttribute('datetime', checkedAt);
  await expect(page.locator('.mode-banner')).toContainText('Snapshot QoderWake');
  await expect(page.locator('.mode-banner')).not.toContainText('LIVE');
  await expect(page.getByRole('button', { name: /^Pause/ })).toHaveCount(0);
  const backend = page.getByRole('button', { name: 'Pilih Backend Agent', exact: true });
  const before = await backend.getAttribute('style');
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'true');
  await page.clock.runFor(500);
  // Backend is actively working on QoderWake task, so it remains seated at desk while idle colleagues move.
  expect(await backend.getAttribute('style')).toBe(before);
  await capture(page, 'fresh-active');
});

test('keeps local brief processing usable while a late native snapshot is pending', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.clock.install({ time: new Date(checkedAt) });
  await page.route('**/api/qoderwake/workflow', route => route.fulfill({ json: { request: null, run: null, workers: [], pendingConfirmations: [], gate: 'not_started' } }));
  let release: () => void = () => undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let nativeReads = 0;
  await page.route('**/api/qoderwake', async route => {
    nativeReads++;
    await gate;
    await route.fulfill({ json: { ...fixture(false), checkedAt: '2026-11-20T07:02:20.000Z' } });
  });
  const nativeRequest = page.waitForRequest(request => request.url().endsWith('/api/qoderwake'));
  await page.goto('/');
  await nativeRequest;
  await expect(page.locator('canvas')).toHaveAttribute('data-scene-ready', 'true');
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'true');
  await expect(page.getByTestId('live-activity')).toBeVisible();
  const refresh = page.getByRole('button', { name: 'Periksa koneksi' });
  await expect(refresh).toBeDisabled();
  await expect(page.getByTestId('snapshot-status')).toHaveText('Memeriksa QoderWake');
  await expect(page.locator('.new-brief')).toBeEnabled();
  await capture(page, 'native-pending-local-ready');
  await page.locator('.new-brief').click();
  await page.getByRole('button', { name: 'Isi contoh Kopi Senja' }).click();
  await expect(page.getByRole('button', { name: 'Proses uji lokal' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Jalankan WakerFlow V13' })).toBeDisabled();
  await page.getByRole('button', { name: 'Proses uji lokal' }).click();
  await expect(page.locator('.sr-only[role="status"]')).toHaveText('Perubahan tersimpan di aplikasi lokal. Tidak ada eksekusi QoderWake.');
  await expect(refresh).toBeDisabled();
  expect(nativeReads).toBe(1);
  await page.clock.fastForward(140000);
  try { await expect(refresh).toBeDisabled({ timeout: 1000 }); } finally { release(); }
  await expect(refresh).toBeEnabled();
  await expect(page.getByTestId('snapshot-status')).toHaveText('Terbaru');
  await expect(page.getByTestId('snapshot-checked')).toHaveAttribute('datetime', '2026-11-20T07:02:20.000Z');
  expect(errors).toEqual([]);
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
    await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'true');
    await expect(page.getByTestId('live-activity')).toContainText('Koneksi terputus');
    if (failure === 'network') await capture(page, 'disconnected');
    broken = false;
    await page.getByRole('button', { name: 'Periksa koneksi' }).click();
    await expect(page.getByTestId('snapshot-status')).toHaveText('Terbaru');
    await expect(page.getByTestId('native-status')).toContainText('Bekerja · running');
  });
}

test('auto-refreshes snapshot silently in realtime so live view stays fresh without going stale', async ({ page }) => {
  let reads = 0;
  await page.clock.install({ time: new Date(checkedAt) });
  await page.route('**/api/qoderwake/workflow', route => route.fulfill({ json: { request: null, run: null, workers: [], pendingConfirmations: [], gate: 'not_started' } }));
  await page.route('**/api/qoderwake', route => {
    reads++;
    return route.fulfill({
      json: { ...fixture(false), checkedAt: new Date(Date.parse(checkedAt) + (reads - 1) * 60_000).toISOString() },
    });
  });
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-scene-ready', 'true');
  await expect(page.getByTestId('snapshot-status')).toHaveText('Terbaru');
  expect(reads).toBe(1);
  await page.clock.fastForward(65000);
  await expect.poll(() => reads).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('snapshot-status')).toHaveText('Terbaru');
});

test('marks snapshot stale cleanly if network disconnects before expiry threshold', async ({ page, context }) => {
  await open(page, () => fixture(false));
  await context.setOffline(true);
  await expect(page.getByTestId('snapshot-status')).toHaveText('Koneksi terputus');
  await expect(page.getByTestId('snapshot-success')).toHaveAttribute('datetime', checkedAt);
  await context.setOffline(false);
});

test('recalls roaming figure smoothly when assigned a QoderWake task while office stays alive', async ({ page }) => {
  let snapshot = fixture(false);
  const methods: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/qoderwake')) methods.push(request.method()); });
  await open(page, () => snapshot);
  const pmHotspot = page.getByRole('button', { name: 'Pilih Project Manager / Orchestrator', exact: true });
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'true');
  const seatStyle = await pmHotspot.getAttribute('style');
  await page.clock.runFor(2500);
  expect(await pmHotspot.getAttribute('style')).not.toBe(seatStyle);
  // Assign a live task to every Waker -> motion recalls PM cleanly and eventually settles once seated.
  snapshot = fixture();
  snapshot.wakers.forEach((w, idx) => { w.taskCount = 1; snapshot.tasks.push({ id: `task-${idx}`, title: `Task ${idx}`, type: 'direct_session', status: 'running', rawStatus: 'running', assigneeId: w.id, assigneeName: w.name, sourceType: 'conversation', sourceName: w.name, updatedAt: checkedAt, lastActiveAt: checkedAt }); });
  await page.getByRole('button', { name: 'Periksa koneksi' }).click();
  await expect(page.getByTestId('native-status')).toContainText('Bekerja · running');
  for (let i = 0; i < 30 && (await page.locator('canvas').getAttribute('data-motion-running')) === 'true'; i++) {
    await page.clock.runFor(1000);
  }
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'false');
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
  await expect(page.getByTestId('native-status')).toContainText('Bekerja · running');
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
  { id: 'backend', action: 'Ngobrol santai di ruang rapat', name: 'idle-chat' },
]) {
  test(`reaches ${name} automatically in realtime with selectable figures`, async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    const methods: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('/api/')) methods.push(request.method()); });
    const snapshot = fixture(false);
    const companions = id === 'delivery'
      ? [characterWakerId('design'), characterWakerId('frontend')]
      : [characterWakerId('qa'), characterWakerId('delivery'), characterWakerId('billing')];
    const eligible = new Set<string>([characterWakerId(id), ...companions]);
    snapshot.wakers.forEach(waker => {
      if (!eligible.has(waker.id)) {
        waker.status = 'offline';
        waker.onlineStatus = 'offline';
        waker.connectionStatus = 'disconnected';
      }
    });
    await open(page, () => snapshot);
    const agent = agents.find(item => item.id === id)!;
    const hotspot = page.getByRole('button', { name: `Pilih ${agent.name}`, exact: true });
    await hotspot.click();
    const hint = page.getByTestId('live-activity');
    for (let second = 0; second < 35 && !(await hint.textContent())?.includes(action); second++) await page.clock.runFor(1000);
    await expect(hint).toContainText(action);
    await expect(page.getByTestId('native-status')).toHaveText('Online');
    await capture(page, name);
    await hotspot.click();
    await expect(page.getByRole('complementary', { name: 'Detail agent' }).getByRole('heading', { name: agent.name, exact: true })).toBeVisible();
    expect(methods.length).toBeGreaterThan(0);
    expect(methods.every(method => method === 'GET')).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('honors reduced motion automatically on toggle without requiring simulation buttons', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, () => fixture(false));
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'false');
  await expect(page.getByTestId('live-activity')).toHaveText('Preferensi kurangi gerak aktif.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('canvas')).toHaveAttribute('data-motion-running', 'false');
});
