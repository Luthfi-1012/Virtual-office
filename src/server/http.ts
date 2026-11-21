import { randomBytes, timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';
import { DomainError, type OfficeStore } from './store';
import { readQoderWakeSnapshot } from './qoderwake';
import type { QoderWakeSnapshot } from '../lib/qoderwake';
import type { OfficeWorkflow } from './workflow';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
});
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

async function readBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new HttpError(415, 'Gunakan JSON.');
  if (Number(request.headers.get('content-length')) > 16384) throw new HttpError(413, 'Brief melebihi batas 16 KB.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Isi request kosong.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new HttpError(413, 'Brief melebihi batas 16 KB.'); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'JSON tidak valid.'); }
}

export function createOfficeApi(
  store: OfficeStore,
  readNative: () => Promise<QoderWakeSnapshot> = readQoderWakeSnapshot,
  workflow?: OfficeWorkflow,
  sessions = new Map<string, number>(),
) {
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const host = request.headers.get('host') ?? '';
      const origin = request.headers.get('origin');
      const site = request.headers.get('sec-fetch-site');
      if (!/^(127\.0\.0\.1|localhost):[0-9]{1,5}$/.test(host)
        || (origin !== null && origin !== `http://${host}`)
        || (site !== null && !['same-origin', 'none'].includes(site))) throw new HttpError(403, 'Akses hanya dari aplikasi lokal.');
      if (url.pathname === '/api/session' && request.method === 'GET') {
        if (request.headers.get('x-office-client') !== 'local') throw new HttpError(403, 'Sesi lokal diperlukan.');
        const now = Date.now();
        for (const [token, expires] of sessions) if (expires <= now) sessions.delete(token);
        const previous = request.headers.get('cookie')?.match(/(?:^|;\s*)office_session=([a-f0-9]{64})(?:;|$)/)?.[1];
        const token = previous && sessions.has(previous) ? previous : randomBytes(32).toString('hex');
        sessions.set(token, now + 12 * 60 * 60 * 1000);
        return json({ csrf: token }, 200, { 'Set-Cookie': `office_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=43200` });
      }
      const token = request.headers.get('cookie')?.match(/(?:^|;\s*)office_session=([a-f0-9]{64})(?:;|$)/)?.[1];
      const csrf = request.headers.get('x-office-csrf') ?? '';
      if (!token || !sessions.has(token) || sessions.get(token)! <= Date.now() || !/^[a-f0-9]{64}$/.test(csrf)
        || !timingSafeEqual(Buffer.from(csrf), Buffer.from(token))) throw new HttpError(403, 'Sesi kedaluwarsa. Muat ulang koneksi lokal.');
      if (url.pathname === '/api/qoderwake/workflow') {
        if (!workflow) throw new HttpError(503, 'Integrasi WakerFlow belum tersedia.');
        if (request.method === 'GET') return json(await workflow.status(url.searchParams.get('runId') ?? undefined));
        if (request.method === 'POST') {
          const body = await readBody(request);
          if (body && typeof body === 'object' && 'action' in body) {
            if (body.action === 'confirm') return json(await workflow.confirm(body));
            if (body.action === 'terminate') return json(await workflow.terminate(body));
            if (body.action === 'retry') return json(await workflow.retry(body));
            if (body.action === 'interrupt_session') return json(await workflow.interruptSession(body));
            throw new HttpError(400, 'Operasi WakerFlow tidak dikenal.');
          }
          return json(await workflow.submit(body));
        }
        throw new HttpError(405, 'Metode tidak tersedia.');
      }
      if (url.pathname === '/api/qoderwake' && request.method === 'GET') return json(await readNative());
      if (url.pathname !== '/api/office') throw new HttpError(404, 'Tidak ditemukan.');
      if (request.method === 'GET') {
        const key = url.searchParams.get('operation');
        return json(key ? { result: store.operation(key) } : store.snapshot());
      }
      if (request.method !== 'POST') throw new HttpError(405, 'Metode tidak tersedia.');
      const body = await readBody(request);
      if (!body || typeof body !== 'object' || !('action' in body)) throw new HttpError(400, 'Operasi tidak valid.');
      if (body.action === 'submit') return json(store.submit(body));
      if (body.action === 'decide') return json(store.decide(body));
      throw new HttpError(400, 'Operasi tidak tersedia. Kontrol native belum terhubung.');
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      if (error instanceof ZodError) return json({ error: 'Lengkapi atau perbaiki brief. Tidak ada proses baru.', fields: Object.fromEntries(error.issues.map(issue => [issue.path.join('.'), issue.message])) }, 422);
      if (error instanceof DomainError) return json({ error: error.message }, 409);
      return json({ error: 'Penyimpanan tidak tersedia atau data tidak konsisten. Periksa status sebelum mengirim ulang.' }, 503);
    }
  };
}
