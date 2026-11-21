import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { createQoderWakeReader, type QoderWakeCommand } from '../src/server/qoderwake';
import { isQoderWakeSnapshot, matchWakerById, snapshotFreshness, wakerDisplayStatus, wakerWorkState } from '../src/lib/qoderwake';
import { agents } from '../src/lib/agents';

const waker = {
  agentId: 'agent-pm', name: 'Project Manager / Orchestrator', status: 'online', executionLocation: 'local',
  machine: { machine_id: 'private-machine', online_status: 'online', connection_status: 'connected' },
  sessionCount: 2, taskCount: 1, workspace: 'C:\\private\\workspace', description: 'private role',
};
const status = {
  running: true, reachable: true,
  status: { success: true, data: {
    version: '1.2.22', timestamp: '2026-11-20T07:00:00.000Z',
    device: { deviceId: 'private-device', userId: 'private-user', status: 'online' },
    sessions: { total: 36, running: 0 }, agents: 8,
  } },
};
const task = {
  id: 'task-1', title: 'Run kelima', type: 'wakerflow_task', status: 'done', rawStatus: 'succeeded',
  assignee: { id: 'flow-1', name: 'Website Delivery' }, agent: null,
  source: { type: 'manual', name: 'Website Delivery' }, sessionId: null,
  createdAt: '2026-11-19T00:00:00.000Z', updatedAt: '2026-11-19T01:00:00.000Z', lastActiveAt: '2026-11-19T01:00:00.000Z',
  links: { primaryUrl: 'http://private.invalid/task' },
};
const summary = {
  total: 1, byStatus: { waiting: 0, pending: 0, running: 0, done: 1, failed: 0, cancelled: 0 },
  attentionCounts: { approval: 0, acceptance: 0 }, generatedAt: '2026-11-20T07:00:00.000Z', errors: [],
};
const sessions = [
  { sessionId: 'session-old', agentId: 'agent-pm', title: 'Tahap lama', status: 'stopped', startedAt: '2026-11-18T00:00:00.000Z', lastActiveAt: '2026-11-18T01:00:00.000Z', endedAt: '2026-11-18T01:00:00.000Z', sessionSource: 'workflow', scenario: 'worker', cwd: 'C:\\private\\workspace' },
  { sessionId: 'session-new', agentId: 'agent-pm', title: 'Tahap terbaru', status: 'stopped', startedAt: '2026-11-19T00:00:00.000Z', lastActiveAt: '2026-11-19T01:00:00.000Z', endedAt: '2026-11-19T01:00:00.000Z', sessionSource: 'workflow', scenario: 'worker', nativeTranscript: { configRoot: 'private-config' } },
];

function fixtureCommand(calls: readonly string[][]): QoderWakeCommand {
  return async args => {
    (calls as string[][]).push([...args]);
    if (args[0] === 'status') return status;
    if (args[0] === 'waker') return [waker];
    if (args[0] === 'board' && args[1] === 'tasks') return { items: [task], total: 1, generatedAt: summary.generatedAt, errors: [] };
    if (args[0] === 'board' && args[1] === 'summary') return summary;
    if (args[0] === 'session' && args[3] === 'agent-pm') return sessions;
    throw new Error(`Unexpected command: ${args.join(' ')}`);
  };
}

it('reads only verified CLI commands and returns a sanitized live snapshot', async () => {
  const calls: string[][] = [];
  const snapshot = await createQoderWakeReader(fixtureCommand(calls))();

  expect(calls).toEqual(expect.arrayContaining([
    ['status', '--json'],
    ['waker', 'list', '--json'],
    ['board', 'tasks', '--limit', '50', '--json'],
    ['board', 'summary', '--json'],
    ['session', 'list', '--waker-id', 'agent-pm', '--json'],
  ]));
  expect(calls).toHaveLength(5);
  for (const forbidden of ['run', 'create', 'send', 'confirm', 'stop', 'start', 'login', 'whoami']) expect(calls.flat()).not.toContain(forbidden);
  expect(snapshot.status).toBe('live');
  expect(snapshot.version).toBe('1.2.22');
  expect(snapshot.daemon).toEqual({ deviceStatus: 'online', sessionsTotal: 36, sessionsRunning: 0, agentCount: 8 });
  expect(snapshot.wakers[0]).toEqual({ id: 'agent-pm', name: waker.name, status: 'online', executionLocation: 'local', onlineStatus: 'online', connectionStatus: 'connected', sessionCount: 2, taskCount: 1 });
  expect(snapshot.tasks[0].title).toBe('Run kelima');
  expect(snapshot.activities.map(item => item.id)).toEqual(['session-new', 'session-old']);
  expect(snapshot.board?.byStatus.done).toBe(1);
  const serialized = JSON.stringify(snapshot);
  for (const privateValue of ['private-user', 'private-device', 'private-machine', 'private\\workspace', 'private role', 'private.invalid', 'private-config']) expect(serialized).not.toContain(privateValue);
});

