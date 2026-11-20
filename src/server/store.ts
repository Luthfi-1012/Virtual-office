import type Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { z } from 'zod';
import { briefSchema, createPackage, validatePackage, type DeliveryPackage } from '../lib/domain';
import { migrate } from './migrate';
import * as tables from './schema';

const keySchema = z.string().min(8).max(100).regex(/^[a-zA-Z0-9-]+$/);
const refSchema = { jobId: z.string().min(1).max(80), version: z.number().int().positive() };
const submission = z.object({ key: keySchema, brief: briefSchema, jobId: refSchema.jobId.optional(), expectedVersion: refSchema.version.optional() })
  .refine(value => Boolean(value.jobId) === Boolean(value.expectedVersion), 'Revisi membutuhkan job dan versi.');
const decisionSchema = z.object({ key: keySchema, ...refSchema, decision: z.enum(['approve', 'hold']) });
export class DomainError extends Error {}

export class OfficeStore {
  private db;
  constructor(private sqlite: Database.Database, private produce: typeof createPackage = createPackage) {
    migrate(sqlite);
    this.db = drizzle(sqlite);
  }

  private once(key: string, payload: unknown, work: () => { jobId: string; version: number }) {
    const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    return this.sqlite.transaction(() => {
      const existing = this.db.select().from(tables.operations).where(eq(tables.operations.key, key)).get();
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw new DomainError('Konflik: kunci operasi dipakai untuk isi berbeda.');
        return existing.result;
      }
      const result = work();
      this.db.insert(tables.operations).values({ key, fingerprint, result }).run();
      return result;
    }).immediate();
  }

  submit(raw: unknown) {
    const input = submission.parse(raw);
    return this.once(input.key, { type: 'submit', ...input }, () => {
      const current = input.jobId ? this.db.select().from(tables.jobs).where(eq(tables.jobs.id, input.jobId)).get() : undefined;
      if (input.jobId && (!current || current.version !== input.expectedVersion)) throw new DomainError('Versi job berubah atau job tidak ditemukan.');
      const jobId = current?.id ?? randomUUID();
      const version = (current?.version ?? 0) + 1;
      const runId = randomUUID();
      const now = new Date().toISOString();
      if (current) this.db.update(tables.jobs).set({ brief: input.brief, version, status: 'waiting_for_founder' }).where(eq(tables.jobs.id, jobId)).run();
      else this.db.insert(tables.jobs).values({ id: jobId, version, status: 'waiting_for_founder', brief: input.brief, createdAt: now }).run();
      this.db.insert(tables.runs).values({ id: runId, jobId, version, source: 'local_fixture', input: input.brief, status: 'completed', createdAt: now }).run();
      const recordStep = (stage: string, status: string, summary: string, nextOwner: string) => {
        const createdAt = new Date().toISOString();
        this.db.insert(tables.steps).values({ jobId, runId, stage, status, summary, nextOwner, createdAt }).run();
        this.db.insert(tables.audit).values({ jobId, runId, version, message: summary, createdAt }).run();
      };
      recordStep('intake', 'completed', 'Validator lokal menerima brief terstruktur sintetis.', 'delivery');
      let result: DeliveryPackage;
      try {
        result = validatePackage(this.produce(input.brief, jobId, runId, version), jobId, runId, version);
      } catch {
        recordStep('delivery', 'failed', 'Validasi paket lokal gagal. Billing dan approval diblokir; periksa brief atau kontrak output.', 'founder');
        this.db.update(tables.jobs).set({ status: 'failed_qa' }).where(eq(tables.jobs.id, jobId)).run();
        this.db.update(tables.runs).set({ status: 'failed_qa' }).where(eq(tables.runs.id, runId)).run();
        return { jobId, version };
      }
      for (const kind of ['preview', 'invoice', 'qa'] as const)
        this.db.insert(tables.artifacts).values({ jobId, runId, version, kind, body: result[kind] }).run();
      recordStep('delivery', 'completed', 'Template lokal membentuk preview satu halaman; validasi struktur paket lulus (bukan uji browser).', 'billing');
      recordStep('billing', 'completed', 'Invoice simulasi disimpan. Tidak ada pengiriman, kontak, atau pembayaran.', 'founder');
      return { jobId, version };
    });
  }

  decide(raw: unknown) {
    const input = decisionSchema.parse(raw);
    return this.once(input.key, { type: 'decide', ...input }, () => {
      const job = this.snapshot().jobs.find(item => item.id === input.jobId);
      if (!job || job.version !== input.version) throw new DomainError('Versi paket berubah. Tinjau versi terbaru.');
      if (job.status !== 'waiting_for_founder' || !job.package) throw new DomainError('Paket belum valid atau sudah disetujui.');
      const runId = job.package.preview.runId;
      validatePackage(job.package, job.id, runId, job.version);
      const now = new Date().toISOString();
      this.db.insert(tables.approvals).values({ jobId: job.id, runId, version: job.version, decision: input.decision, actor: 'founder_local', scope: 'internal_preview_simulated_invoice', createdAt: now }).run();
      this.db.update(tables.jobs).set({ status: input.decision === 'approve' ? 'approved' : 'waiting_for_founder' }).where(eq(tables.jobs.id, job.id)).run();
      this.db.insert(tables.audit).values({ jobId: job.id, runId, version: job.version, createdAt: now, message: input.decision === 'approve' ? 'Founder menyetujui versi paket internal ini. Keputusan lokal; PM QoderWake belum terhubung.' : 'Founder menahan paket. Tidak ada approval atau kelanjutan native.' }).run();
      return { jobId: job.id, version: job.version };
    });
  }

  operation(key: string) {
    keySchema.parse(key);
    return this.db.select().from(tables.operations).where(eq(tables.operations.key, key)).get()?.result ?? null;
  }

  snapshot() {
    return { jobs: this.db.select().from(tables.jobs).orderBy(desc(tables.jobs.createdAt)).all().map(job => {
      const artifacts = this.db.select().from(tables.artifacts).where(eq(tables.artifacts.jobId, job.id)).orderBy(asc(tables.artifacts.id)).all();
      const current = artifacts.filter(item => item.version === job.version);
      let delivery: DeliveryPackage | null = null;
      if (current.length) {
        const value = Object.fromEntries(current.map(item => [item.kind, item.body])) as DeliveryPackage;
        const run = this.db.select().from(tables.runs).where(and(eq(tables.runs.jobId, job.id), eq(tables.runs.version, job.version))).get();
        if (!run) throw new Error('Run paket tidak ditemukan.');
        delivery = validatePackage(value, job.id, run.id, job.version);
      }
      return { ...job, package: delivery, artifacts,
        runs: this.db.select().from(tables.runs).where(eq(tables.runs.jobId, job.id)).orderBy(asc(tables.runs.version)).all(),
        steps: this.db.select().from(tables.steps).where(eq(tables.steps.jobId, job.id)).orderBy(asc(tables.steps.id)).all(),
        approvals: this.db.select().from(tables.approvals).where(eq(tables.approvals.jobId, job.id)).orderBy(asc(tables.approvals.id)).all(),
        audit: this.db.select().from(tables.audit).where(eq(tables.audit.jobId, job.id)).orderBy(asc(tables.audit.id)).all(),
      };
    }) };
  }
}
export type OfficeSnapshot = ReturnType<OfficeStore['snapshot']>;
export type OfficeJob = OfficeSnapshot['jobs'][number];
