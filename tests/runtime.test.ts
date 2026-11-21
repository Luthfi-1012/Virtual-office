import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { QoderWakeSnapshot } from '../src/lib/qoderwake';

const origin = 'http://127.0.0.1:3101';
const runtimeKeys = ['officeApi', 'officeStore', 'officeWorkflow', 'officeSessions'];
const nativeSnapshot: QoderWakeSnapshot = {
  status: 'live', checkedAt: '2026-11-20T07:00:00.000Z', version: '1.2.22',
  daemon: { deviceStatus: 'online', sessionsTotal: 0, sessionsRunning: 0, agentCount: 0 },
  board: {
    total: 0,
    byStatus: { waiting: 0, pending: 0, running: 0, done: 0, failed: 0, cancelled: 0 },
    attention: { approval: 0, acceptance: 0 }, generatedAt: '2026-11-20T07:00:00.000Z',
  },
  wakers: [], tasks: [], activities: [], message: null,
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('OFFICE_DB_PATH', '.local/runtime-test.sqlite');
  vi.doMock('server-only', () => ({}));
  vi.doMock('better-sqlite3', () => ({ default: class { pragma() {} } }));
  vi.doMock('../src/server/store', () => ({ OfficeStore: class {} }));
  vi.doMock('../src/server/workflow', () => ({ createWorkflowService: () => ({}) }));
  vi.doMock('../src/server/qoderwake', () => ({ readQoderWakeSnapshot: async () => nativeSnapshot }));
  const runtime = globalThis as typeof globalThis & { officeApi?: (request: Request) => Promise<Response> };
  runtime.officeApi = async request => {
    if (new URL(request.url).pathname === '/api/session') {
      const token = 'a'.repeat(64);
      return Response.json({ csrf: token }, { headers: { 'Set-Cookie': `office_session=${token}; Path=/api; HttpOnly; SameSite=Strict` } });
    }
    return Response.json({ error: 'Tidak ditemukan.' }, { status: 404 });
  };
});

afterEach(() => {
  for (const key of runtimeKeys) Reflect.deleteProperty(globalThis, key);
  vi.unstubAllEnvs();
  vi.resetModules();
});

it('replaces a stale global handler during development without dropping the local session', async () => {
  const { handleRequest } = await import('../src/server/runtime');
  const session = await handleRequest(new Request(`${origin}/api/session`, {
    headers: { host: '127.0.0.1:3101', 'x-office-client': 'local', 'sec-fetch-site': 'same-origin' },
  }));
  expect(session.status).toBe(200);
  const { csrf } = await session.json();
  const cookie = session.headers.get('set-cookie')?.split(';')[0];
  expect(cookie).toBeTruthy();

  const response = await handleRequest(new Request(`${origin}/api/qoderwake`, {
    headers: { host: '127.0.0.1:3101', origin, cookie: cookie!, 'x-office-csrf': csrf },
  }));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(nativeSnapshot);
});