it('serializes CLI reads so concurrent commands cannot exhaust the timeout window', async () => {
  let active = 0;
  let maximumActive = 0;
  const respond = fixtureCommand([]);
  const snapshot = await createQoderWakeReader(async args => {
    active++;
    maximumActive = Math.max(maximumActive, active);
    await Promise.resolve();
    try { return await respond(args); } finally { active--; }
  })();

  expect(snapshot.status).toBe('live');
  expect(maximumActive).toBe(1);
});

it('accepts healthy metadata commands that complete just beyond ten seconds', async () => {
  vi.useFakeTimers();
  vi.resetModules();
  const respond = fixtureCommand([]);
  const delayedExecFile = vi.fn((_: string, args: string[], options: { timeout: number }, callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      callback(Object.assign(new Error('timeout'), { killed: true, code: 'ETIMEDOUT' }));
    }, options.timeout);
    setTimeout(() => {
      void respond(args).then(value => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback(null, { stdout: JSON.stringify(value), stderr: '' });
      });
    }, 10500);
  });
  try {
    vi.doMock('node:child_process', () => ({ execFile: delayedExecFile }));
    const { readQoderWakeSnapshot } = await import('../src/server/qoderwake');
    const pending = readQoderWakeSnapshot();
    await vi.runAllTimersAsync();
    const snapshot = await pending;
    expect(snapshot.status).toBe('live');
    expect(snapshot.wakers).toHaveLength(1);
    expect(snapshot.activities).toHaveLength(2);
  } finally {
    vi.useRealTimers();
    vi.doUnmock('node:child_process');
    vi.resetModules();
  }
});

it('fails disconnected without exposing CLI errors or inventing records', async () => {
  const snapshot = await createQoderWakeReader(async () => { throw new Error('private credential in stderr'); })();
  expect(snapshot.status).toBe('disconnected');
  expect(snapshot.wakers).toEqual([]);
  expect(snapshot.tasks).toEqual([]);
  expect(snapshot.activities).toEqual([]);
  expect(snapshot.daemon).toBeNull();
  expect(JSON.stringify(snapshot)).not.toContain('private credential');
});

it('fails disconnected when the observed response does not match its schema', async () => {
  const snapshot = await createQoderWakeReader(async () => ({ running: true }))();
  expect(snapshot.status).toBe('disconnected');
  expect(snapshot.version).toBeNull();
});

it('expires successful checks at 60 seconds and never treats invalid or future checks as current', async () => {
  const snapshot = await createQoderWakeReader(fixtureCommand([]))();
  snapshot.checkedAt = '2026-11-20T07:00:00.000Z';
  const now = Date.parse(snapshot.checkedAt);
  expect(snapshotFreshness(snapshot, now + 59999)).toBe('fresh');
  expect(snapshotFreshness(snapshot, now + 60000)).toBe('stale');
  expect(snapshotFreshness({ ...snapshot, checkedAt: 'invalid' }, now)).toBe('stale');
  expect(snapshotFreshness(snapshot, now - 1)).toBe('stale');
  expect(snapshotFreshness({ ...snapshot, status: 'disconnected' }, now)).toBe('disconnected');
});

it('permits idle only with a fresh, complete snapshot and no task or open session evidence', async () => {
  const snapshot = await createQoderWakeReader(fixtureCommand([]))();
  snapshot.wakers[0].taskCount = 0;
  const now = Date.parse(snapshot.checkedAt);
  expect(wakerWorkState(snapshot, waker.agentId, now)).toBe('idle');
  expect(wakerWorkState(snapshot, waker.agentId, now + 60000)).toBe('unknown');
  expect(wakerWorkState({ ...snapshot, status: 'disconnected' }, waker.name, now)).toBe('unknown');
  expect(wakerWorkState({ ...snapshot, board: { ...snapshot.board!, total: 51 } }, waker.name, now)).toBe('unknown');
  expect(wakerWorkState({ ...snapshot, wakers: [...snapshot.wakers, snapshot.wakers[0]] }, waker.name, now)).toBe('unknown');
  snapshot.wakers[0].taskCount = 1;
  expect(wakerWorkState(snapshot, waker.agentId, now)).toBe('unknown');
  snapshot.tasks[0].assigneeId = 'agent-pm';
  for (const status of ['running', 'pending', 'waiting']) {
    snapshot.tasks[0].status = status;
    expect(wakerWorkState(snapshot, waker.agentId, now)).toBe('active');
  }
  snapshot.tasks[0].status = 'unrecognized';
  expect(wakerWorkState(snapshot, waker.agentId, now)).toBe('unknown');
  snapshot.tasks[0].status = 'done';
  snapshot.wakers[0].taskCount = 0;
  snapshot.activities[0].status = 'running';
  snapshot.activities[0].endedAt = null;
  expect(wakerWorkState(snapshot, waker.agentId, now)).toBe('unknown');
});

