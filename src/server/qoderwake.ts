import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { QoderWakeActivity, QoderWakeCredits, QoderWakeSnapshot, QoderWakeTask } from '../lib/qoderwake';

const execFileAsync = promisify(execFile);
const text = (maximum = 200) => z.string().min(1).max(maximum);
const timestamp = text(100).refine(value => Number.isFinite(Date.parse(value)), 'Timestamp tidak valid.');
const count = z.number().int().nonnegative();
const nullableText = z.string().max(500).nullable().optional();

const statusSchema = z.object({
  running: z.boolean(), reachable: z.boolean(),
  status: z.object({ success: z.boolean(), data: z.object({
    version: text(50), timestamp,
    device: z.object({ status: text(50) }),
    sessions: z.object({ total: count, running: count }), agents: count,
  }) }),
});
const wakerSchema = z.object({
  agentId: text(200), name: text(200), status: text(50), executionLocation: text(50),
  machine: z.object({ online_status: nullableText, connection_status: nullableText }).nullable().optional(),
  sessionCount: count, taskCount: count,
});
const childTaskSchema = z.object({
  id: text(2048), title: text(500), type: text(100), status: text(50), rawStatus: text(100),
  assignee: z.object({ id: text(500), name: text(200) }).nullable().optional(),
  updatedAt: timestamp, lastActiveAt: timestamp,
});
const taskSchema = z.object({
  id: text(2048), sourceTaskId: z.string().max(200).nullable().optional(),
  title: text(500), type: text(100), status: text(50), rawStatus: text(100),
  assignee: z.object({ id: text(500), name: text(200) }).nullable().optional(),
  source: z.object({ type: text(100), name: text(300) }),
  updatedAt: timestamp, lastActiveAt: timestamp,
  children: z.array(childTaskSchema).max(200).optional(),
});
const boardTasksSchema = z.object({
  items: z.array(taskSchema).max(50), total: count, generatedAt: timestamp, errors: z.array(z.unknown()),
});
const boardSummarySchema = z.object({
  total: count,
  byStatus: z.object({ waiting: count, pending: count, running: count, done: count, failed: count, cancelled: count }),
  attentionCounts: z.object({ approval: count, acceptance: count }),
  generatedAt: timestamp, errors: z.array(z.unknown()),
});
const sessionSchema = z.object({
  sessionId: text(200), agentId: text(200), title: text(500), status: text(100),
  startedAt: timestamp, lastActiveAt: timestamp, endedAt: timestamp.nullable().optional(),
  sessionSource: nullableText, scenario: nullableText,
});
const accountUsageSchema = z.object({
  qoderUsage: z.object({
    userQuota: z.object({
      total: count,
      used: count,
      remaining: count,
      percentage: z.number().min(0).max(1),
      unit: text(30),
    }),
  }),
});

export type QoderWakeCommand = (args: readonly string[]) => Promise<unknown>;
type Reader = () => Promise<QoderWakeSnapshot>;

async function execute(args: readonly string[]): Promise<unknown> {
  const executable = process.env.QODERWAKE_CLI_PATH?.trim() || 'qoderwake';
  const { stdout } = await execFileAsync(executable, [...args], {
    shell: false, windowsHide: true, timeout: 30000, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8',
  });
  return JSON.parse(stdout) as unknown;
}

function disconnected(): QoderWakeSnapshot {
  return {
    status: 'disconnected', checkedAt: new Date().toISOString(), version: null, daemon: null, board: null,
    wakers: [], tasks: [], wakerTasks: [], activities: [], credits: null,
    message: 'Status QoderWake tidak dapat dibaca. Tidak ada tindakan native yang dilakukan.',
  };
}

function sanitizeCredits(raw: unknown): QoderWakeCredits | null {
  const parsed = accountUsageSchema.safeParse(raw);
  if (!parsed.success) return null;
  const quota = parsed.data.qoderUsage.userQuota;
  return { total: quota.total, used: quota.used, remaining: quota.remaining, percentage: quota.percentage, unit: quota.unit };
}

