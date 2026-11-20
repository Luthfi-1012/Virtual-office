import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { kopiSenja, kopiSenjaNativeRequest } from '../src/lib/fixture';
import { migrate } from '../src/server/migrate';
import { createWorkflowService, WORKFLOW_ID, type QoderWakeCommand } from '../src/server/workflow';

let db: Database.Database;
beforeEach(() => { db = new Database(':memory:'); migrate(db); });
afterEach(() => db.close());

const runId = '123e4567-e89b-42d3-a456-426614174000';
const dispatch = { runId, workflowId: WORKFLOW_ID, status: 'running' };

it('uses only the fixed V13 flow and reuses one persistent run for an identical complete brief', async () => {
  const command = vi.fn<QoderWakeCommand>().mockResolvedValue(dispatch);
  const service = createWorkflowService(db, command);
  const first = await service.submit(kopiSenjaNativeRequest);
  const second = await service.submit(kopiSenjaNativeRequest);
  expect(second).toEqual({ ...first, reused: true });
  expect(command).toHaveBeenCalledTimes(1);
  const args = command.mock.calls[0][0];
  expect(args.slice(0, 3)).toEqual(['workflow', 'run', WORKFLOW_ID]);
  expect(args).toContain('--idempotency-key');
  const input = JSON.parse(args[args.indexOf('--args-json') + 1]);
  expect(Object.keys(input)).toEqual(['client_request']);
  for (const required of [
    'Kopi Senja', 'SINTETIS', 'calon pengunjung', 'ponsel', 'Warga sekitar, pekerja',
    'Beranda', 'Menu', 'Tentang', 'Kontak', 'Navigasi', 'harga contoh', 'data demo',
    'Jam buka contoh', 'lokasi contoh', 'hanya elemen preview', 'jangan menghubungi siapa pun',
    'preview internal', 'Input kosong atau tidak valid', 'kode production', 'website production',
    'Tidak ada publikasi', 'API production', 'pengiriman invoice', 'pembayaran', 'kontak klien',
    '7 hari kerja', 'menunggu approval founder', 'satu kemungkinan siklus revisi',
    '6000000', 'IDR', 'Asumsi demo, bukan harga yang disepakati klien', 'Tidak dihitung',
  ]) expect(input.client_request).toContain(required);
  db.close();
  db = new Database(':memory:'); migrate(db);
});

it('does not reuse the previous incomplete request identity', async () => {
  const oldRequest = `DATA SINTETIS untuk uji integrasi Virtual Office. Buat paket internal satu halaman kedai kopi. Jangan mengirim invoice, menghubungi klien, memproses pembayaran, atau memublikasikan. Brief:\n${JSON.stringify(kopiSenja, null, 2)}`;
  const oldFingerprint = createHash('sha256').update(JSON.stringify({ workflowId: WORKFLOW_ID, version: 13, args: { client_request: oldRequest } })).digest('hex');
  db.prepare('INSERT INTO native_requests (fingerprint, idempotency_key, run_id, created_at) VALUES (?, ?, ?, ?)').run(oldFingerprint, `virtual-office-v13-${oldFingerprint}`, '7e27d3e9-8116-41ec-b708-56608979119a', '2026-11-20T07:00:00.000Z');
  const command = vi.fn<QoderWakeCommand>().mockResolvedValue(dispatch);
  const result = await createWorkflowService(db, command).submit(kopiSenjaNativeRequest);
  expect(result).toEqual({ runId, reused: false });
  const args = command.mock.calls[0][0];
  expect(args[args.indexOf('--idempotency-key') + 1]).not.toBe(`virtual-office-v13-${oldFingerprint}`);
});

it('validates the complete browser payload before any dispatch', async () => {
  const command = vi.fn<QoderWakeCommand>();
  const service = createWorkflowService(db, command);
  await expect(service.submit({ ...kopiSenjaNativeRequest, workflowId: 'attacker-selected' })).rejects.toThrow();
  await expect(service.submit({ ...kopiSenjaNativeRequest, brief: { ...kopiSenja, synthetic: false } })).rejects.toThrow();
  await expect(service.submit({ ...kopiSenjaNativeRequest, project: { ...kopiSenjaNativeRequest.project, objective: '' } })).rejects.toThrow();
  await expect(service.submit({ ...kopiSenjaNativeRequest, project: { ...kopiSenjaNativeRequest.project, budget: { ...kopiSenjaNativeRequest.project.budget, maximum: 6000001 } } })).rejects.toThrow();
  await expect(service.submit({ brief: kopiSenja })).rejects.toThrow();
  expect(command).not.toHaveBeenCalled();
});

it('returns actual run status, worker order and founder gate without conversation or result bodies', async () => {
  const command = vi.fn<QoderWakeCommand>().mockImplementation(async args => {
    if (args[1] === 'run') return dispatch;
    if (args[1] === 'run-get') return {
      runId, workflowId: WORKFLOW_ID, status: 'waiting_confirmation', currentPhase: 'Penyelesaian', startedAt: '2026-11-20T11:00:00Z', finishedAt: null,
      events: [
        { seq: 1, kind: 'worker.dispatched', correlationId: 'a', status: 'dispatched', createdAt: '2026-11-20T11:00:01Z', payload: { label: 'Susun paket ringkasan internal', phase: 'Penyelesaian', instruction: 'private' } },
        { seq: 2, kind: 'worker.completed', correlationId: 'a', status: 'completed', createdAt: '2026-11-20T11:00:02Z', payload: { label: 'Susun paket ringkasan internal', phase: 'Penyelesaian', result: { next_owner: 'Billing Agent', deliverable: 'private' } } },
        { seq: 3, kind: 'ask_user.pending', correlationId: 'b', status: 'pending', createdAt: '2026-11-20T11:00:03Z', payload: { confirmationId: 'gate-1', question: 'private' } },
      ], pendingConfirmations: [{ confirmationId: 'gate-1', question: 'private' }],
    };
    if (args[1] === 'confirmations') return [{ confirmationId: 'gate-1', question: 'private' }];
    throw new Error('unexpected command');
  });
  const service = createWorkflowService(db, command);
  await service.submit(kopiSenjaNativeRequest);
  const status = await service.status();
  expect(status.run?.runId).toBe(runId);
  expect(status.gate).toBe('waiting_for_founder');
  expect(status.pendingConfirmations).toEqual(['gate-1']);
  expect(status.workers).toEqual([{ sequence: 1, phase: 'Penyelesaian', label: 'Susun paket ringkasan internal', status: 'completed', nextOwner: 'Billing Agent', updatedAt: '2026-11-20T11:00:02Z' }]);
  expect(JSON.stringify(status)).not.toContain('private');
  expect(command.mock.calls.map(call => call[0].slice(0, 2))).toEqual([['workflow', 'run'], ['workflow', 'run-get'], ['workflow', 'confirmations']]);
});
