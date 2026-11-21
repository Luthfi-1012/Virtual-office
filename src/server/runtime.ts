import 'server-only';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { OfficeStore } from './store';
import { createOfficeApi } from './http';
import { createWorkflowService } from './workflow';

const runtime = globalThis as typeof globalThis & {
  officeApi?: ReturnType<typeof createOfficeApi>;
  officeStore?: OfficeStore;
  officeWorkflow?: ReturnType<typeof createWorkflowService>;
  officeSessions?: Map<string, number>;
};
export async function handleRequest(request: Request) {
  try {
    if (!runtime.officeStore || !runtime.officeWorkflow || !runtime.officeSessions) {
      const path = resolve(/* turbopackIgnore: true */ process.env.OFFICE_DB_PATH ?? '.local/office.sqlite');
      mkdirSync(dirname(path), { recursive: true });
      const database = new Database(path);
      database.pragma('journal_mode = WAL');
      runtime.officeStore = new OfficeStore(database);
      runtime.officeWorkflow = createWorkflowService(database);
      runtime.officeSessions = new Map<string, number>();
    }
    // Next dev reloads modules but preserves globalThis; rebuild only the handler, not stateful resources.
    if (!runtime.officeApi || process.env.NODE_ENV === 'development') {
      runtime.officeApi = createOfficeApi(runtime.officeStore, undefined, runtime.officeWorkflow, runtime.officeSessions);
    }
    return await runtime.officeApi(request);
  } catch {
    return Response.json({ error: 'Penyimpanan lokal tidak dapat dibuka. Tidak ada keberhasilan yang dikonfirmasi.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