export function createQoderWakeReader(command: QoderWakeCommand = execute, cacheMs = command === execute ? 5000 : 0): Reader {
  let inFlight: Promise<QoderWakeSnapshot> | null = null;
  let cached: { value: QoderWakeSnapshot; expiresAt: number } | null = null;

  const readOnce = async (): Promise<QoderWakeSnapshot> => {
    try {
      // Run independent read-only CLI queries concurrently so snapshots finish in ~14s instead of 70-130s.
      const [statusRaw, wakersRaw, tasksRaw, summaryRaw, sessionsRaw, usageRaw] = await Promise.all([
        command(['status', '--json']),
        command(['waker', 'list', '--json']),
        command(['board', 'tasks', '--limit', '50', '--json']),
        command(['board', 'summary', '--json']),
        command(['session', 'list', '--json']),
        command(['account', 'usage', '--json']).catch(() => null),
      ]);
      const status = statusSchema.parse(statusRaw);
      const wakers = z.array(wakerSchema).max(200).parse(wakersRaw);
      const boardTasks = boardTasksSchema.parse(tasksRaw);
      const summary = boardSummarySchema.parse(summaryRaw);
      const sessions = z.array(sessionSchema).max(2000).parse(sessionsRaw);
      if (!status.running || !status.reachable || !status.status.success || boardTasks.errors.length || summary.errors.length) {
        throw new Error('QoderWake unavailable');
      }
      const knownWakerIds = new Set(wakers.map(waker => waker.agentId));
      const activities: QoderWakeActivity[] = sessions
        .filter(session => knownWakerIds.has(session.agentId))
        .map(session => ({
          id: session.sessionId, wakerId: session.agentId, title: session.title, status: session.status,
          startedAt: session.startedAt, lastActiveAt: session.lastActiveAt, endedAt: session.endedAt ?? null,
          source: session.sessionSource ?? null, scenario: session.scenario ?? null,
        }))
        .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt));

      const wakerTasks: QoderWakeTask[] = [];
      for (const parent of boardTasks.items) {
        for (const child of parent.children ?? []) {
          if (!child.assignee?.id || !knownWakerIds.has(child.assignee.id)) continue;
          wakerTasks.push({
            id: child.id, title: child.title, type: child.type, status: child.status, rawStatus: child.rawStatus,
            assigneeId: child.assignee.id, assigneeName: child.assignee.name,
            sourceType: parent.source.type, sourceName: `${parent.source.name} · ${parent.title}`,
            updatedAt: child.updatedAt, lastActiveAt: child.lastActiveAt,
          });
        }
      }
      wakerTasks.sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt));

      return {
        status: 'live', checkedAt: new Date().toISOString(), version: status.status.data.version,
        daemon: {
          deviceStatus: status.status.data.device.status,
          sessionsTotal: status.status.data.sessions.total,
          sessionsRunning: status.status.data.sessions.running,
          agentCount: status.status.data.agents,
        },
        board: {
          total: summary.total, byStatus: summary.byStatus,
          attention: summary.attentionCounts, generatedAt: summary.generatedAt,
        },
        wakers: wakers.map(waker => ({
          id: waker.agentId, name: waker.name, status: waker.status, executionLocation: waker.executionLocation,
          onlineStatus: waker.machine?.online_status ?? null, connectionStatus: waker.machine?.connection_status ?? null,
          sessionCount: waker.sessionCount, taskCount: waker.taskCount,
        })),
        tasks: boardTasks.items.map(task => ({
          id: task.id, title: task.title, type: task.type, status: task.status, rawStatus: task.rawStatus,
          assigneeId: task.assignee?.id ?? null, assigneeName: task.assignee?.name ?? null,
          sourceType: task.source.type, sourceName: task.source.name,
          updatedAt: task.updatedAt, lastActiveAt: task.lastActiveAt,
        })),
        wakerTasks,
        activities,
        credits: sanitizeCredits(usageRaw),
        message: null,
      };
    } catch {
      return disconnected();
    }
  };

  return async () => {
    if (cacheMs > 0 && cached && Date.now() < cached.expiresAt) return cached.value;
    if (inFlight) return inFlight;
    inFlight = readOnce().then(snapshot => {
      if (cacheMs > 0 && snapshot.status === 'live') cached = { value: snapshot, expiresAt: Date.now() + cacheMs };
      else cached = null;
      return snapshot;
    }).finally(() => { inFlight = null; });
    return inFlight;
  };
}

export const readQoderWakeSnapshot = createQoderWakeReader();
