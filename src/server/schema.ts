import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { Brief } from '../lib/domain';

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(), version: integer('version').notNull(),
  status: text('status', { enum: ['waiting_for_founder', 'approved', 'failed_qa'] }).notNull(),
  brief: text('brief', { mode: 'json' }).$type<Brief>().notNull(), createdAt: text('created_at').notNull(),
});
export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(), jobId: text('job_id').notNull().references(() => jobs.id),
  version: integer('version').notNull(), source: text('source').notNull(),
  input: text('input', { mode: 'json' }).$type<Brief>().notNull(),
  status: text('status').notNull(), createdAt: text('created_at').notNull(),
}, table => [uniqueIndex('run_version').on(table.jobId, table.version)]);
export const steps = sqliteTable('steps', {
  id: integer('id').primaryKey({ autoIncrement: true }), jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').notNull().references(() => runs.id), stage: text('stage').notNull(), status: text('status').notNull(),
  summary: text('summary').notNull(), nextOwner: text('next_owner').notNull(), createdAt: text('created_at').notNull(),
});
export const artifacts = sqliteTable('artifacts', {
  id: integer('id').primaryKey({ autoIncrement: true }), jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').notNull().references(() => runs.id), version: integer('version').notNull(),
  kind: text('kind').notNull(), body: text('body', { mode: 'json' }).$type<unknown>().notNull(),
}, table => [uniqueIndex('artifact_version').on(table.jobId, table.version, table.kind)]);
export const approvals = sqliteTable('approvals', {
  id: integer('id').primaryKey({ autoIncrement: true }), jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').notNull().references(() => runs.id), version: integer('version').notNull(),
  decision: text('decision', { enum: ['approve', 'hold'] }).notNull(),
  actor: text('actor').notNull(), scope: text('scope').notNull(), createdAt: text('created_at').notNull(),
});
export const operations = sqliteTable('operations', {
  key: text('key').primaryKey(), fingerprint: text('fingerprint').notNull(),
  result: text('result', { mode: 'json' }).$type<{ jobId: string; version: number }>().notNull(),
});
export const audit = sqliteTable('audit', {
  id: integer('id').primaryKey({ autoIncrement: true }), jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').notNull().references(() => runs.id), version: integer('version').notNull(),
  message: text('message').notNull(), createdAt: text('created_at').notNull(),
});
export const controls = sqliteTable('controls', {
  id: text('id').primaryKey(), jobId: text('job_id').notNull().references(() => jobs.id),
  action: text('action').notNull(), state: text('state').notNull(), createdAt: text('created_at').notNull(),
});
