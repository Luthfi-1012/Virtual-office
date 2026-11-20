'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { agents, facilities } from '@/lib/agents';
import type { Brief, NativeProject } from '@/lib/domain';
import { kopiSenjaNativeRequest } from '@/lib/fixture';
import type { OfficeSnapshot } from '@/server/store';
import { activeTaskStatuses, isQoderWakeSnapshot, matchWakerByName, snapshotFreshness, wakerWorkState, SNAPSHOT_MAX_AGE_MS, type QoderWakeSnapshot } from '@/lib/qoderwake';
import { OfficeMap } from './office-map';
import { BriefForm } from './brief-form';
import { JobPanel, statusLabel } from './job-panel';
import { AgentPortrait } from './agent-portrait';

function RailIcon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

type Operation = { action: 'submit'; key: string; brief: Brief; jobId?: string; expectedVersion?: number } | { action: 'decide'; key: string; jobId: string; version: number; decision: 'approve' | 'hold' };
type OpenForm = { id: string; kind: 'new' } | { id: string; kind: 'revise'; jobId: string; baseVersion: number; initial: Brief };
type WorkflowView = { request: { runId: string | null; createdAt: string } | null; run: { runId: string; status: string; currentPhase: string | null; startedAt: string | null; finishedAt: string | null } | null; workers: { sequence: number; phase: string; label: string; status: string; nextOwner: string | null; updatedAt: string }[]; pendingConfirmations: string[]; gate: 'waiting_for_founder' | 'not_reached' | 'finished' | 'dispatch_unknown' | 'not_started' };
const emptyWorkflow: WorkflowView = { request: null, run: null, workers: [], pendingConfirmations: [], gate: 'not_started' };
class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

function disconnectedNative(message: string): QoderWakeSnapshot {
  return { status: 'disconnected', checkedAt: new Date().toISOString(), version: null, daemon: null, board: null, wakers: [], tasks: [], activities: [], message };
}

const nativeTime = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
// Twelve sequential CLI reads can each use the adapter's 10-second timeout; allow 10 more seconds for overhead.
const QODERWAKE_REQUEST_TIMEOUT_MS = 130_000;

