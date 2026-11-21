import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { QoderWakeActivity, QoderWakeSnapshot } from '../lib/qoderwake';

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
const taskSchema = z.object({
  id: text(2048), title: text(500), type: text(100), status: text(50), rawStatus: text(100),
  assignee: z.object({ id: text(500), name: text(200) }).nullable().optional(),
  source: z.object({ type: text(100), name: text(300) }),
  updatedAt: timestamp, lastActiveAt: timestamp,
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

export type QoderWakeCommand = (args: readonly string[]) => Promise<unknown>;
type Reader = () => Promise<QoderWakeSnapshot>;

async function execute(args: readonly string[]): Promise<unknown> {
  const executable = process.env.QODERWAKE_CLI_PATH?.trim() || 'qoderwake';
  const { stdout } = await execFileAsync(executable, [...args], {
    shell: false, windowsHide: true, timeout: 20000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8',
  });
  return JSON.parse(stdout) as unknown;
}

function disconnected(): QoderWakeSnapshot {
  return {
    status: 'disconnected', checkedAt: new Date().toISOString(), version: null, daemon: null, board: null,
    wakers: [], tasks: [], activities: [],
    message: 'Status QoderWake tidak dapat dibaca. Tidak ada tindakan native yang dilakukan.',
  };
}

export function createQoderWakeReader(command: QoderWakeCommand = execute): Reader {
  return async () => {
    try {
      const statusRaw = await command(['status', '--json']);
      const wakersRaw = await command(['waker', 'list', '--json']);
      const tasksRaw = await command(['board', 'tasks', '--limit', '50', '--json']);
      const summaryRaw = await command(['board', 'summary', '--json']);
      const status = statusSchema.parse(statusRaw);
      const wakers = z.array(wakerSchema).max(200).parse(wakersRaw);
      const boardTasks = boardTasksSchema.parse(tasksRaw);
      const summary = boardSummarySchema.parse(summaryRaw);
      if (!status.running || !status.reachable || !status.status.success || boardTasks.errors.length || summary.errors.length) throw new Error('QoderWake unavailable');
      const activities: QoderWakeActivity[] = [];
      for (const waker of wakers) {
        const sessions = z.array(sessionSchema).max(1000).parse(await command(['session', 'list', '--waker-id', waker.agentId, '--json']));
        if (sessions.some(session => session.agentId !== waker.agentId)) throw new Error('Unexpected session owner');
        activities.push(...sessions.map(session => ({
          id: session.sessionId, wakerId: session.agentId, title: session.title, status: session.status,
          startedAt: session.startedAt, lastActiveAt: session.lastActiveAt, endedAt: session.endedAt ?? null,
          source: session.sessionSource ?? null, scenario: session.scenario ?? null,
        })));
      }
      activities.sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt));
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
        activities: activities satisfies QoderWakeActivity[], message: null,
      };
    } catch {
      return disconnected();
    }
  };
}

export const readQoderWakeSnapshot = createQoderWakeReader();
