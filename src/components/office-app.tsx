'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { agents, facilities } from '@/lib/agents';
import type { Brief, NativeProject } from '@/lib/domain';
import { kopiSenjaNativeRequest } from '@/lib/fixture';
import type { OfficeSnapshot } from '@/server/store';
import type { ProjectStage } from '@/lib/office-motion';
import {
  isQoderWakeSnapshot, matchWakerById, snapshotFreshness, wakerAssignedTasks, wakerDisplayStatus, wakerWorkState,
  SNAPSHOT_MAX_AGE_MS, type QoderWakeSnapshot, type WakerDisplayStatus,
} from '@/lib/qoderwake';
import { OfficeMap } from './office-map';
import { BriefForm } from './brief-form';
import { JobPanel, statusLabel } from './job-panel';
import { AgentPortrait } from './agent-portrait';

function RailIcon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

type Operation = { action: 'submit'; key: string; brief: Brief; jobId?: string; expectedVersion?: number } | { action: 'decide'; key: string; jobId: string; version: number; decision: 'approve' | 'hold' };
type WorkflowAction = { action: 'confirm'; runId: string; confirmationId: string; value: string } | { action: 'terminate' | 'retry'; runId: string } | { action: 'interrupt_session'; sessionId: string };
type OpenForm = { id: string; kind: 'new' } | { id: string; kind: 'revise'; jobId: string; baseVersion: number; initial: Brief };
type WorkflowWorker = {
  sequence: number; phase: string; label: string; wakerId?: string | null; status: string;
  nextOwner: string | null; summary?: string | null; issueCount?: number; updatedAt: string;
};
type WorkflowRunSummary = { runId: string; title: string; status: string; updatedAt: string };
type WorkflowView = {
  request: { runId: string | null; createdAt: string; source?: 'virtual_office' | 'qoderwake_board' } | null;
  run: { runId: string; title?: string | null; status: string; currentPhase: string | null; startedAt: string | null; finishedAt: string | null } | null;
  workers: WorkflowWorker[];
  pendingConfirmations: string[];
  founderApproval?: { value: string; answeredAt: string } | null;
  finalSummary?: string | null;
  recentRuns?: WorkflowRunSummary[];
  gate: 'waiting_for_founder' | 'not_reached' | 'finished' | 'dispatch_unknown' | 'not_started' | 'terminated' | 'failed';
};
const emptyWorkflow: WorkflowView = {
  request: null, run: null, workers: [], pendingConfirmations: [], founderApproval: null,
  finalSummary: null, recentRuns: [], gate: 'not_started',
};
class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

function disconnectedNative(message: string): QoderWakeSnapshot {
  return {
    status: 'disconnected', checkedAt: new Date().toISOString(), version: null, daemon: null, board: null,
    wakers: [], tasks: [], wakerTasks: [], activities: [], credits: null, message,
  };
}

const nativeTime = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
// Keep client abort limit above browser clock fast-forward tests while real parallel CLI snapshots resolve in ~14s.
const QODERWAKE_REQUEST_TIMEOUT_MS = 180_000;
const REALTIME_IDLE_POLL_MS = 60_000;
const REALTIME_ACTIVE_POLL_MS = 15_000;
const activeWorkflowStatuses = new Set(['running', 'waiting_confirmation', 'pending', 'queued']);