it('matches only one exact stable Waker ID', () => {
  const matched = { id: 'agent-pm', name: 'Native label can change' };
  expect(matchWakerById([matched], 'agent-pm')?.id).toBe('agent-pm');
  expect(matchWakerById([matched, { ...matched }], 'agent-pm')).toBeUndefined();
  expect(matchWakerById([matched], 'Project Manager / Orchestrator')).toBeUndefined();
  expect(matchWakerById([matched], 'agent-PM')).toBeUndefined();
});

it('maps the recorded roster to eight distinct characters by stable ID with recorded online status', () => {
  const raw: unknown = JSON.parse(readFileSync(new URL('./qoderwake-roster-2026-11-21.fixture.json', import.meta.url), 'utf8'));
  expect(isQoderWakeSnapshot(raw)).toBe(true);
  if (!isQoderWakeSnapshot(raw)) return;
  const expected = {
    pm: '3a5aab752ea6', design: '9c7e977addfc', backend: '796518462c46', frontend: '39eca6bba86b',
    qa: '96e3fc908c82', intake: 'ebf4958b42e0', delivery: '7e1da47da422', billing: '05171418f34a',
  } as const;
  const now = Date.parse(raw.checkedAt);
  expect(raw.wakers).toHaveLength(8);
  const matched = agents.map(agent => {
    const waker = matchWakerById(raw.wakers, agent.wakerId);
    expect(waker?.id).toBe(expected[agent.id]);
    expect(waker?.name).toBe(agent.name);
    expect(wakerDisplayStatus(raw, agent.wakerId, now)).toEqual({ kind: 'online', label: 'Online' });
    return waker?.id;
  });
  expect(new Set(matched).size).toBe(8);
});

it('shows working status by stable ID even when the native display name differs', async () => {
  const snapshot = await createQoderWakeReader(fixtureCommand([]))();
  snapshot.wakers[0].name = 'Native label changed';
  snapshot.tasks[0].assigneeId = 'agent-pm';
  snapshot.tasks[0].status = 'running';
  const now = Date.parse(snapshot.checkedAt);
  expect(wakerDisplayStatus(snapshot, 'agent-pm', now)).toEqual({ kind: 'working', label: 'Bekerja · running' });
  expect(wakerWorkState(snapshot, 'agent-pm', now)).toBe('active');
});

it('shows only approval, waiting, completion, session, and online states supported by metadata', async () => {
  const snapshot = await createQoderWakeReader(fixtureCommand([]))();
  const now = Date.parse(snapshot.checkedAt);
  snapshot.tasks = [{ ...snapshot.tasks[0], assigneeId: 'agent-pm' }];
  const stoppedActivity = snapshot.activities[0];
  snapshot.activities = [];
  snapshot.wakers[0].sessionCount = 0;
  for (const [status, rawStatus, expected] of [
    ['waiting', 'waiting_for_approval', { kind: 'waiting', label: 'Menunggu approval' }],
    ['waiting', 'waiting', { kind: 'waiting', label: 'Menunggu · waiting' }],
    ['pending', 'pending', { kind: 'waiting', label: 'Menunggu · pending' }],
    ['done', 'succeeded', { kind: 'done', label: 'Task selesai · done' }],
  ] as const) {
    snapshot.tasks[0].status = status;
    snapshot.tasks[0].rawStatus = rawStatus;
    expect(wakerDisplayStatus(snapshot, 'agent-pm', now)).toEqual(expected);
  }
  snapshot.tasks = [];
  snapshot.wakers[0].taskCount = 0;
  snapshot.activities = [{ ...stoppedActivity, status: 'running', endedAt: null }];
  expect(wakerDisplayStatus(snapshot, 'agent-pm', now)).toEqual({ kind: 'working', label: 'Bekerja · sesi running' });
  snapshot.activities[0].status = 'stopped';
  snapshot.activities[0].endedAt = snapshot.checkedAt;
  expect(wakerDisplayStatus(snapshot, 'agent-pm', now)).toEqual({ kind: 'online', label: 'Online' });
});

it('returns unknown for an unmatched, stale, or disconnected native status', async () => {
  const snapshot = await createQoderWakeReader(fixtureCommand([]))();
  const now = Date.parse(snapshot.checkedAt);
  expect(wakerDisplayStatus(snapshot, waker.name, now)).toEqual({ kind: 'unknown', label: 'Waker tidak ditemukan' });
  expect(wakerDisplayStatus(snapshot, 'agent-pm', now + 60_000)).toEqual({ kind: 'unknown', label: 'Kedaluwarsa · status tidak diketahui' });
  expect(wakerDisplayStatus({ ...snapshot, status: 'disconnected' }, 'agent-pm', now)).toEqual({ kind: 'unknown', label: 'Koneksi terputus · status tidak diketahui' });
});
