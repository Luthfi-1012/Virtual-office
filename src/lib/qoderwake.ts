import { z } from 'zod';

export type QoderWakeWaker = {
  id: string;
  name: string;
  status: string;
  executionLocation: string;
  onlineStatus: string | null;
  connectionStatus: string | null;
  sessionCount: number;
  taskCount: number;
};

export type QoderWakeTask = {
  id: string;
  title: string;
  type: string;
  status: string;
  rawStatus: string;
  assigneeId: string | null;
  assigneeName: string | null;
  sourceType: string;
  sourceName: string;
  updatedAt: string;
  lastActiveAt: string;
};

export type QoderWakeActivity = {
  id: string;
  wakerId: string;
  title: string;
  status: string;
  startedAt: string;
  lastActiveAt: string;
  endedAt: string | null;
  source: string | null;
  scenario: string | null;
};

export type QoderWakeSnapshot = {
  status: 'live' | 'disconnected';
  checkedAt: string;
  version: string | null;
  daemon: {
    deviceStatus: string;
    sessionsTotal: number;
    sessionsRunning: number;
    agentCount: number;
  } | null;
  board: {
    total: number;
    byStatus: {
      waiting: number;
      pending: number;
      running: number;
      done: number;
      failed: number;
      cancelled: number;
    };
    attention: { approval: number; acceptance: number };
    generatedAt: string;
  } | null;
  wakers: QoderWakeWaker[];
  tasks: QoderWakeTask[];
  activities: QoderWakeActivity[];
  message: string | null;
};

const timestamp = z.string().refine(value => Number.isFinite(Date.parse(value)));
const count = z.number().int().nonnegative();
const snapshotSchema = z.object({
  status: z.enum(['live', 'disconnected']), checkedAt: timestamp, version: z.string().nullable(),
  daemon: z.object({ deviceStatus: z.string(), sessionsTotal: count, sessionsRunning: count, agentCount: count }).nullable(),
  board: z.object({
    total: count, byStatus: z.object({ waiting: count, pending: count, running: count, done: count, failed: count, cancelled: count }),
    attention: z.object({ approval: count, acceptance: count }), generatedAt: timestamp,
  }).nullable(),
  wakers: z.array(z.object({
    id: z.string(), name: z.string(), status: z.string(), executionLocation: z.string(),
    onlineStatus: z.string().nullable(), connectionStatus: z.string().nullable(), sessionCount: count, taskCount: count,
  })),
  tasks: z.array(z.object({
    id: z.string(), title: z.string(), type: z.string(), status: z.string(), rawStatus: z.string(),
    assigneeId: z.string().nullable(), assigneeName: z.string().nullable(), sourceType: z.string(), sourceName: z.string(),
    updatedAt: timestamp, lastActiveAt: timestamp,
  })),
  activities: z.array(z.object({
    id: z.string(), wakerId: z.string(), title: z.string(), status: z.string(), startedAt: timestamp,
    lastActiveAt: timestamp, endedAt: timestamp.nullable(), source: z.string().nullable(), scenario: z.string().nullable(),
  })),
  message: z.string().nullable(),
}).refine(value => value.status === 'disconnected' || (value.version !== null && value.daemon !== null && value.board !== null));

export function isQoderWakeSnapshot(value: unknown): value is QoderWakeSnapshot {
  return snapshotSchema.safeParse(value).success;
}

export const SNAPSHOT_MAX_AGE_MS = 60_000;
export type SnapshotFreshness = 'fresh' | 'stale' | 'disconnected';
export type WakerWorkState = 'idle' | 'active' | 'unknown';
export const activeTaskStatuses = new Set(['running', 'pending', 'waiting']);
const terminalTaskStatuses = new Set(['done', 'failed', 'cancelled']);

export function snapshotFreshness(snapshot: QoderWakeSnapshot, now: number): SnapshotFreshness {
  if (snapshot.status !== 'live') return 'disconnected';
  const age = now - Date.parse(snapshot.checkedAt);
  return Number.isFinite(age) && age >= 0 && age < SNAPSHOT_MAX_AGE_MS ? 'fresh' : 'stale';
}

export type WakerDisplayStatus = {
  kind: 'working' | 'waiting' | 'done' | 'online' | 'unknown';
  label: string;
};

export function wakerDisplayStatus(snapshot: QoderWakeSnapshot, wakerId: string, now: number): WakerDisplayStatus {
  const freshness = snapshotFreshness(snapshot, now);
  if (freshness === 'disconnected') return { kind: 'unknown', label: 'Koneksi terputus · status tidak diketahui' };
  if (freshness === 'stale') return { kind: 'unknown', label: 'Kedaluwarsa · status tidak diketahui' };
  const waker = matchWakerById(snapshot.wakers, wakerId);
  if (!waker) return { kind: 'unknown', label: 'Waker tidak ditemukan' };
  const tasks = snapshot.tasks.filter(task => task.assigneeId === waker.id)
    .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt));
  const current = tasks.find(task => activeTaskStatuses.has(task.status));
  if (current?.status === 'running') return { kind: 'working', label: 'Bekerja · running' };
  if (current) {
    const approval = current.status === 'waiting' && `${current.rawStatus} ${current.type}`.toLowerCase().includes('approval');
    return { kind: 'waiting', label: approval ? 'Menunggu approval' : `Menunggu · ${current.status}` };
  }
  if (snapshot.activities.some(activity => activity.wakerId === waker.id && activity.status === 'running')) {
    return { kind: 'working', label: 'Bekerja · sesi running' };
  }
  const latestTerminal = tasks.find(task => terminalTaskStatuses.has(task.status));
  if (latestTerminal?.status === 'done') return { kind: 'done', label: 'Task selesai · done' };
  if (waker.status === 'online' && waker.onlineStatus === 'online' && waker.connectionStatus === 'connected') {
    return { kind: 'online', label: 'Online' };
  }
  return { kind: 'unknown', label: 'Status tidak diketahui' };
}

export function wakerWorkState(snapshot: QoderWakeSnapshot, wakerId: string, now: number): WakerWorkState {
  if (snapshotFreshness(snapshot, now) !== 'fresh') return 'unknown';
  const waker = matchWakerById(snapshot.wakers, wakerId);
  if (!waker) return 'unknown';
  const tasks = snapshot.tasks.filter(task => task.assigneeId === waker.id);
  if (tasks.some(task => activeTaskStatuses.has(task.status))) return 'active';
  const sessions = snapshot.activities.filter(activity => activity.wakerId === waker.id);
  if (waker.status !== 'online' || waker.onlineStatus !== 'online' || waker.connectionStatus !== 'connected'
    || waker.taskCount !== 0 || snapshot.board?.total !== snapshot.tasks.length
    || snapshot.tasks.some(task => !terminalTaskStatuses.has(task.status) && !activeTaskStatuses.has(task.status))
    || sessions.length !== waker.sessionCount || sessions.some(session => !session.endedAt || session.status === 'running')) return 'unknown';
  return 'idle';
}

export function matchWakerById<T extends { id: string }>(wakers: readonly T[], wakerId: string): T | undefined {
  const matches = wakers.filter(waker => waker.id === wakerId);
  return matches.length === 1 ? matches[0] : undefined;
}
