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
    if (args[0] === 'board') return { items: [] };
    if (args[1] === 'run-get') return {
      runId, workflowId: WORKFLOW_ID, status: 'waiting_confirmation', currentPhase: 'Penyelesaian', startedAt: '2026-11-20T11:00:00Z', finishedAt: null,
      events: [
        { seq: 1, kind: 'worker.dispatched', correlationId: 'a', status: 'dispatched', createdAt: '2026-11-20T11:00:01Z', payload: { label: 'Susun paket ringkasan internal', phase: 'Penyelesaian', resolve: { kind: 'waker', wakerId: '7e1da47da422' }, instruction: 'private' } },
        { seq: 2, kind: 'worker.completed', correlationId: 'a', status: 'completed', createdAt: '2026-11-20T11:00:02Z', payload: { label: 'Susun paket ringkasan internal', phase: 'Penyelesaian', result: { next_owner: 'Billing Agent', summary: 'Ringkasan internal disusun.', issues: [{ title: 'minor' }], deliverable: 'private' } } },
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
  expect(status.workers).toEqual([{
    sequence: 1, phase: 'Penyelesaian', label: 'Susun paket ringkasan internal', wakerId: '7e1da47da422',
    status: 'completed', nextOwner: 'Billing Agent', summary: 'Ringkasan internal disusun.', issueCount: 1, updatedAt: '2026-11-20T11:00:02Z',
  }]);
  expect(JSON.stringify(status)).not.toContain('private');
  expect(command.mock.calls.map(call => call[0].slice(0, 2))).toEqual([
    ['workflow', 'run'], ['board', 'tasks'], ['workflow', 'run-get'], ['workflow', 'confirmations'],
  ]);
});

it('auto-discovers historical WakerFlow V13 runs from board tasks and executes native control commands', async () => {
  const boardRunId = 'c7bb61c3-b55b-4bca-b8a0-b576c49fecdf';
  const command = vi.fn<QoderWakeCommand>().mockImplementation(async args => {
    if (args[0] === 'board') return {
      items: [{
        sourceTaskId: boardRunId, title: '第 7 次运行', type: 'wakerflow_task', status: 'done', rawStatus: 'succeeded',
        assignee: { id: `wakerflow:${WORKFLOW_ID}`, name: 'Web Delivery Studio — Website Delivery' },
        source: { id: WORKFLOW_ID, name: 'Web Delivery Studio — Website Delivery' },
        lastActiveAt: '2026-11-20T19:32:50.064+07:00',
      }],
    };
    if (args[1] === 'run-get') return {
      runId: boardRunId, workflowId: WORKFLOW_ID, status: 'succeeded', currentPhase: 'Penyelesaian',
      startedAt: '2026-11-20T19:13:23.455+07:00', finishedAt: '2026-11-20T19:32:50.064+07:00',
      events: [
        { seq: 52, kind: 'ask_user.answered', correlationId: 'gate', status: 'completed', createdAt: '2026-11-20T12:32:13.139Z', payload: { confirmationId: 'conf-1', answer: { value: 'Setujui paket internal akhir', answeredAt: '2026-11-20T12:32:13.139Z' } } },
        { seq: 60, kind: 'run.final', correlationId: 'run', status: 'completed', createdAt: '2026-11-20T19:32:50.064+07:00', payload: { outcome: 'succeeded', return: { summary: 'Approval founder tercatat; paket internal disetujui.' } } },
      ],
      pendingConfirmations: [],
    };
    if (args[1] === 'confirmations') return [];
    return { ok: true };
  });
  const service = createWorkflowService(db, command);
  const status = await service.status();
  expect(status.gate).toBe('finished');
  expect(status.run?.title).toBe('第 7 次运行');
  expect(status.founderApproval?.value).toBe('Setujui paket internal akhir');
  expect(status.finalSummary).toBe('Approval founder tercatat; paket internal disetujui.');
  expect(status.recentRuns).toHaveLength(1);

  await service.confirm({ action: 'confirm', runId: boardRunId, confirmationId: 'conf-1', value: 'Setujui paket internal akhir' });
  await service.terminate({ action: 'terminate', runId: boardRunId });
  await service.retry({ action: 'retry', runId: boardRunId });
  await service.interruptSession({ action: 'interrupt_session', sessionId: 'sess-1' });
  expect(command).toHaveBeenCalledWith(['workflow', 'confirm', boardRunId, 'conf-1', '--value', 'Setujui paket internal akhir', '--json']);
  expect(command).toHaveBeenCalledWith(['workflow', 'run-terminate', boardRunId, '--json']);
  expect(command).toHaveBeenCalledWith(['workflow', 'run-retry', boardRunId, '--json']);
  expect(command).toHaveBeenCalledWith(['session', 'interrupt', '--session-id', 'sess-1', '--json']);
});