export function OfficeApp() {
  const [snapshot, setSnapshot] = useState<OfficeSnapshot>({ jobs: [] });
  const [selectedJob, setSelectedJob] = useState('');
  const [selected, setSelected] = useState('pm');
  const [view, setView] = useState('map');
  const [sceneFailed, setSceneFailed] = useState(false);
  const [form, setForm] = useState<OpenForm | null>(null);
  const [connected, setConnected] = useState(false);
  const [native, setNative] = useState<QoderWakeSnapshot>({ status: 'disconnected', checkedAt: '', version: null, daemon: null, board: null, wakers: [], tasks: [], activities: [], message: null });
  const [workflow, setWorkflow] = useState<WorkflowView>(emptyWorkflow);
  const [lastSuccess, setLastSuccess] = useState('');
  const [now, setNow] = useState(0);
  const nativeGeneration = useRef(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Operation | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const csrf = useRef('');
  const flight = useRef(false);
  const job = snapshot.jobs.find(item => item.id === selectedJob) ?? snapshot.jobs[0];
  const agent = agents.find(item => item.id === selected);
  const facility = facilities.find(item => item.id === selected);
  const freshness = snapshotFreshness(native, now);
  const nativeCurrent = freshness === 'fresh';
  const freshnessLabel = freshness === 'fresh' ? 'Terbaru' : freshness === 'stale' ? 'Kedaluwarsa' : 'Koneksi terputus';
  const nativeWaker = nativeCurrent && agent ? matchWakerByName(native.wakers, agent.name) : undefined;
  const nativeTasks = nativeWaker ? native.tasks.filter(task => task.assigneeId === nativeWaker.id) : [];
  const nativeActivities = nativeWaker ? native.activities.filter(activity => activity.wakerId === nativeWaker.id) : [];
  const otherNativeTasks = nativeCurrent ? native.tasks.filter(task => task.assigneeId !== nativeWaker?.id) : [];
  const workState = agent ? wakerWorkState(native, agent.name, now) : 'unknown';
  const eligibleAgents = (nativeCurrent
    ? agents.filter(item => wakerWorkState(native, item.name, now) === 'idle')
    : agents
  ).map(item => item.id);
  const agentNativeStatus = !nativeCurrent ? `${freshnessLabel} · status tidak diketahui`
    : !nativeWaker ? 'Peran tidak ditemukan'
    : workState === 'active' ? `Task aktif · ${nativeTasks.filter(task => activeTaskStatuses.has(task.status)).map(task => task.status).join(', ')}`
    : workState === 'idle' ? 'Tanpa task aktif pada snapshot' : 'Status tugas tidak diketahui';
  const room = selected === 'development'
    ? { name: 'Development Room', description: 'Ruang kolaborasi untuk lima peran perancang dan pembangun produk.', group: 'development' as const }
    : selected === 'delivery' ? { name: 'Web Delivery Room', description: 'Ruang untuk intake, pengemasan hasil, dan billing simulasi.', group: 'delivery' as const } : undefined;
  const nativeStep = agent?.stage && job?.steps.filter(item => item.stage === agent.stage && item.runId === job.runs.at(-1)?.id).at(-1);
  const disabled = busy || !connected || Boolean(pending);
  const revisionJob = form?.kind === 'revise' ? snapshot.jobs.find(item => item.id === form.jobId) : undefined;
  const revisionConflict = form?.kind === 'revise' && revisionJob?.version !== form.baseVersion;

  async function request(path: string, body?: Operation | { brief: Brief; project: NativeProject }) {
    const response = await fetch(path, { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(path === '/api/qoderwake' ? QODERWAKE_REQUEST_TIMEOUT_MS : path.startsWith('/api/qoderwake/workflow') ? 30000 : 15000),
      method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-office-csrf': csrf.current }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    if (!response.ok) throw new ApiError(result.error ?? 'Request ditolak.', response.status);
    return result;
  }
  async function refreshWorkflow(generation = nativeGeneration.current) {
    try {
      const data = await request('/api/qoderwake/workflow') as WorkflowView;
      if (generation === nativeGeneration.current) setWorkflow(data);
    } catch {
      if (generation === nativeGeneration.current) setMessage('Status WakerFlow belum dapat dibaca. Jangan mengirim ulang brief; periksa status terlebih dahulu.');
    }
  }
  async function refreshNative(generation: number) {
    try {
      const data: unknown = await request('/api/qoderwake');
      if (!isQoderWakeSnapshot(data)) throw new Error('Invalid QoderWake snapshot');
      if (generation !== nativeGeneration.current) return;
      setNow(Date.now());
      setNative(data);
      if (data.status === 'live') setLastSuccess(data.checkedAt);
    } catch {
      if (generation !== nativeGeneration.current) return;
      setNative(disconnectedNative('Status QoderWake tidak dapat dibaca. Penyimpanan lokal tidak terpengaruh.'));
    }
  }
  useEffect(() => {
    const updateTime = () => setNow(Date.now());
    updateTime();
    const expiry = Date.parse(native.checkedAt) + SNAPSHOT_MAX_AGE_MS - Date.now();
    const timer = Number.isFinite(expiry) && expiry > 0 ? window.setTimeout(updateTime, expiry) : undefined;
    document.addEventListener('visibilitychange', updateTime);
    window.addEventListener('focus', updateTime);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', updateTime);
      window.removeEventListener('focus', updateTime);
    };
  }, [native]);
  function savePending(value: Operation | null) {
    if (value) sessionStorage.setItem('office-pending', JSON.stringify(value)); else sessionStorage.removeItem('office-pending');
    setPending(value);
  }
  async function refresh() {
    if (flight.current) return;
    const generation = ++nativeGeneration.current;
    flight.current = true; setBusy(true); setCanRetry(false);
    try {
      const response = await fetch('/api/session', { headers: { 'x-office-client': 'local' }, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Sesi lokal tidak tersedia.');
      const session = await response.json();
      if (generation !== nativeGeneration.current) return;
      csrf.current = session.csrf;
      const data = await request('/api/office');
      if (generation !== nativeGeneration.current) return;
      setSnapshot(data); setConnected(true); setMessage('');
      await refreshNative(generation);
      await refreshWorkflow(generation);
      if (generation !== nativeGeneration.current) return;
      const stored = sessionStorage.getItem('office-pending');
      if (stored) {
        const operation: Operation = JSON.parse(stored);
        setPending(operation);
        const { result } = await request(`/api/office?operation=${encodeURIComponent(operation.key)}`);
        if (result) { savePending(null); setSelectedJob(result.jobId); setForm(null); setNotice('Operasi ditemukan di penyimpanan. Tidak dikirim ulang.'); }
        else { setCanRetry(true); setMessage('Operasi belum tercatat. Anda dapat mengirim ulang operasi yang sama tanpa membuat kunci baru.'); }
      }
    } catch {
      if (generation !== nativeGeneration.current) return;
      setConnected(false);
      setNative(disconnectedNative('Status QoderWake belum diperbarui karena pemeriksaan koneksi gagal.'));
      setMessage('Koneksi belum terkonfirmasi. Data mungkin usang; periksa koneksi sebelum melanjutkan.');
    } finally { flight.current = false; setBusy(false); }
  }
  useEffect(() => {
    void refresh();
    const offline = () => {
      nativeGeneration.current++;
      setConnected(false);
      setNative(current => ({ ...disconnectedNative('Offline. Snapshot QoderWake terakhir tidak ditampilkan sebagai status aktual.'), checkedAt: current.checkedAt }));
      setMessage('Offline. Data tersimpan mungkin usang; operasi baru dinonaktifkan.');
    };
    const online = () => { setMessage('Jaringan kembali. Periksa koneksi untuk merekonsiliasi status.'); };
    window.addEventListener('offline', offline); window.addEventListener('online', online);
    return () => { window.removeEventListener('offline', offline); window.removeEventListener('online', online); };
    // The initial connection is single-flight; reconnect is an explicit user action.
  }, []);

  async function mutate(operation: Operation) {
    if (flight.current) return;
    flight.current = true; setBusy(true); setMessage(''); setNotice(''); setCanRetry(false);
    let acknowledged = false;
    try {
      savePending(operation);
      const result = await request('/api/office', operation);
      acknowledged = true;
      const data = await request('/api/office');
      setSnapshot(data); setSelectedJob(result.jobId); setForm(null); savePending(null); setConnected(true);
      setNotice('Perubahan tersimpan di aplikasi lokal. Tidak ada eksekusi QoderWake.');
    } catch (error) {
      if (!acknowledged && error instanceof ApiError && [400, 403, 409, 413, 415, 422].includes(error.status)) {
        savePending(null); setMessage(error.message);
        if (error.status === 403 || error.status === 409) setConnected(false);
      } else { setConnected(false); setMessage(acknowledged ? 'Perubahan diterima server, tetapi tampilan belum sinkron. Periksa koneksi sebelum mengirim ulang.' : 'Hasil operasi belum diketahui. Periksa koneksi untuk mencari hasil sebelum mengirim ulang.'); }
    } finally { flight.current = false; setBusy(false); }
  }
  async function submitNative(brief: Brief) {
    if (flight.current) return;
    flight.current = true; setBusy(true); setMessage(''); setNotice('');
    try {
      const result = await request('/api/qoderwake/workflow', { brief, project: kopiSenjaNativeRequest.project }) as { runId: string; reused: boolean };
      setForm(null); setConnected(true);
      setNotice(result.reused ? `Run ${result.runId} sudah ada; tidak ada run baru.` : `Run ${result.runId} diterima QoderWake. Ini belum membuktikan hasil bisnis selesai.`);
      await refreshWorkflow();
    } catch (error) {
      setMessage(error instanceof Error ? `${error.message} Jangan mengirim ulang sebelum status run diperiksa.` : 'Dispatch belum terkonfirmasi. Jangan mengirim ulang sebelum status run diperiksa.');
    } finally { flight.current = false; setBusy(false); }
  }
  const select = (id: string) => { setSelected(id); };
  const openNewBrief = () => {
    setForm({ id: crypto.randomUUID(), kind: 'new' }); setMessage('');
    requestAnimationFrame(() => document.getElementById('work-section')?.scrollIntoView({ block: 'start' }));
  };
  return <div className="app-shell">
    <a className="skip-link" href="#main">Lewati ke area kerja</a>
    <header className="topbar">
      <a className="brand" href="/" aria-label="Virtual Office beranda"><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span><span>Virtual Office<small>WEB DELIVERY STUDIO</small></span></a>
      <div className="topbar-context">Professional Services Studio<span>Satu kantor untuk seluruh proses.</span></div>
      <div className="topbar-actions"><div className="connection"><span className={connected ? 'status-dot online' : 'status-dot'}/><span>{connected ? 'Tersambung ke penyimpanan lokal' : 'Koneksi lokal belum terkonfirmasi'}</span></div><button className="connection-button" onClick={() => void refresh()} disabled={busy}>Periksa koneksi</button></div>
      <div className="founder"><span className="avatar" aria-hidden="true"><RailIcon><circle cx="12" cy="8" r="3"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></RailIcon></span><span>Founder<small>Operator lokal</small></span></div>
    </header>
    <div className="mode-banner"><span className={`badge ${nativeCurrent ? 'good' : 'warm'}`}>Snapshot QoderWake</span><div className="snapshot-summary"><p><strong data-testid="snapshot-status" role="status">{freshnessLabel}</strong> · Pemeriksaan terakhir: {native.checkedAt ? <time data-testid="snapshot-checked" dateTime={native.checkedAt}>{nativeTime.format(new Date(native.checkedAt))}</time> : 'belum diperiksa'}{lastSuccess && !nativeCurrent && <> · Snapshot sukses terakhir: <time data-testid="snapshot-success" dateTime={lastSuccess}>{nativeTime.format(new Date(lastSuccess))}</time></>}</p><p>{!nativeCurrent && 'Status Waker tidak diketahui. '}<strong>Preview, invoice, dan gerak kantor tetap simulasi</strong>. Baca-saja · refresh manual · kedaluwarsa setelah 60 detik (aturan UI, bukan jaminan QoderWake).</p></div></div>
    <div className="workspace-layout">
      <nav className="icon-rail" aria-label="Navigasi kantor">
        <div className="rail-main">
          <button className={view === 'map' ? 'active' : ''} aria-label="Kantor 3D" data-tooltip="Kantor" onClick={() => setView('map')}><RailIcon><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></RailIcon></button>
          <button className={view === 'list' ? 'active' : ''} aria-label="Tim agent" data-tooltip="Tim agent" onClick={() => setView('list')}><RailIcon><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6"/></RailIcon></button>
          <button aria-label="Pekerjaan" data-tooltip="Pekerjaan" onClick={() => document.getElementById('work-section')?.scrollIntoView({ block: 'start' })}><RailIcon><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5M8 17h3"/></RailIcon></button>
          <button aria-label="Buat brief baru" data-tooltip="Brief baru" disabled={disabled} onClick={openNewBrief}><RailIcon><path d="M12 5v14M5 12h14"/></RailIcon></button>
        </div>
        <span className="rail-local">LOKAL</span>
      </nav>
      <main id="main" className="workspace-main">
        <div className="workspace-heading"><div><span className="eyebrow">KANTOR / LANTAI UTAMA</span><h1>Ruang kerja Anda.</h1><p>Delapan peran, dua tim, satu pandangan yang jelas.</p></div><span className="heading-stat"><strong>8</strong><span>Waker<br/>2 tim</span></span></div>
        {message && <div className="notice error" role="alert">{message}{pending && canRetry && <button disabled={busy} onClick={() => void mutate(pending)}>Kirim ulang operasi yang sama</button>}</div>}
        <div className="sr-only" role="status">{notice || (busy ? 'Memeriksa penyimpanan lokal.' : '')}</div>
        {revisionConflict && form?.kind === 'revise' && <div className="notice error" role="alert"><p>Paket sudah berubah. Draf Anda tetap disimpan dan belum dikirim. Tinjau paket terbaru di bawah sebelum menerapkan draf sebagai revisi baru.</p><div className="button-row"><button disabled={disabled || !revisionJob} onClick={() => { if (revisionJob) setForm({ ...form, baseVersion: revisionJob.version }); }}>Terapkan draf ke versi terbaru</button><button disabled={disabled} onClick={() => setForm(null)}>Buang draf</button></div></div>}
        <section className="office-stage" aria-label="Virtual Office">
          <div className="map-toolbar"><div><span className="view-indicator" aria-hidden="true"/>KANTOR 3D <span className="muted">/ pilih figur atau ruang</span></div><div className="segmented"><button aria-pressed={view === 'map'} onClick={() => setView('map')}>Denah</button><button aria-pressed={view === 'list'} onClick={() => setView('list')}>Daftar agent</button></div></div>
          {view === 'map' && <div className="map-canvas"><OfficeMap selected={selected} eligibleAgents={eligibleAgents} snapshotExpiresAt={nativeCurrent ? Date.parse(native.checkedAt) + SNAPSHOT_MAX_AGE_MS : 0} snapshotLabel={freshnessLabel} onSelect={select} onFallback={() => setSceneFailed(true)}/></div>}
          <div className={view === 'list' || sceneFailed ? 'agent-directory visible' : 'agent-directory mobile-fallback'}>{['development', 'delivery'].map(group => <section key={group}><h3>{group === 'development' ? 'Development Room' : 'Web Delivery Room'}<span>{group === 'development' ? '5 peran' : '3 peran bisnis'}</span></h3>{agents.filter(item => item.group === group).map(item => <button key={item.id} aria-label={`Detail ${item.name}`} aria-pressed={selected === item.id} onClick={() => select(item.id)}><span className="role-avatar" aria-hidden="true"><RailIcon><circle cx="12" cy="8" r="3.2"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></RailIcon></span><span><strong>{item.name}</strong><small>{!nativeCurrent ? freshnessLabel : wakerWorkState(native, item.name, now) === 'active' ? 'Task aktif pada snapshot' : wakerWorkState(native, item.name, now) === 'idle' ? 'Tanpa task aktif pada snapshot' : 'Status tugas tidak diketahui'}</small></span><span aria-hidden="true">↗</span></button>)}</section>)}</div>
          <div className="room-legend"><span><i className="dev-swatch"/>Development · 5 peran</span><span><i className="delivery-swatch"/>Web Delivery · 3 peran</span><span>{`Snapshot QoderWake · ${freshnessLabel}`}</span></div>
        </section>
        <section className="work-section" id="work-section" aria-label="Pekerjaan dan hasil">
          <div className="work-section-heading"><div><span className="eyebrow">RUANG KERJA FOUNDER</span><h2>Pekerjaan & hasil</h2><p>Brief, preview, invoice simulasi, dan keputusan tersimpan.</p></div><button className="primary new-brief" disabled={disabled} onClick={openNewBrief}>Brief baru<span aria-hidden="true">＋</span></button></div>
          <div className="job-list" aria-label="Daftar pekerjaan">{snapshot.jobs.length === 0 ? <p className="empty-small">Belum ada pekerjaan. Mulai dari brief sintetis pertama.</p> : snapshot.jobs.map(item => <button key={item.id} className={`job-card ${job?.id === item.id ? 'active' : ''}`} onClick={() => { setSelectedJob(item.id); setForm(null); }} disabled={busy || !!pending}><span className="job-icon" aria-hidden="true">K</span><span><strong>{item.brief.client}</strong><small>v{item.version} · {statusLabel[item.status]}</small></span></button>)}</div>
          {form && <BriefForm key={form.id} initial={form.kind === 'revise' ? form.initial : undefined} busy={disabled} submitBlocked={revisionConflict} onCancel={() => setForm(null)} onSubmit={brief => mutate({ action: 'submit', key: crypto.randomUUID(), brief, ...(form.kind === 'revise' ? { jobId: form.jobId, expectedVersion: form.baseVersion } : {}) })} onNativeSubmit={submitNative}/>}
          {workflow.request && <section className="job-panel panel" aria-label="Run WakerFlow native">
            <div className="section-heading"><div><span className="eyebrow">WAKERFLOW NATIVE · V13 · TERPISAH DARI DEMO LOKAL</span><h2>Web Delivery Studio</h2></div><span className={`badge ${workflow.gate === 'waiting_for_founder' ? 'good' : 'warm'}`}>{workflow.gate === 'waiting_for_founder' ? 'Menunggu approval founder' : workflow.gate === 'finished' ? 'Run selesai' : workflow.gate === 'dispatch_unknown' ? 'Dispatch belum diketahui' : 'Approval belum tercapai'}</span></div>
            <dl className="facts"><div><dt>Run ID</dt><dd className="mono" data-testid="workflow-run-id">{workflow.request.runId ?? 'Belum terkonfirmasi'}</dd></div><div><dt>Status QoderWake</dt><dd data-testid="workflow-status">{workflow.run?.status ?? 'Belum tersedia'}</dd></div><div><dt>Fase aktual</dt><dd>{workflow.run?.currentPhase ?? 'Belum tersedia'}</dd></div><div><dt>Confirmation pending</dt><dd>{workflow.pendingConfirmations.length}</dd></div></dl>
            <p className="scope-note">Status dan urutan berikut berasal dari event run QoderWake. Aplikasi tidak menyetujui gate dan tidak menjalankan PM akhir secara manual.</p>
            {workflow.workers.length > 0 && <ol className="timeline">{workflow.workers.map(worker => <li key={worker.sequence}><span className="timeline-dot"/><div><p><strong>{worker.phase}</strong> · {worker.label}</p><span className="muted">{worker.status}{worker.nextOwner ? ` · next_owner: ${worker.nextOwner}` : ' · next_owner belum tersedia'}</span></div></li>)}</ol>}
            <div className="button-row"><button disabled={busy} onClick={() => void refreshWorkflow()}>Periksa status run</button></div>
          </section>}
          {job ? <JobPanel key={`${job.id}-${job.version}`} job={job} disabled={disabled} onRevise={() => setForm({ id: crypto.randomUUID(), kind: 'revise', jobId: job.id, baseVersion: job.version, initial: job.brief })} onDecide={decision => void mutate({ action: 'decide', key: crypto.randomUUID(), jobId: job.id, version: job.version, decision })}/> : <section className="empty-job panel"><span className="eyebrow">DARI BRIEF KE HASIL</span><h2>Mulai dari satu kebutuhan klien.</h2><p>Buat brief Kopi Senja untuk meninjau preview satu halaman, invoice simulasi, dan jejak validasi lokal.</p><div className="empty-pipeline"><span>Intake</span><span aria-hidden="true">→</span><span>Delivery</span><span aria-hidden="true">→</span><span>Billing</span></div></section>}
        </section>
      </main>
      <aside className="inspector" aria-label="Detail agent">
        {agent ? <>
          <div className="inspector-topline"><span className="eyebrow">PROFIL AGENT</span><span className="badge">{agent.group === 'development' ? 'Development' : 'Web Delivery'}</span></div>
          <AgentPortrait id={agent.id}/>
          <h2>{agent.name}</h2>
          <span className={`native-status ${nativeWaker ? 'current' : ''}`} data-testid="native-status">{agentNativeStatus}</span>
          <p className="agent-role">{agent.role}</p>
          <div className="inspector-section">
            <h3>Status pekerjaan</h3>
            {nativeWaker ? <>
              <dl className="facts">
                <div><dt>Waker</dt><dd>{nativeWaker.status} · {nativeWaker.executionLocation}</dd></div>
                <div><dt>Sesi / tugas pada profil</dt><dd>{nativeWaker.sessionCount} / {nativeWaker.taskCount}</dd></div>
                <div><dt>Koneksi mesin</dt><dd>{nativeWaker.onlineStatus ?? 'Tidak diketahui'} / {nativeWaker.connectionStatus ?? 'Tidak diketahui'}</dd></div>
                <div><dt>Handoff native</dt><dd>Tidak diverifikasi oleh snapshot ini</dd></div>
              </dl>
              <h3 className="native-subheading">Tugas Task Board</h3>
              {nativeTasks.length ? <ul className="native-records">{nativeTasks.slice(0, 5).map(task => <li key={task.id}><strong>{task.title}</strong><span>{task.status} · {task.sourceName}</span><time dateTime={task.lastActiveAt}>{nativeTime.format(new Date(task.lastActiveAt))}</time></li>)}</ul> : <p className="native-empty">Tidak ada tugas untuk Waker ini dalam cuplikan Task Board yang diterima.</p>}
            </> : <dl className="facts"><div><dt>Tugas native</dt><dd>{nativeCurrent ? 'Nama peran tidak memiliki kecocokan Waker yang unik' : 'Belum ada data'}</dd></div><div><dt>Progres / tahap</dt><dd>Tidak diketahui</dd></div><div><dt>Handoff native</dt><dd>Belum terverifikasi</dd></div></dl>}
          </div>
          {nativeStep && <div className="local-step"><h3>Pemrosesan lokal terkait</h3><p>{nativeStep.summary}</p><small>{nativeStep.status === 'completed' ? 'Selesai' : 'Gagal'} · selanjutnya: {nativeStep.nextOwner}</small><p className="muted">Bukan tugas atau hasil eksekusi Waker.</p></div>}
          <div className="activity-empty">
            <h3>Aktivitas sesi QoderWake</h3>
            {nativeActivities.length ? <ul className="native-records">{nativeActivities.slice(0, 6).map(activity => <li key={activity.id}><strong>{activity.title}</strong><span>{activity.status}{activity.source ? ` · ${activity.source}` : ''}</span><time dateTime={activity.lastActiveAt}>{nativeTime.format(new Date(activity.lastActiveAt))}</time></li>)}</ul> : <p>{nativeCurrent ? nativeWaker ? 'Tidak ada metadata sesi untuk Waker ini pada snapshot. Isi percakapan tidak dibaca.' : 'Aktivitas tidak dapat dipetakan tanpa kecocokan nama Waker yang unik.' : 'Belum tersedia dari QoderWake. Tidak ada aktivitas atau percakapan yang direkayasa.'}</p>}
          </div>
        </> : room ? <><div className="inspector-topline"><span className="eyebrow">RUANG TIM</span><span className="badge">{room.group === 'development' ? '5 peran' : '3 peran'}</span></div><div className={`room-portrait ${room.group}`} aria-hidden="true"><RailIcon><path d="m12 3 9 5v10l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5M12 13v10M8 10.5v4M16 10.5v4"/></RailIcon></div><h2>{room.name}</h2><p>{room.description}</p><span className="native-status">Model ruang 3D</span><div className="inspector-section"><h3>Peran dalam ruangan</h3><div className="room-agent-list">{agents.filter(item => item.group === room.group).map(item => <button key={item.id} onClick={() => select(item.id)}>{item.name}<span aria-hidden="true">→</span></button>)}</div></div></> : <><div className="inspector-topline"><span className="eyebrow">FASILITAS BERSAMA</span><span className="badge">Area visual</span></div><div className="facility-portrait" aria-hidden="true"><RailIcon><path d="M3 21V8l9-5 9 5v13M7 21v-8h10v8M8 8h.01M12 8h.01M16 8h.01"/></RailIcon></div><h2>{facility?.name}</h2><p>{facility?.description}</p><span className="native-status">Area visual saja</span><p className="facility-note">Fasilitas mendukung Simulasi kantor lokal: pantry, membaca di sudut fokus, dan duduk di lounge. Bukan lokasi atau aktivitas Waker sebenarnya; tidak ada reservasi atau layanan native.</p></>}
        <div className="integration-note" data-testid="qoderwake-connection">
          <h3>Snapshot QoderWake</h3>
          <p><strong>{freshnessLabel}{nativeCurrent ? ` · CLI ${native.version}` : ''}</strong></p>
          <p>{nativeCurrent ? `${native.wakers.length} Waker terbaca. Status dan metadata berlaku pada waktu pemeriksaan, bukan streaming.` : freshness === 'stale' ? 'Periksa koneksi untuk memperbarui snapshot. Data lama disembunyikan; Waker tidak dianggap idle atau bekerja.' : native.message ?? 'Menunggu pemeriksaan status QoderWake.'}</p>
          {nativeCurrent && native.board && <div className="native-board">
            <h3>Task Board global</h3>
            <p>Waktu sumber: <time dateTime={native.board.generatedAt}>{nativeTime.format(new Date(native.board.generatedAt))}</time>. Cuplikan {native.tasks.length} dari {native.board.total} tugas.</p>
            <p>{native.board.total} tugas · {native.board.byStatus.running} berjalan · {native.board.byStatus.done} selesai · {native.board.byStatus.failed} gagal.</p>
            <p>Perlu perhatian: {native.board.attention.approval} approval · {native.board.attention.acceptance} acceptance.</p>
            {otherNativeTasks.length > 0 && <ul className="native-records">{otherNativeTasks.slice(0, 5).map(task => <li key={task.id}><strong>{task.title}</strong><span>{task.sourceName} · {task.status}</span><time dateTime={task.lastActiveAt}>{nativeTime.format(new Date(task.lastActiveAt))}</time></li>)}</ul>}
          </div>}
          <dl className="control-list"><div><dt>Pause</dt><dd>Tidak tersedia</dd></div><div><dt>Resume</dt><dd>Tidak tersedia</dd></div><div><dt>Stop</dt><dd>Tidak tersedia</dd></div></dl>
          <p className="muted">Snapshot hanya membaca status. Panel WakerFlow terpisah dapat memulai flow V13 dengan ID tetap; isi percakapan dan artefak tidak dibaca, dan approval tidak dikendalikan aplikasi.</p>
        </div>
        <div className="credit-note"><span className="eyebrow">KREDIT QODER</span><p>Belum ada bukti usage untuk aplikasi ini.</p><small>Tidak diperkirakan dari token atau aktivitas lokal.</small></div>
      </aside>
    </div><footer className="app-footer"><span>VIRTUAL OFFICE · PROTOTYPE LOKAL</span><span>Preview internal / Invoice simulasi / Tanpa publikasi</span></footer>
  </div>;
}
