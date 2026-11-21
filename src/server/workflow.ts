import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { briefSchema, nativeProjectSchema, type Brief, type NativeProject } from '../lib/domain';

export const WORKFLOW_ID = '0a0dde04-5cc7-4fd8-ba79-1d850ce3494e';
export const WORKFLOW_VERSION = 13;
const execFileAsync = promisify(execFile);
const text = z.string().min(1).max(500);
const uuid = z.string().uuid();
const timestamp = z.string().max(100).refine(value => Number.isFinite(Date.parse(value)));
const runIdentity = z.object({ runId: uuid, status: text });
const dispatchSchema = z.union([runIdentity, z.object({ run: runIdentity })]);
const eventSchema = z.object({
  seq: z.number().int().nonnegative(), kind: text, correlationId: text, status: text,
  createdAt: timestamp, payload: z.unknown().optional(),
});
const runSchema = z.object({
  runId: uuid, workflowId: uuid, status: text,
  currentPhase: z.string().max(200).nullable().optional(), startedAt: timestamp.nullable().optional(), finishedAt: timestamp.nullable().optional(),
  events: z.array(eventSchema).max(20000).default([]), pendingConfirmations: z.array(z.unknown()).max(50).default([]),
});
const boardDiscoverySchema = z.object({
  items: z.array(z.object({
    sourceTaskId: z.string().max(200).nullable().optional(),
    title: text,
    type: text,
    status: text,
    rawStatus: z.string().max(100).optional(),
    assignee: z.object({ id: z.string().max(500), name: z.string().max(200) }).nullable().optional(),
    source: z.object({ id: z.string().max(200).optional(), name: z.string().max(300) }).optional(),
    lastActiveAt: timestamp,
  })).max(50),
});
const confirmActionSchema = z.strictObject({
  action: z.literal('confirm'),
  runId: uuid,
  confirmationId: z.string().min(1).max(120),
  value: z.string().min(1).max(200),
});
const runActionSchema = z.strictObject({
  action: z.enum(['terminate', 'retry']),
  runId: uuid,
});
const interruptSessionSchema = z.strictObject({
  action: z.literal('interrupt_session'),
  sessionId: z.string().min(1).max(120),
});

export type QoderWakeCommand = (args: readonly string[]) => Promise<unknown>;
export type WorkflowWorker = {
  sequence: number;
  phase: string;
  label: string;
  wakerId: string | null;
  status: string;
  nextOwner: string | null;
  summary: string | null;
  issueCount: number;
  updatedAt: string;
};
export type WorkflowRunSummary = { runId: string; title: string; status: string; updatedAt: string };
export type WorkflowStatus = {
  request: { runId: string | null; createdAt: string; source?: 'virtual_office' | 'qoderwake_board' } | null;
  run: { runId: string; title: string | null; status: string; currentPhase: string | null; startedAt: string | null; finishedAt: string | null } | null;
  workers: WorkflowWorker[];
  pendingConfirmations: string[];
  founderApproval: { value: string; answeredAt: string } | null;
  finalSummary: string | null;
  recentRuns: WorkflowRunSummary[];
  gate: 'waiting_for_founder' | 'not_reached' | 'finished' | 'dispatch_unknown' | 'not_started' | 'terminated' | 'failed';
};

async function execute(args: readonly string[]): Promise<unknown> {
  const executable = process.env.QODERWAKE_CLI_PATH?.trim() || 'qoderwake';
  const { stdout } = await execFileAsync(executable, [...args], {
    shell: false, windowsHide: true, timeout: 30000, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8',
  });
  return JSON.parse(stdout) as unknown;
}