export function OfficeApp() {
  const [snapshot, setSnapshot] = useState<OfficeSnapshot>({ jobs: [] });
  const [selectedJob, setSelectedJob] = useState('');
  const [selected, setSelected] = useState('pm');
  const [view, setView] = useState('map');
  const [sceneFailed, setSceneFailed] = useState(false);
  const [form, setForm] = useState<OpenForm | null>(null);
  const [connected, setConnected] = useState(false);
  const [native, setNative] = useState<QoderWakeSnapshot>({ status: 'disconnected', checkedAt: '', version: null, daemon: null, board: null, wakers: [], tasks: [], wakerTasks: [], activities: [], credits: null, message: null });
  const [workflow, setWorkflow] = useState<WorkflowView>(emptyWorkflow);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState('');
  const [now, setNow] = useState(0);
  const nativeGeneration = useRef(0);
  const [busy, setBusy] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [nativePending, setNativePending] = useState(true);
  const [networkOffline, setNetworkOffline] = useState(false);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Operation | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [manualProjectStage, setManualProjectStage] = useState<ProjectStage | null>(null);
  const flowTimers = useRef<number[]>([]);
  const csrf = useRef('');
  const flight = useRef(false);
  const nativeFlight = useRef(false);
  const silentFlight = useRef(false);
  const selectedRunRef = useRef<string | null>(null);
  selectedRunRef.current = selectedRunId;

  function clearFlowTimers() {
    for (const id of flowTimers.current) window.clearTimeout(id);
    flowTimers.current = [];
  }

  function startProjectFlow(autoComplete = false) {
    clearFlowTimers();
    setManualProjectStage({ kind: 'kickoff', label: 'Kickoff Meeting · 8 agent berkumpul menyusun rencana di ruang rapat' });
    flowTimers.current.push(
      window.setTimeout(() => setManualProjectStage({ kind: 'handoff', from: 'intake', to: 'pm', label: 'Handoff Intake → PM · Validasi brief & pembagian peran' }), 9500),
      window.setTimeout(() => setManualProjectStage({ kind: 'handoff', from: 'design', to: 'frontend', label: 'Kolaborasi UI/UX ↔ Frontend · Penyusunan preview & antarmuka' }), 16500),
      window.setTimeout(() => setManualProjectStage({ kind: 'handoff', from: 'qa', to: 'delivery', label: 'Handoff QA → Delivery · Verifikasi kualitas & pengemasan paket' }), 23500),
      window.setTimeout(() => setManualProjectStage({ kind: 'approval', label: 'Approval Gate · PM & Billing siap, menunggu keputusan Founder' }), 30500),
    );
    if (autoComplete) {
      flowTimers.current.push(
        window.setTimeout(() => setManualProjectStage({ kind: 'celebrate', label: 'Alur proyek selesai · Tim kembali beraktivitas normal di kantor' }), 39500),
        window.setTimeout(() => setManualProjectStage(null), 43000),
      );
    }
  }

  function finishProjectFlow() {
    clearFlowTimers();
    setManualProjectStage({ kind: 'celebrate', label: 'Keputusan Founder tercatat · Tim kembali beraktivitas normal di kantor' });
    flowTimers.current.push(window.setTimeout(() => setManualProjectStage(null), 3500));
  }

  useEffect(() => {
    const saved = window.localStorage.getItem('office-theme');
    if (saved === 'dark' || saved === 'light') setTheme(saved);
    return () => clearFlowTimers();
  }, []);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    window.localStorage.setItem('office-theme', theme);
  }, [theme]);

  const job = snapshot.jobs.find(item => item.id === selectedJob) ?? snapshot.jobs[0];
  const agent = agents.find(item => item.id === selected);
  const facility = facilities.find(item => item.id === selected);
  const freshness = snapshotFreshness(native, now);
  const nativeCurrent = freshness === 'fresh';
  const checkingNative = nativePending && !networkOffline && freshness === 'disconnected';
  const freshnessLabel = checkingNative ? 'Memeriksa QoderWake' : freshness === 'fresh' ? 'Terbaru' : freshness === 'stale' ? 'Kedaluwarsa' : 'Koneksi terputus';
  const nativeWaker = nativeCurrent && agent ? matchWakerById(native.wakers, agent.wakerId) : undefined;
  const nativeTasks = nativeWaker ? wakerAssignedTasks(native, nativeWaker.id) : [];
  const nativeActivities = nativeWaker ? native.activities.filter(activity => activity.wakerId === nativeWaker.id) : [];
  const otherNativeTasks = nativeCurrent ? native.tasks.filter(task => task.assigneeId !== nativeWaker?.id) : [];
  const runningSession = nativeCurrent ? native.activities.find(activity => activity.status === 'running') : undefined;
  const workflowActive = Boolean(workflow.run && activeWorkflowStatuses.has(workflow.run.status));
  const derivedNativeStage: ProjectStage | null = !workflowActive
    ? null
    : workflow.gate === 'waiting_for_founder'
      ? { kind: 'approval', label: 'Approval Gate QoderWake · PM & Billing menunggu keputusan Founder' }
      : /intake|validasi/i.test(workflow.run?.currentPhase ?? '')
        ? { kind: 'kickoff', label: 'WakerFlow Intake & Validasi · Tim berkumpul di ruang rapat' }
        : /perancangan/i.test(workflow.run?.currentPhase ?? '')
          ? { kind: 'handoff', from: 'design', to: 'backend', label: 'WakerFlow Perancangan · UI/UX & Backend menyusun spesifikasi' }
          : /frontend/i.test(workflow.run?.currentPhase ?? '')
            ? { kind: 'handoff', from: 'frontend', to: 'qa', label: 'WakerFlow Frontend · Implementasi & serah terima ke QA' }
            : /qa/i.test(workflow.run?.currentPhase ?? '')
              ? { kind: 'handoff', from: 'qa', to: 'delivery', label: 'WakerFlow QA · Audit kualitas & serah terima ke Delivery' }
              : { kind: 'handoff', from: 'delivery', to: 'billing', label: 'WakerFlow Penyelesaian · Pengemasan hasil & draft billing' };
  const projectStage = manualProjectStage ?? derivedNativeStage;
  const eligibleAgents = (nativeCurrent
    ? agents.filter(item => wakerWorkState(native, item.wakerId, now) === 'idle')
    : agents
  ).map(item => item.id);
  const wakerStatuses = Object.fromEntries(agents.map(item => [item.id, checkingNative
    ? { kind: 'unknown', label: 'Memeriksa QoderWake · status belum diketahui' } as const
    : wakerDisplayStatus(native, item.wakerId, now)
  ])) as Record<string, WakerDisplayStatus>;
  const agentNativeStatus = agent ? wakerStatuses[agent.id].label : `${freshnessLabel} · status tidak diketahui`;
  const room = selected === 'development'
    ? { name: 'Development Room', description: 'Ruang kolaborasi untuk lima peran perancang dan pembangun produk.', group: 'development' as const }
    : selected === 'delivery' ? { name: 'Web Delivery Room', description: 'Ruang untuk intake, pengemasan hasil, dan billing simulasi.', group: 'delivery' as const } : undefined;
  const nativeStep = agent?.stage && job?.steps.filter(item => item.stage === agent.stage && item.runId === job.runs.at(-1)?.id).at(-1);
  const disabled = busy || !connected || Boolean(pending);
  const revisionJob = form?.kind === 'revise' ? snapshot.jobs.find(item => item.id === form.jobId) : undefined;
  const revisionConflict = form?.kind === 'revise' && revisionJob?.version !== form.baseVersion;

  async function request(path: string, body?: Operation | WorkflowAction | { brief: Brief; project: NativeProject }) {
    const response = await fetch(path, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: AbortSignal.timeout(path === '/api/qoderwake' ? QODERWAKE_REQUEST_TIMEOUT_MS : path.startsWith('/api/qoderwake/workflow') ? 45000 : 15000),
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', 'x-office-csrf': csrf.current },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new ApiError(result.error ?? 'Request ditolak.', response.status);
    return result;
  }

  async function refreshWorkflow(generation = nativeGeneration.current, runId = selectedRunRef.current, silent = false) {
    try {
      const target = runId ? `/api/qoderwake/workflow?runId=${encodeURIComponent(runId)}` : '/api/qoderwake/workflow';
      const data = await request(target) as WorkflowView;
      if (generation === nativeGeneration.current) setWorkflow(data);
    } catch {
      if (!silent && generation === nativeGeneration.current) {
        setMessage('Status WakerFlow belum dapat dibaca. Jangan mengirim ulang brief; periksa status terlebih dahulu.');
      }
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

  async function silentSync(generation = nativeGeneration.current) {
    if (flight.current || nativeFlight.current || silentFlight.current || document.hidden || networkOffline || !connected) return;
    silentFlight.current = true;
    try {
      await Promise.all([
        refreshNative(generation),
        refreshWorkflow(generation, workflow.run?.runId ?? selectedRunRef.current, true),
      ]);
    } finally {
      silentFlight.current = false;
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

  useEffect(() => {
    if (!connected || networkOffline) return;
    const generation = nativeGeneration.current;
    const intervalMs = workflowActive ? REALTIME_ACTIVE_POLL_MS : REALTIME_IDLE_POLL_MS;
    const interval = window.setInterval(() => { void silentSync(generation); }, intervalMs);
    const onVisible = () => {
      if (!document.hidden && (!native.checkedAt || Date.now() - Date.parse(native.checkedAt) > 45_000)) {
        void silentSync(nativeGeneration.current);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [connected, networkOffline, workflowActive, workflow.run?.runId, native.checkedAt]);

  function savePending(value: Operation | null) {
    if (value) sessionStorage.setItem('office-pending', JSON.stringify(value)); else sessionStorage.removeItem('office-pending');
    setPending(value);
  }

  async function refresh() {
    if (flight.current || nativeFlight.current) return;
    const generation = ++nativeGeneration.current;
    flight.current = true; nativeFlight.current = true;
    setBusy(true); setNativePending(true); setCanRetry(false);
    let ready = false;
    try {
      try {
        const response = await fetch('/api/session', { headers: { 'x-office-client': 'local' }, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('Sesi lokal tidak tersedia.');
        const session = await response.json();
        if (generation !== nativeGeneration.current) return;
        csrf.current = session.csrf;
        const data = await request('/api/office');
        if (generation !== nativeGeneration.current) return;
        setSnapshot(data); setConnected(true); setMessage('');
        const stored = sessionStorage.getItem('office-pending');
        if (stored) {
          const operation: Operation = JSON.parse(stored);
          setPending(operation);
          const { result } = await request(`/api/office?operation=${encodeURIComponent(operation.key)}`);
          if (result) { savePending(null); setSelectedJob(result.jobId); setForm(null); setNotice('Operasi ditemukan di penyimpanan. Tidak dikirim ulang.'); }
          else { setCanRetry(true); setMessage('Operasi belum tercatat. Anda dapat mengirim ulang operasi yang sama tanpa membuat kunci baru.'); }
        }
        ready = true;
      } catch {
        if (generation !== nativeGeneration.current) return;
        setConnected(false);
        setNative(disconnectedNative('Status QoderWake belum diperbarui karena pemeriksaan koneksi gagal.'));
        setMessage('Koneksi belum terkonfirmasi. Data mungkin usang; periksa koneksi sebelum melanjutkan.');
      } finally {
        flight.current = false; setBusy(false);
      }
      if (ready && generation === nativeGeneration.current) {
        await Promise.all([refreshNative(generation), refreshWorkflow(generation)]);
      }
    } finally {
      nativeFlight.current = false;
      setNativePending(false);
    }
  }

  useEffect(() => {
    void refresh();
    const offline = () => {
      nativeGeneration.current++;
      setNetworkOffline(true);
      setConnected(false);
      setNative(current => ({ ...disconnectedNative('Offline. Snapshot QoderWake terakhir tidak ditampilkan sebagai status aktual.'), checkedAt: current.checkedAt }));
      setMessage('Offline. Data tersimpan mungkin usang; operasi baru dinonaktifkan.');
    };
    const online = () => { setNetworkOffline(false); setMessage('Jaringan kembali. Periksa koneksi untuk merekonsiliasi status.'); };
    window.addEventListener('offline', offline); window.addEventListener('online', online);
    return () => { window.removeEventListener('offline', offline); window.removeEventListener('online', online); };
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
      if (operation.action === 'submit') startProjectFlow(false);
      else if (operation.action === 'decide') finishProjectFlow();
    } catch (error) {
      if (!acknowledged && error instanceof ApiError && [400, 403, 409, 413, 415, 422].includes(error.status)) {
        savePending(null); setMessage(error.message);
        if (error.status === 403 || error.status === 409) setConnected(false);
      } else { setConnected(false); setMessage(acknowledged ? 'Perubahan diterima server, tetapi tampilan belum sinkron. Periksa koneksi sebelum mengirim ulang.' : 'Hasil operasi belum diketahui. Periksa koneksi untuk mencari hasil sebelum mengirim ulang.'); }
    } finally { flight.current = false; setBusy(false); }
  }

  async function submitNative(brief: Brief) {
    if (flight.current || nativeFlight.current) return;
    flight.current = true; setBusy(true); setMessage(''); setNotice('');
    try {
      const result = await request('/api/qoderwake/workflow', { brief, project: kopiSenjaNativeRequest.project }) as { runId: string; reused: boolean };
      setForm(null); setConnected(true);
      setSelectedRunId(result.runId);
      setNotice(result.reused ? `Run ${result.runId} sudah ada; tidak ada run baru.` : `Run ${result.runId} diterima QoderWake. Status worker dipantau otomatis.`);
      if (!result.reused) startProjectFlow(false);
      await refreshWorkflow(nativeGeneration.current, result.runId);
    } catch (error) {
      setMessage(error instanceof Error ? `${error.message} Jangan mengirim ulang sebelum status run diperiksa.` : 'Dispatch belum terkonfirmasi. Jangan mengirim ulang sebelum status run diperiksa.');
    } finally { flight.current = false; setBusy(false); }
  }

  async function actWorkflow(payload: WorkflowAction) {
    if (workflowBusy || nativeFlight.current) return;
    setWorkflowBusy(true); setMessage(''); setNotice('');
    try {
      await request('/api/qoderwake/workflow', payload);
      setNotice(
        payload.action === 'confirm' ? 'Keputusan approval gate dikirim ke QoderWake.'
          : payload.action === 'terminate' ? 'Permintaan hentikan run dikirim ke QoderWake.'
            : payload.action === 'retry' ? 'Permintaan retry run dikirim ke QoderWake.'
              : 'Permintaan interupsi sesi dikirim ke QoderWake.',
      );
      if (payload.action === 'confirm' || payload.action === 'terminate') finishProjectFlow();
      await Promise.all([
        refreshWorkflow(nativeGeneration.current, 'runId' in payload ? payload.runId : selectedRunRef.current),
        refreshNative(nativeGeneration.current),
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Aksi QoderWake belum berhasil dijalankan.');
    } finally {
      setWorkflowBusy(false);
    }
  }

  const select = (id: string) => { setSelected(id); };
  const openNewBrief = () => {
    setForm({ id: crypto.randomUUID(), kind: 'new' }); setMessage('');
    requestAnimationFrame(() => document.getElementById('work-section')?.scrollIntoView({ block: 'start' }));
  };
  const creditPercent = native.credits ? Math.min(100, Math.round((native.credits.used / Math.max(native.credits.total, 1)) * 100)) : 0;

  return <div className="app-shell">
    <a className="skip-link" href="#main">Lewati ke area kerja</a>
    <header className="topbar">
      <a className="brand" href="/" aria-label="Virtual Office beranda">
        <span className="brand-mark" aria-hidden="true"><i/><i/><i/></span>
        <span>Virtual Office<small>WEB DELIVERY STUDIO</small></span>
      </a>
      <div className="topbar-context">Professional Services Studio<span>Sinkronisasi realtime ke QoderWake.</span></div>
      <div className="topbar-actions">
        <div className="connection"><span className={connected ? 'status-dot online' : 'status-dot'}/><span>{connected ? 'Tersambung ke penyimpanan lokal' : 'Koneksi lokal belum terkonfirmasi'}</span></div>
        <button type="button" className="theme-toggle" aria-pressed={theme === 'dark'} aria-label={theme === 'dark' ? 'Aktifkan mode siang' : 'Aktifkan mode malam'} onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}>
          <RailIcon>{theme === 'dark' ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/></> : <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>}</RailIcon>
          <span>{theme === 'dark' ? 'Mode siang' : 'Mode malam'}</span>
        </button>
        <button className="connection-button" onClick={() => void refresh()} disabled={busy || nativePending}>Periksa koneksi</button>
      </div>
      <div className="founder">
        <span className="avatar" aria-hidden="true"><RailIcon><circle cx="12" cy="8" r="3"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></RailIcon></span>
        <span>Founder<small>Operator lokal</small></span>
      </div>
    </header>
    <div className="mode-banner">
      <span className={`badge ${nativeCurrent ? 'good' : 'warm'}`}>Snapshot QoderWake</span>
      <div className="snapshot-summary">
        <p>
          <strong data-testid="snapshot-status" role="status">{freshnessLabel}</strong>
          {' · '}Auto-sync realtime ({workflowActive ? '15 dtk' : '60 dtk'})
          {' · '}Pemeriksaan terakhir: {native.checkedAt ? <time data-testid="snapshot-checked" dateTime={native.checkedAt}>{nativeTime.format(new Date(native.checkedAt))}</time> : 'belum diperiksa'}
          {lastSuccess && !nativeCurrent && <> · Snapshot sukses terakhir: <time data-testid="snapshot-success" dateTime={lastSuccess}>{nativeTime.format(new Date(lastSuccess))}</time></>}
        </p>
        <p>{!nativeCurrent && 'Status Waker tidak diketahui. '}Status 8 Waker dan WakerFlow dibaca langsung via CLI QoderWake; <strong>preview lokal dan invoice draft tetap terisolasi</strong>.</p>
      </div>
      {nativeCurrent && native.credits && <div className="banner-credit-pill" title="Pemakaian kredit akun Qoder resmi">
        <span>{native.credits.used.toLocaleString('id-ID')} / {native.credits.total.toLocaleString('id-ID')} {native.credits.unit}</span>
      </div>}
    </div>
    <div className="workspace-layout">
      <nav className="icon-rail" aria-label="Navigasi kantor">
        <div className="rail-main">
          <button className={view === 'map' ? 'active' : ''} aria-label="Kantor 3D" data-tooltip="Kantor" onClick={() => setView('map')}><RailIcon><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></RailIcon></button>
          <button className={view === 'list' ? 'active' : ''} aria-label="Tim agent" data-tooltip="Tim agent" onClick={() => setView('list')}><RailIcon><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6"/></RailIcon></button>
          <button aria-label="Pekerjaan" data-tooltip="Pekerjaan" onClick={() => document.getElementById('work-section')?.scrollIntoView({ block: 'start' })}><RailIcon><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5M8 17h3"/></RailIcon></button>
          <button aria-label="Buat brief baru" data-tooltip="Brief baru" disabled={disabled} onClick={openNewBrief}><RailIcon><path d="M12 5v14M5 12h14"/></RailIcon></button>
        </div>
        <span className="rail-local">STUDIO</span>
      </nav>
      <main id="main" className="workspace-main">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">KANTOR / LANTAI UTAMA</span>
            <h1>Ruang kerja Anda</h1>
            <p>Delapan peran QoderWake, dua ruang tim, aktivitas kantor realtime.</p>
          </div>
          <div className="heading-stats">
            <div className="heading-stat"><strong>8</strong><span>Waker<br/>2 tim</span></div>
            <div className="heading-stat"><strong>4</strong><span>Aktivitas<br/>serentak</span></div>
          </div>
        </div>
        {message && <div className="notice error" role="alert">{message}{pending && canRetry && <button disabled={busy} onClick={() => void mutate(pending)}>Kirim ulang operasi yang sama</button>}</div>}
        <div className="sr-only" role="status">{notice || (busy ? 'Memeriksa penyimpanan lokal.' : '')}</div>
        {revisionConflict && form?.kind === 'revise' && <div className="notice error" role="alert"><p>Paket sudah berubah. Draf Anda tetap disimpan dan belum dikirim. Tinjau paket terbaru di bawah sebelum menerapkan draf sebagai revisi baru.</p><div className="button-row"><button disabled={disabled || !revisionJob} onClick={() => { if (revisionJob) setForm({ ...form, baseVersion: revisionJob.version }); }}>Terapkan draf ke versi terbaru</button><button disabled={disabled} onClick={() => setForm(null)}>Buang draf</button></div></div>}
        <section className="office-stage" aria-label="Virtual Office">
          <div className="map-toolbar">
            <div><span className="view-indicator" aria-hidden="true"/>KANTOR 3D REALTIME <span className="muted">/ pilih figur atau ruang</span></div>
            <div className="segmented">
              <button aria-pressed={view === 'map'} onClick={() => setView('map')}>Denah</button>
              <button aria-pressed={view === 'list'} onClick={() => setView('list')}>Daftar agent</button>
            </div>
          </div>
          {view === 'map' && <div className="map-canvas"><OfficeMap selected={selected} eligibleAgents={eligibleAgents} wakerStatuses={wakerStatuses} snapshotExpiresAt={nativeCurrent ? Date.parse(native.checkedAt) + SNAPSHOT_MAX_AGE_MS : 0} snapshotLabel={freshnessLabel} theme={theme} projectStage={projectStage} onSelect={select} onFallback={() => setSceneFailed(true)}/></div>}
          <div className={view === 'list' || sceneFailed ? 'agent-directory visible' : 'agent-directory mobile-fallback'}>
            {['development', 'delivery'].map(group => <section key={group}>
              <h3>{group === 'development' ? 'Development Room' : 'Web Delivery Room'}<span>{group === 'development' ? '5 peran' : '3 peran bisnis'}</span></h3>
              {agents.filter(item => item.group === group).map(item => <button key={item.id} aria-label={`Detail ${item.name}`} aria-pressed={selected === item.id} onClick={() => select(item.id)}>
                <span className="role-avatar" aria-hidden="true">{item.short}</span>
                <span><strong>{item.name}</strong><small>{wakerStatuses[item.id].label}</small></span>
                <span aria-hidden="true">↗</span>
              </button>)}
            </section>)}
          </div>
          <div className="room-legend">
            <span><i className="dev-swatch"/>Development · 5 peran</span>
            <span><i className="delivery-swatch"/>Web Delivery · 3 peran</span>
            <span>{`Snapshot QoderWake · ${freshnessLabel}`}</span>
          </div>
        </section>
        <section className="work-section" id="work-section" aria-label="Pekerjaan dan hasil">
          <div className="work-section-heading">
            <div><span className="eyebrow">RUANG KERJA FOUNDER</span><h2>Pekerjaan & hasil</h2><p>Brief, preview, invoice simulasi, dan riwayat eksekusi WakerFlow V13.</p></div>
            <button className="primary new-brief" disabled={disabled} onClick={openNewBrief}>Brief baru<span aria-hidden="true">＋</span></button>
          </div>
          <div className="job-list" aria-label="Daftar pekerjaan">
            {snapshot.jobs.length === 0 ? <p className="empty-small">Belum ada pekerjaan. Mulai dari brief sintetis pertama.</p>
              : snapshot.jobs.map(item => <button key={item.id} className={`job-card ${job?.id === item.id ? 'active' : ''}`} onClick={() => { setSelectedJob(item.id); setForm(null); }} disabled={busy || !!pending}>
                <span className="job-icon" aria-hidden="true">{item.brief.client.slice(0, 1).toUpperCase() || 'K'}</span>
                <span><strong>{item.brief.client}</strong><small>v{item.version} · {statusLabel[item.status]}</small></span>
              </button>)}
          </div>
          {form && <BriefForm key={form.id} initial={form.kind === 'revise' ? form.initial : undefined} busy={disabled} submitBlocked={revisionConflict} nativeSubmitBlocked={nativePending} onCancel={() => setForm(null)} onSubmit={brief => mutate({ action: 'submit', key: crypto.randomUUID(), brief, ...(form.kind === 'revise' ? { jobId: form.jobId, expectedVersion: form.baseVersion } : {}) })} onNativeSubmit={submitNative}/>}
          {(workflow.request || (workflow.recentRuns?.length ?? 0) > 0) && <section className="job-panel panel" aria-label="Run WakerFlow native">
            <div className="section-heading">
              <div><span className="eyebrow">WAKERFLOW NATIVE · V13 · TERHUBUNG QODERWAKE</span><h2>{workflow.run?.title ?? 'Web Delivery Studio — Website Delivery'}</h2></div>
              <span className={`badge ${workflow.gate === 'waiting_for_founder' || workflow.gate === 'finished' ? 'good' : 'warm'}`}>
                {workflow.gate === 'waiting_for_founder' ? 'Menunggu approval founder'
                  : workflow.gate === 'finished' ? 'Run selesai'
                    : workflow.gate === 'terminated' ? 'Dihentikan'
                      : workflow.gate === 'failed' ? 'Run gagal'
                        : workflow.gate === 'dispatch_unknown' ? 'Dispatch belum diketahui'
                          : 'Berjalan / memproses'}
              </span>
            </div>
            {(workflow.recentRuns?.length ?? 0) > 1 && <div className="workflow-runs" role="group" aria-label="Pilih riwayat run WakerFlow">
              {workflow.recentRuns!.slice(0, 5).map(item => <button key={item.runId} type="button" aria-pressed={workflow.run?.runId === item.runId} onClick={() => { setSelectedRunId(item.runId); void refreshWorkflow(nativeGeneration.current, item.runId); }}>{item.title} · {item.status}</button>)}
            </div>}
            <dl className="facts workflow-facts">
              <div><dt>Run ID</dt><dd className="mono" data-testid="workflow-run-id">{workflow.request?.runId ?? workflow.run?.runId ?? 'Belum terkonfirmasi'}</dd></div>
              <div><dt>Status QoderWake</dt><dd data-testid="workflow-status">{workflow.run?.status ?? 'Belum tersedia'}</dd></div>
              <div><dt>Fase aktual</dt><dd>{workflow.run?.currentPhase ?? 'Belum tersedia'}</dd></div>
              <div><dt>Approval founder</dt><dd>{workflow.founderApproval ? `${workflow.founderApproval.value} (${nativeTime.format(new Date(workflow.founderApproval.answeredAt))})` : workflow.pendingConfirmations.length ? `${workflow.pendingConfirmations.length} gate menunggu` : 'Belum ada'}</dd></div>
            </dl>
            <p className="scope-note">Jejak handoff dan ringkasan kerja di bawah dibaca langsung dari event WakerFlow V13 QoderWake.</p>
            {workflow.workers.length > 0 && <ol className="timeline workflow-timeline">{workflow.workers.map(worker => {
              const owner = worker.wakerId ? agents.find(item => item.wakerId === worker.wakerId) : undefined;
              return <li key={worker.sequence}><span className="timeline-dot"/><div>
                <p><strong>{worker.phase}</strong> · {worker.label}{owner ? ` (${owner.name})` : ''}</p>
                <span className="muted">{worker.status}{worker.nextOwner ? ` · handoff → ${worker.nextOwner}` : ''}{worker.issueCount ? ` · ${worker.issueCount} catatan` : ''}</span>
                {worker.summary && <p className="worker-summary">{worker.summary}</p>}
              </div></li>;
            })}</ol>}
            {workflow.finalSummary && <div className="final-summary"><strong>Ringkasan Akhir PM</strong><p>{workflow.finalSummary}</p></div>}
            <div className="button-row workflow-panel-actions">
              <button disabled={busy || nativePending || workflowBusy} onClick={() => void refreshWorkflow(nativeGeneration.current, workflow.run?.runId ?? selectedRunId)}>Periksa status run</button>
              {workflow.gate === 'waiting_for_founder' && workflow.pendingConfirmations[0] && workflow.run && <>
                <button className="primary" disabled={workflowBusy} onClick={() => void actWorkflow({ action: 'confirm', runId: workflow.run!.runId, confirmationId: workflow.pendingConfirmations[0], value: 'Setujui paket internal akhir' })}>Setujui gate native</button>
                <button disabled={workflowBusy} onClick={() => void actWorkflow({ action: 'confirm', runId: workflow.run!.runId, confirmationId: workflow.pendingConfirmations[0], value: 'Tahan paket untuk revisi' })}>Tahan gate native</button>
              </>}
              {workflowActive && workflow.run && <button disabled={workflowBusy} onClick={() => void actWorkflow({ action: 'terminate', runId: workflow.run!.runId })}>Hentikan run native</button>}
              {workflow.run && ['terminated', 'failed'].includes(workflow.run.status) && <button disabled={workflowBusy} onClick={() => void actWorkflow({ action: 'retry', runId: workflow.run!.runId })}>Lanjut / Retry run</button>}
            </div>
          </section>}
          {job ? <JobPanel key={`${job.id}-${job.version}`} job={job} disabled={disabled} onReplayFlow={() => startProjectFlow(true)} onRevise={() => setForm({ id: crypto.randomUUID(), kind: 'revise', jobId: job.id, baseVersion: job.version, initial: job.brief })} onDecide={decision => void mutate({ action: 'decide', key: crypto.randomUUID(), jobId: job.id, version: job.version, decision })}/>
            : <section className="empty-job panel"><span className="eyebrow">DARI BRIEF KE HASIL</span><h2>Mulai dari satu kebutuhan klien.</h2><p>Buat brief Kopi Senja untuk meninjau preview satu halaman, invoice simulasi, dan jejak validasi lokal.</p><div className="empty-pipeline"><span>Intake</span><span aria-hidden="true">→</span><span>Delivery</span><span aria-hidden="true">→</span><span>Billing</span></div></section>}
        </section>
      </main>
      <aside className="inspector" aria-label="Detail agent">
        {agent ? <>
          <div className="inspector-topline"><span className="eyebrow">PROFIL AGENT</span><span className="badge">{agent.group === 'development' ? 'Development' : 'Web Delivery'}</span></div>
          <AgentPortrait id={agent.id} theme={theme}/>
          <h2>{agent.name}</h2>
          <span className={`native-status ${nativeWaker ? 'current' : ''}`} data-testid="native-status">{agentNativeStatus}</span>
          <p className="agent-role">{agent.role}</p>
          <div className="inspector-section">
            <h3>Status pekerjaan</h3>
            {nativeWaker ? <>
              <dl className="facts">
                <div><dt>Waker</dt><dd>{nativeWaker.status} · {nativeWaker.executionLocation}</dd></div>
                <div><dt>Sesi / tugas pada profil</dt><dd>{nativeWaker.sessionCount} / {nativeTasks.length || nativeWaker.taskCount}</dd></div>
                <div><dt>Koneksi mesin</dt><dd>{nativeWaker.onlineStatus ?? 'Tidak diketahui'} / {nativeWaker.connectionStatus ?? 'Tidak diketahui'}</dd></div>
                <div><dt>Handoff WakerFlow</dt><dd>{workflow.workers.some(w => w.wakerId === agent.wakerId) ? 'Terlibat pada run V13' : 'Menunggu run / tidak ada di fase ini'}</dd></div>
              </dl>
              <h3 className="native-subheading">Tugas Task Board</h3>
              {nativeTasks.length ? <ul className="native-records">{nativeTasks.slice(0, 5).map(task => <li key={task.id}><strong>{task.title}</strong><span>{task.status} · {task.sourceName}</span><time dateTime={task.lastActiveAt}>{nativeTime.format(new Date(task.lastActiveAt))}</time></li>)}</ul> : <p className="native-empty">Tidak ada tugas untuk Waker ini dalam cuplikan Task Board yang diterima.</p>}
            </> : <dl className="facts"><div><dt>Tugas native</dt><dd>{nativeCurrent ? 'ID sumber tidak memiliki kecocokan Waker yang unik' : 'Belum ada data'}</dd></div><div><dt>Progres / tahap</dt><dd>Tidak diketahui</dd></div><div><dt>Handoff native</dt><dd>Belum terverifikasi</dd></div></dl>}
          </div>
          {nativeStep && <div className="local-step"><h3>Pemrosesan lokal terkait</h3><p>{nativeStep.summary}</p><small>{nativeStep.status === 'completed' ? 'Selesai' : 'Gagal'} · selanjutnya: {nativeStep.nextOwner}</small><p className="muted">Bukan tugas atau hasil eksekusi Waker.</p></div>}
          <div className="activity-empty">
            <h3>Aktivitas sesi QoderWake</h3>
            {nativeActivities.length ? <ul className="native-records">{nativeActivities.slice(0, 6).map(activity => <li key={activity.id}><strong>{activity.title}</strong><span>{activity.status}{activity.source ? ` · ${activity.source}` : ''}</span><time dateTime={activity.lastActiveAt}>{nativeTime.format(new Date(activity.lastActiveAt))}</time></li>)}</ul> : <p>{nativeCurrent ? nativeWaker ? 'Tidak ada metadata sesi untuk Waker ini pada snapshot. Isi percakapan tidak dibaca.' : 'Aktivitas tidak dapat dipetakan tanpa kecocokan ID Waker yang unik.' : 'Belum tersedia dari QoderWake. Tidak ada aktivitas atau percakapan yang direkayasa.'}</p>}
          </div>
        </> : room ? <><div className="inspector-topline"><span className="eyebrow">RUANG TIM</span><span className="badge">{room.group === 'development' ? '5 peran' : '3 peran'}</span></div><div className={`room-portrait ${room.group}`} aria-hidden="true"><RailIcon><path d="m12 3 9 5v10l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5M12 13v10M8 10.5v4M16 10.5v4"/></RailIcon></div><h2>{room.name}</h2><p>{room.description}</p><span className="native-status">Model ruang 3D</span><div className="inspector-section"><h3>Peran dalam ruangan</h3><div className="room-agent-list">{agents.filter(item => item.group === room.group).map(item => <button key={item.id} onClick={() => select(item.id)}>{item.name}<span aria-hidden="true">→</span></button>)}</div></div></>
          : <><div className="inspector-topline"><span className="eyebrow">FASILITAS BERSAMA</span><span className="badge">Area visual</span></div><div className="facility-portrait" aria-hidden="true"><RailIcon><path d="M3 21V8l9-5 9 5v13M7 21v-8h10v8M8 8h.01M12 8h.01M16 8h.01"/></RailIcon></div><h2>{facility?.name}</h2><p>{facility?.description}</p><span className="native-status">Area visual saja</span><p className="facility-note">Fasilitas mendukung aktivitas kantor realtime: ngobrol dan diskusi di ruang rapat, pantry, sudut fokus, dan lounge konsol.</p></>}
        <div className="integration-note" data-testid="qoderwake-connection">
          <h3>Snapshot QoderWake</h3>
          <p><strong>{freshnessLabel}{nativeCurrent ? ` · CLI ${native.version}` : ''}</strong></p>
          <p>{nativeCurrent ? `${native.wakers.length} Waker terbaca (terintegrasi via stable wakerId). Sinkronisasi otomatis menjaga status tetap mutakhir.` : checkingNative ? 'Pemeriksaan sedang berjalan. Penyimpanan lokal dan brief lokal tetap dapat digunakan.' : freshness === 'stale' ? 'Periksa koneksi untuk memperbarui snapshot. Data lama disembunyikan; Waker tidak dianggap idle atau bekerja.' : native.message ?? 'Menunggu pemeriksaan status QoderWake.'}</p>
          {nativeCurrent && native.board && <div className="native-board">
            <h3>Task Board global</h3>
            <p>Waktu sumber: <time dateTime={native.board.generatedAt}>{nativeTime.format(new Date(native.board.generatedAt))}</time>. Cuplikan {native.tasks.length} dari {native.board.total} tugas.</p>
            <p>{native.board.total} tugas · {native.board.byStatus.running} berjalan · {native.board.byStatus.done} selesai · {native.board.byStatus.failed} gagal.</p>
            <p>Perlu perhatian: {native.board.attention.approval} approval · {native.board.attention.acceptance} acceptance.</p>
            {otherNativeTasks.length > 0 && <ul className="native-records">{otherNativeTasks.slice(0, 6).map(task => <li key={task.id}><strong>{task.title}</strong><span>{task.assigneeId === '0cd6b35e21a1' ? 'Waker Assistant (sistem)' : task.assigneeName ?? task.sourceName} · {task.status}</span><time dateTime={task.lastActiveAt}>{nativeTime.format(new Date(task.lastActiveAt))}</time></li>)}</ul>}
          </div>}
          <dl className="control-list">
            <div><dt>Approval gate</dt><dd>{workflow.pendingConfirmations.length > 0 ? 'Menunggu keputusan' : workflow.founderApproval ? 'Tercatat pada V13' : 'Siaga via WakerFlow'}</dd></div>
            <div><dt>Kontrol run</dt><dd>{workflowActive ? 'Aktif (Stop tersedia)' : workflow.run ? 'Siap (Retry tersedia)' : 'Siaga via CLI'}</dd></div>
            <div><dt>Interupsi sesi</dt><dd>{runningSession ? <button type="button" className="control-button" disabled={workflowBusy} onClick={() => void actWorkflow({ action: 'interrupt_session', sessionId: runningSession.id })}>Interupsi sesi aktif</button> : 'Siaga (0 sesi running)'}</dd></div>
          </dl>
          <p className="muted">Panel WakerFlow terhubung dua arah ke CLI QoderWake untuk menjalankan V13, menyetujui/menahan gate, menghentikan atau retry run aktif, dan menginterupsi sesi running.</p>
        </div>
        <div className="credit-note" data-testid="qoder-credits">
          <span className="eyebrow">KREDIT QODER</span>
          {nativeCurrent && native.credits ? <>
            <p><strong>{native.credits.used.toLocaleString('id-ID')} / {native.credits.total.toLocaleString('id-ID')} {native.credits.unit} terpakai ({creditPercent}%)</strong></p>
            <div className="credit-meter" aria-hidden="true"><span className="credit-meter-fill" style={{ width: `${creditPercent}%` }}/></div>
            <small>Sisa {native.credits.remaining.toLocaleString('id-ID')} {native.credits.unit} · sumber resmi: qoderwake account usage.</small>
          </> : <>
            <p>Belum terbaca dari CLI QoderWake.</p>
            <small>Klik Periksa koneksi untuk membaca kuota resmi akun Qoder.</small>
          </>}
        </div>
      </aside>
    </div>
    <footer className="app-footer"><span>VIRTUAL OFFICE · WEB DELIVERY STUDIO</span><span>Integrasi QoderWake Realtime · Preview & Invoice Terisolasi</span></footer>
  </div>;
}
