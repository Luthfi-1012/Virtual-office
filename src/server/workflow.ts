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
const timestamp = z.string().max(100).refine(value => Number.isFinite(Date.parse(value)));
const runIdentity = z.object({ runId: z.string().uuid(), status: text });
const dispatchSchema = z.union([runIdentity, z.object({ run: runIdentity })]);
const eventSchema = z.object({
  seq: z.number().int().nonnegative(), kind: text, correlationId: text, status: text,
  createdAt: timestamp, payload: z.unknown().optional(),
});
const runSchema = z.object({
  runId: z.string().uuid(), workflowId: z.string().uuid(), status: text,
  currentPhase: z.string().max(200).nullable().optional(), startedAt: timestamp.nullable().optional(), finishedAt: timestamp.nullable().optional(),
  events: z.array(eventSchema).max(20000).default([]), pendingConfirmations: z.array(z.unknown()).max(50).default([]),
});

export type QoderWakeCommand = (args: readonly string[]) => Promise<unknown>;
export type WorkflowWorker = { sequence: number; phase: string; label: string; status: string; nextOwner: string | null; updatedAt: string };
export type WorkflowStatus = {
  request: { runId: string | null; createdAt: string } | null;
  run: { runId: string; status: string; currentPhase: string | null; startedAt: string | null; finishedAt: string | null } | null;
  workers: WorkflowWorker[];
  pendingConfirmations: string[];
  gate: 'waiting_for_founder' | 'not_reached' | 'finished' | 'dispatch_unknown' | 'not_started';
};

async function execute(args: readonly string[]): Promise<unknown> {
  const executable = process.env.QODERWAKE_CLI_PATH?.trim() || 'qoderwake';
  const { stdout } = await execFileAsync(executable, [...args], {
    shell: false, windowsHide: true, timeout: 10000, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8',
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
    'Klien sintetis: Kopi Senja, kedai kopi lokal.',
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

type RequestRow = { fingerprint: string; idempotency_key: string; run_id: string | null; created_at: string };
export function createWorkflowService(db: Database.Database, command: QoderWakeCommand = execute) {
  const latest = () => db.prepare('SELECT fingerprint, idempotency_key, run_id, created_at FROM native_requests ORDER BY created_at DESC LIMIT 1').get() as RequestRow | undefined;
  async function status(): Promise<WorkflowStatus> {
    const request = latest();
    if (!request) return { request: null, run: null, workers: [], pendingConfirmations: [], gate: 'not_started' };
    const base = { request: { runId: request.run_id, createdAt: request.created_at } };
    if (!request.run_id) return { ...base, run: null, workers: [], pendingConfirmations: [], gate: 'dispatch_unknown' };
    const raw = runSchema.parse(await command(['workflow', 'run-get', request.run_id, '--json']));
    if (raw.runId !== request.run_id || raw.workflowId !== WORKFLOW_ID) throw new Error('Run tidak sesuai dengan permintaan tersimpan.');
    const confirmations = z.array(z.unknown()).max(50).parse(await command(['workflow', 'confirmations', request.run_id, '--json']));
    const workers = new Map<string, WorkflowWorker>();
    const pending = new Set<string>();
    const answered = new Set<string>();
    for (const event of raw.events) {
      const payload = record(event.payload);
      if (event.kind === 'worker.dispatched' && typeof payload.label === 'string' && typeof payload.phase === 'string') {
        workers.set(event.correlationId, { sequence: event.seq, phase: payload.phase, label: payload.label, status: event.status, nextOwner: null, updatedAt: event.createdAt });
      }
      if (event.kind === 'worker.completed') {
        const worker = workers.get(event.correlationId);
        if (worker) {
          worker.status = event.status; worker.updatedAt = event.createdAt;
          const result = record(payload.result);
          worker.nextOwner = typeof result.next_owner === 'string' ? result.next_owner : null;
        }
      }
      if (event.kind === 'ask_user.pending' && typeof payload.confirmationId === 'string') pending.add(payload.confirmationId);
      if (event.kind === 'ask_user.answered' && typeof payload.confirmationId === 'string') answered.add(payload.confirmationId);
    }
    for (const item of [...raw.pendingConfirmations, ...confirmations]) {
      const id = confirmationId(item); if (id) pending.add(id);
    }
    for (const id of answered) pending.delete(id);
    return {
      ...base,
      run: { runId: raw.runId, status: raw.status, currentPhase: raw.currentPhase ?? null, startedAt: raw.startedAt ?? null, finishedAt: raw.finishedAt ?? null },
      workers: [...workers.values()].sort((a, b) => a.sequence - b.sequence),
      pendingConfirmations: [...pending],
      gate: pending.size ? 'waiting_for_founder' : raw.status === 'succeeded' ? 'finished' : 'not_reached',
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
  };
}
export type OfficeWorkflow = ReturnType<typeof createWorkflowService>;
