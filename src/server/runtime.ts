import 'server-only';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { OfficeStore } from './store';
import { createOfficeApi } from './http';
import { createWorkflowService } from './workflow';

const runtime = globalThis as typeof globalThis & { officeApi?: ReturnType<typeof createOfficeApi> };
export async function handleRequest(request: Request) {
  try {
    if (!runtime.officeApi) {
      const path = resolve(/* turbopackIgnore: true */ process.env.OFFICE_DB_PATH ?? '.local/office.sqlite');
      mkdirSync(dirname(path), { recursive: true });
      const database = new Database(path);
      database.pragma('journal_mode = WAL');
      runtime.officeApi = createOfficeApi(new OfficeStore(database), undefined, createWorkflowService(database));
    }
    return await runtime.officeApi(request);
  } catch {
    return Response.json({ error: 'Penyimpanan lokal tidak dapat dibuka. Tidak ada keberhasilan yang dikonfirmasi.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
