import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { OfficeStore } from '../src/server/store';
import { createOfficeApi } from '../src/server/http';
import { kopiSenja } from '../src/lib/fixture';

let db: Database.Database;
let api: ReturnType<typeof createOfficeApi>;
let headers: Record<string, string>;
let nativeCalls = 0;
const nativeSnapshot = { status: 'disconnected' as const, checkedAt: '2026-11-20T07:00:00.000Z', version: null, daemon: null, board: null, wakers: [], tasks: [], activities: [], message: null };
const origin = 'http://127.0.0.1:3000';
beforeEach(async () => {
  nativeCalls = 0;
  db = new Database(':memory:'); api = createOfficeApi(new OfficeStore(db), async () => { nativeCalls++; return nativeSnapshot; });
  const session = await api(new Request(`${origin}/api/session`, { headers: { host: '127.0.0.1:3000', 'x-office-client': 'local', 'sec-fetch-site': 'same-origin' } }));
  const { csrf } = await session.json();
  headers = { host: '127.0.0.1:3000', origin, 'content-type': 'application/json', 'x-office-csrf': csrf, cookie: session.headers.get('set-cookie')!.split(';')[0] };
});
afterEach(() => db.close());
const post = (body: unknown, extra = {}) => api(new Request(`${origin}/api/office`, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) }));

it('creates an authorized local job and returns the same result when reconciled', async () => {
  const result = await post({ action: 'submit', key: 'request-0001', brief: kopiSenja });
  expect(result.status).toBe(200);
  const operation = await api(new Request(`${origin}/api/office?operation=request-0001`, { headers }));
  expect(await operation.json()).toEqual({ result: await result.json() });
});
it.each([{ origin: 'http://attacker.invalid' }, { host: 'attacker.invalid' }, { 'x-office-csrf': 'bad' }, { cookie: '' }, { 'sec-fetch-site': 'cross-site' }])('rejects forged request %j', async extra => {
  expect((await post({ action: 'submit', key: 'request-0001', brief: kopiSenja }, extra)).status).toBe(403);
  expect(new OfficeStore(db).snapshot().jobs).toHaveLength(0);
});
it('does not bootstrap a session through cross-origin or ordinary resource GET', async () => {
  const cases: Record<string, string>[] = [{}, { 'x-office-client': 'local', origin: 'http://attacker.invalid' }];
  for (const extra of cases) {
    expect((await api(new Request(`${origin}/api/session`, { headers: { host: '127.0.0.1:3000', ...extra } }))).status).toBe(403);
  }
});
it('rejects oversized bodies, invalid JSON and unsupported native controls', async () => {
  expect((await post({ value: 'x'.repeat(20000) })).status).toBe(413);
  expect((await api(new Request(`${origin}/api/office`, { method: 'POST', headers, body: '{invalid' }))).status).toBe(400);
  expect((await post({ action: 'pause', jobId: 'j' })).status).toBe(400);
});
it('serves the native read-only snapshot only through an authorized local request', async () => {
  const response = await api(new Request(`${origin}/api/qoderwake`, { headers }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(nativeSnapshot);
  expect(nativeCalls).toBe(1);
  const forged = await api(new Request(`${origin}/api/qoderwake`, { headers: { ...headers, 'x-office-csrf': 'bad' } }));
  expect(forged.status).toBe(403);
  expect(nativeCalls).toBe(1);
});
it('reports validation fields and storage errors without leaking database details', async () => {
  const invalid = await post({ action: 'submit', key: 'request-0001', brief: { ...kopiSenja, audience: '' } });
  expect(invalid.status).toBe(422);
  expect((await invalid.json()).fields['brief.audience']).toBeTruthy();
  db.pragma('query_only = ON');
  const failed = await post({ action: 'submit', key: 'request-0001', brief: kopiSenja });
  expect(failed.status).toBe(503);
  expect(JSON.stringify(await failed.json())).not.toMatch(/sqlite|readonly|SELECT|INSERT/i);
});