function clientRequest(brief: Brief, project: NativeProject) {
  const brand = {
    client: brief.client, tagline: brief.tagline, description: brief.description,
    location: brief.location, hours: brief.hours, synthetic: brief.synthetic, menu: brief.menu,
  };
  return [
    'BRIEF PROYEK SINTETIS — DEMO INTERNAL VIRTUAL OFFICE',
    `Klien sintetis: ${brief.client} — ${brief.tagline}`,
    `Tujuan: ${project.objective}`,
    `Target pengguna: ${project.audience}`,
    `Halaman: ${project.pages.join(', ')}.`,
    'Hasil yang diminta: rancangan dan preview internal untuk empat halaman, bukan implementasi production.',
    'Fitur:', ...project.features.map((item, index) => `${index + 1}. ${item}`),
    'Kriteria penerimaan:', ...project.acceptance.map((item, index) => `${index + 1}. ${item}`),
    `Cakupan: ${project.scope}`,
    `Tenggat simulasi: ${project.deadline}`,
    `Batas anggaran simulasi: maksimal Rp6.000.000 (${project.budget.maximum} ${project.budget.currency}).`,
    `Rate card: ${project.budget.rateCard}`,
    `Pajak: ${project.budget.tax}`,
    'Data kedai, harga menu, jam buka, dan lokasi berikut adalah data demo/contoh; harga menu bukan biaya proyek:',
    JSON.stringify(brand, null, 2),
  ].join('\n');
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function confirmationId(value: unknown) {
  const item = record(value);
  return typeof item.confirmationId === 'string' ? item.confirmationId : typeof item.id === 'string' ? item.id : null;
}
function truncateText(value: unknown, limit: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return null;
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}
function gateFromStatus(pendingCount: number, runStatus: string): WorkflowStatus['gate'] {
  if (pendingCount > 0) return 'waiting_for_founder';
  if (runStatus === 'succeeded') return 'finished';
  if (runStatus === 'terminated' || runStatus === 'cancelled') return 'terminated';
  if (runStatus === 'failed') return 'failed';
  return 'not_reached';
}

type RequestRow = { fingerprint: string; idempotency_key: string; run_id: string | null; created_at: string };
export function createWorkflowService(db: Database.Database, command: QoderWakeCommand = execute) {
  const latest = () => db.prepare('SELECT fingerprint, idempotency_key, run_id, created_at FROM native_requests ORDER BY created_at DESC LIMIT 1').get() as RequestRow | undefined;
  const hasRecordedRun = (runId: string) => Boolean(db.prepare('SELECT 1 FROM native_requests WHERE run_id = ? LIMIT 1').get(runId));

  async function discoverBoardRuns(): Promise<WorkflowRunSummary[]> {
    try {
      const raw = boardDiscoverySchema.parse(await command(['board', 'tasks', '--limit', '20', '--json']));
      const targetAssignee = `wakerflow:${WORKFLOW_ID}`;
      return raw.items
        .filter(item => item.type === 'wakerflow_task'
          && uuid.safeParse(item.sourceTaskId).success
          && (item.assignee?.id === targetAssignee || item.source?.id === WORKFLOW_ID))
        .map(item => ({
          runId: item.sourceTaskId!,
          title: item.title,
          status: item.rawStatus || item.status,
          updatedAt: item.lastActiveAt,
        }));
    } catch {
      return [];
    }
  }

  async function status(requestedRunId?: string): Promise<WorkflowStatus> {
    const request = latest();
    const recentRuns = await discoverBoardRuns();

    if (request && !request.run_id && !requestedRunId) {
      return {
        request: { runId: null, createdAt: request.created_at, source: 'virtual_office' },
        run: null, workers: [], pendingConfirmations: [], founderApproval: null, finalSummary: null,
        recentRuns, gate: 'dispatch_unknown',
      };
    }

    const validRequestedId = uuid.safeParse(requestedRunId).success ? requestedRunId! : undefined;
    const requestedBoardRun = validRequestedId ? recentRuns.find(item => item.runId === validRequestedId) : undefined;
    const requestedLocalOk = validRequestedId ? hasRecordedRun(validRequestedId) : false;

    let targetRunId: string | null = null;
    let targetCreatedAt = '';
    let targetSource: 'virtual_office' | 'qoderwake_board' = 'virtual_office';
    let targetTitle: string | null = null;

    if (validRequestedId && (requestedLocalOk || requestedBoardRun)) {
      targetRunId = validRequestedId;
      targetCreatedAt = requestedBoardRun?.updatedAt ?? request?.created_at ?? new Date().toISOString();
      targetSource = requestedLocalOk ? 'virtual_office' : 'qoderwake_board';
      targetTitle = requestedBoardRun?.title ?? null;
    } else if (request?.run_id && (!recentRuns[0] || Date.parse(request.created_at) >= Date.parse(recentRuns[0].updatedAt))) {
      targetRunId = request.run_id;
      targetCreatedAt = request.created_at;
      targetSource = 'virtual_office';
      targetTitle = recentRuns.find(item => item.runId === request.run_id)?.title ?? null;
    } else if (recentRuns[0]) {
      targetRunId = recentRuns[0].runId;
      targetCreatedAt = recentRuns[0].updatedAt;
      targetSource = hasRecordedRun(recentRuns[0].runId) ? 'virtual_office' : 'qoderwake_board';
      targetTitle = recentRuns[0].title;
    }

    if (!targetRunId) {
      return {
        request: null, run: null, workers: [], pendingConfirmations: [],
        founderApproval: null, finalSummary: null, recentRuns: [], gate: 'not_started',
      };
    }

    const [rawRun, rawConfirmations] = await Promise.all([
      command(['workflow', 'run-get', targetRunId, '--json']),
      command(['workflow', 'confirmations', targetRunId, '--json']),
    ]);
    const raw = runSchema.parse(rawRun);
    if (raw.runId !== targetRunId || raw.workflowId !== WORKFLOW_ID) {
      throw new Error('Run tidak sesuai dengan WakerFlow studio.');
    }
    const confirmations = z.array(z.unknown()).max(50).parse(rawConfirmations);

    const workers = new Map<string, WorkflowWorker>();
    const pending = new Set<string>();
    const answered = new Set<string>();
    let founderApproval: WorkflowStatus['founderApproval'] = null;
    let finalSummary: string | null = null;

    for (const event of raw.events) {
      const payload = record(event.payload);
      if (event.kind === 'worker.dispatched' && typeof payload.label === 'string' && typeof payload.phase === 'string') {
        const resolveObj = record(payload.resolve);
        const wakerId = typeof resolveObj.wakerId === 'string' ? resolveObj.wakerId : null;
        workers.set(event.correlationId, {
          sequence: event.seq, phase: payload.phase, label: payload.label, wakerId,
          status: event.status, nextOwner: null, summary: null, issueCount: 0, updatedAt: event.createdAt,
        });
      }
      if (event.kind === 'worker.completed') {
        const worker = workers.get(event.correlationId);
        if (worker) {
          worker.status = event.status;
          worker.updatedAt = event.createdAt;
          const result = record(payload.result);
          worker.nextOwner = typeof result.next_owner === 'string' ? result.next_owner : null;
          worker.summary = truncateText(result.summary, 320);
          worker.issueCount = Array.isArray(result.issues) ? result.issues.length : 0;
        }
      }
      if (event.kind === 'ask_user.pending' && typeof payload.confirmationId === 'string') pending.add(payload.confirmationId);
      if (event.kind === 'ask_user.answered' && typeof payload.confirmationId === 'string') {
        answered.add(payload.confirmationId);
        const answer = record(payload.answer);
        const value = truncateText(answer.value, 120);
        if (value) {
          founderApproval = { value, answeredAt: typeof answer.answeredAt === 'string' ? answer.answeredAt : event.createdAt };
        }
      }
      if (event.kind === 'run.final') {
        const returned = record(payload.return);
        finalSummary = truncateText(returned.summary, 400);
      }
    }
    for (const item of [...raw.pendingConfirmations, ...confirmations]) {
      const id = confirmationId(item);
      if (id) pending.add(id);
    }
    for (const id of answered) pending.delete(id);

    return {
      request: { runId: targetRunId, createdAt: targetCreatedAt, source: targetSource },
      run: {
        runId: raw.runId,
        title: targetTitle,
        status: raw.status,
        currentPhase: raw.currentPhase ?? null,
        startedAt: raw.startedAt ?? null,
        finishedAt: raw.finishedAt ?? null,
      },
      workers: [...workers.values()].sort((a, b) => a.sequence - b.sequence),
      pendingConfirmations: [...pending],
      founderApproval,
      finalSummary,
      recentRuns,
      gate: gateFromStatus(pending.size, raw.status),
    };
  }

  return {
    status,
    async submit(input: unknown) {
      const { brief, project } = z.strictObject({ brief: briefSchema, project: nativeProjectSchema }).parse(input);
      const args = { client_request: clientRequest(brief, project) };
      const fingerprint = createHash('sha256').update(JSON.stringify({ workflowId: WORKFLOW_ID, version: WORKFLOW_VERSION, args })).digest('hex');
      const key = `virtual-office-v${WORKFLOW_VERSION}-${fingerprint}`;
      const existing = db.prepare('SELECT run_id FROM native_requests WHERE fingerprint = ?').get(fingerprint) as { run_id: string | null } | undefined;
      if (existing) {
        if (!existing.run_id) throw new Error('Hasil dispatch sebelumnya belum diketahui; submit ulang diblokir untuk mencegah run ganda.');
        return { runId: existing.run_id, reused: true };
      }
      const createdAt = new Date().toISOString();
      db.prepare('INSERT INTO native_requests (fingerprint, idempotency_key, run_id, created_at) VALUES (?, ?, NULL, ?)').run(fingerprint, key, createdAt);
      const raw = dispatchSchema.parse(await command(['workflow', 'run', WORKFLOW_ID, '--args-json', JSON.stringify(args), '--idempotency-key', key, '--json']));
      const dispatched = 'run' in raw ? raw.run : raw;
      db.prepare('UPDATE native_requests SET run_id = ? WHERE fingerprint = ?').run(dispatched.runId, fingerprint);
      return { runId: dispatched.runId, reused: false };
    },
    async confirm(input: unknown) {
      const { runId, confirmationId: confId, value } = confirmActionSchema.parse(input);
      await command(['workflow', 'confirm', runId, confId, '--value', value, '--json']);
      return { ok: true, action: 'confirm' as const, runId, confirmationId: confId };
    },
    async terminate(input: unknown) {
      const { runId } = runActionSchema.parse({ ...record(input), action: 'terminate' });
      await command(['workflow', 'run-terminate', runId, '--json']);
      return { ok: true, action: 'terminate' as const, runId };
    },
    async retry(input: unknown) {
      const { runId } = runActionSchema.parse({ ...record(input), action: 'retry' });
      await command(['workflow', 'run-retry', runId, '--json']);
      return { ok: true, action: 'retry' as const, runId };
    },
    async interruptSession(input: unknown) {
      const { sessionId } = interruptSessionSchema.parse(input);
      await command(['session', 'interrupt', '--session-id', sessionId, '--json']);
      return { ok: true, action: 'interrupt_session' as const, sessionId };
    },
  };
}
export type OfficeWorkflow = ReturnType<typeof createWorkflowService>;
