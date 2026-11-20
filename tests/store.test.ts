import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { OfficeStore } from '../src/server/store';
import { kopiSenja } from '../src/lib/fixture';
import { createPackage } from '../src/lib/domain';

let db: Database.Database;
let store: OfficeStore;
beforeEach(() => { db = new Database(':memory:'); store = new OfficeStore(db); });
afterEach(() => db.close());
const submit = (key = 'request-0001') => store.submit({ key, brief: kopiSenja });

it('persists a local run with ordered processing and versioned linked artifacts', () => {
  const result = submit();
  const job = store.snapshot().jobs[0];
  expect(job.id).toBe(result.jobId);
  expect(job.status).toBe('waiting_for_founder');
  expect(job.runs[0].source).toBe('local_fixture');
  expect(job.steps.map(step => step.stage)).toEqual(['intake', 'delivery', 'billing']);
  expect(job.package?.invoice.total).toBe(5500000);
  expect(job.approvals).toHaveLength(0);
});
it('does not persist incomplete brief or create downstream outputs', () => {
  expect(() => store.submit({ key: 'request-0001', brief: { ...kopiSenja, audience: '' } })).toThrow();
  expect(store.snapshot().jobs).toHaveLength(0);
});
it('reconciles duplicate requests even through another store instance', () => {
  const first = submit();
  const reopened = new OfficeStore(db);
  expect(reopened.submit({ key: 'request-0001', brief: kopiSenja })).toEqual(first);
  expect(reopened.snapshot().jobs).toHaveLength(1);
  expect(reopened.snapshot().jobs[0].runs).toHaveLength(1);
  expect(reopened.operation('request-0001')).toEqual(first);
  expect(() => store.submit({ key: 'request-0001', brief: { ...kopiSenja, tagline: 'Berubah' } })).toThrow(/konflik/i);
});
it('preserves history and requires fresh approval after a revision', () => {
  const { jobId, version } = submit();
  store.decide({ key: 'approve-0001', jobId, version, decision: 'approve' });
  expect(store.snapshot().jobs[0].status).toBe('approved');
  store.submit({ key: 'revision-0001', jobId, expectedVersion: 1, brief: { ...kopiSenja, tagline: 'Cerita baru' } });
  const job = store.snapshot().jobs[0];
  expect(job.version).toBe(2);
  expect(job.status).toBe('waiting_for_founder');
  expect(job.approvals).toHaveLength(1);
  expect(job.package?.invoice.invoiceId).toBe(`SIM-${jobId}`);
  expect(job.package?.invoice.previewVersion).toBe(2);
  expect(job.artifacts).toHaveLength(6);
  expect(() => store.decide({ key: 'stale-0001', jobId, version: 1, decision: 'approve' })).toThrow(/versi/i);
  expect(() => store.submit({ key: 'stale-revise', jobId, expectedVersion: 1, brief: kopiSenja })).toThrow(/versi/i);
});
it('hold does not approve; repeated approvals do not duplicate the decision', () => {
  const ref = submit();
  store.decide({ ...ref, key: 'hold-0001', decision: 'hold' });
  expect(store.snapshot().jobs[0].status).toBe('waiting_for_founder');
  const input = { ...ref, key: 'approve-0001', decision: 'approve' as const };
  store.decide(input); store.decide(input);
  expect(store.snapshot().jobs[0].approvals).toHaveLength(2);
  expect(() => store.decide({ ...ref, key: 'hold-after-approve', decision: 'hold' })).toThrow();
});
it('rejects cross-job and invalid output before Billing or approval', () => {
  const broken = new OfficeStore(db, (input, jobId, runId, version) => {
    const result = createPackage(input, jobId, runId, version);
    result.preview.jobId = 'another-job';
    return result;
  });
  const result = broken.submit({ key: 'broken-0001', brief: kopiSenja });
  const job = store.snapshot().jobs[0];
  expect(job.status).toBe('failed_qa');
  expect(job.package).toBeNull();
  expect(job.steps.map(s => s.stage)).toEqual(['intake', 'delivery']);
  expect(() => store.decide({ ...result, key: 'invalid-approve', decision: 'approve' })).toThrow();
});
it.each([{ name: { unexpected: 'object' }, passed: true }, { name: 'Review', passed: 'yes' }, { name: 'Review', passed: false }])('blocks malformed or failed QA before Billing: %j', invalidCheck => {
  const broken = new OfficeStore(db, (input, jobId, runId, version) => {
    const result = createPackage(input, jobId, runId, version);
    Object.assign(result.qa[0], invalidCheck);
    return result;
  });
  const ref = broken.submit({ key: 'invalid-qa-001', brief: kopiSenja });
  const job = broken.snapshot().jobs[0];
  expect(job.status).toBe('failed_qa');
  expect(job.package).toBeNull();
  expect(job.steps.map(step => step.stage)).toEqual(['intake', 'delivery']);
  expect(() => broken.decide({ ...ref, key: 'invalid-qa-approve', decision: 'approve' })).toThrow();
});
it('retains artifacts, approval and deduplication after closing and reopening the database file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'virtual-office-test-'));
  const path = join(directory, 'office.sqlite');
  let disk = new Database(path);
  try {
    const first = new OfficeStore(disk);
    const ref = first.submit({ key: 'disk-request-001', brief: kopiSenja });
    first.decide({ ...ref, key: 'disk-approval-001', decision: 'approve' });
    disk.close();
    disk = new Database(path);
    const reopened = new OfficeStore(disk);
    expect(reopened.submit({ key: 'disk-request-001', brief: kopiSenja })).toEqual(ref);
    const job = reopened.snapshot().jobs[0];
    expect(job.status).toBe('approved');
    expect(job.runs).toHaveLength(1);
    expect(job.artifacts).toHaveLength(3);
    expect(job.approvals).toHaveLength(1);
    expect(reopened.operation('disk-approval-001')).toEqual(ref);
  } finally {
    if (disk.open) disk.close();
    rmSync(directory, { recursive: true });
  }
});
it('rolls back partial writes on storage failure, without returning success', () => {
  db.exec("CREATE TRIGGER fail_artifact BEFORE INSERT ON artifacts BEGIN SELECT RAISE(ABORT, 'storage unavailable'); END;");
  expect(() => submit()).toThrow();
  expect(store.snapshot().jobs).toHaveLength(0);
  expect(store.operation('request-0001')).toBeNull();
});
