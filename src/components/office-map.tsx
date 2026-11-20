'use client';
import { useEffect, useRef, useState } from 'react';
import { facilities } from '@/lib/agents';
import { OfficeScene, type OfficeSceneHandle } from './office-scene';

const areas = ['development', 'delivery', ...facilities.map(facility => facility.id)];
export function OfficeMap({ selected, eligibleAgents, snapshotExpiresAt, snapshotLabel, onSelect, onFallback }: {
  selected: string; eligibleAgents: readonly string[]; snapshotExpiresAt: number; snapshotLabel: string;
  onSelect: (id: string) => void; onFallback: () => void;
}) {
  const scene = useRef<OfficeSceneHandle>(null);
  const [zoom, setZoom] = useState(100);
  const [topView, setTopView] = useState(false);
  const [failed, setFailed] = useState(false);
  const [motionRunning, setMotionRunning] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [stopped, setStopped] = useState(true);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  const fit = () => { setTopView(false); scene.current?.fit(); };
  const focus = (id: string) => { setTopView(false); onSelect(id); scene.current?.focus(id); };
  const unavailable = () => { setFailed(true); onFallback(); };
  const motionUnavailable = failed || reducedMotion || blocked || eligibleAgents.length === 0;
  const motionHint = reducedMotion ? 'Preferensi kurangi gerak aktif.'
    : snapshotExpiresAt <= Date.now() ? `${snapshotLabel}; simulasi kantor lokal · ${activity ?? 'aktivitas bergantian'}. Status Waker tidak diketahui.`
    : blocked ? 'Figur dibekukan: statusnya berubah. Menunggu snapshot yang mengizinkan simulasi.'
    : eligibleAgents.length === 0 ? 'Tidak ada Waker yang terkonfirmasi tanpa task aktif.'
    : motionRunning ? activity ?? 'Bergantian menggunakan fasilitas.' : stopped ? 'Dihentikan. Pilih Lanjut untuk animasi lokal.' : 'Dijeda; posisi figur dipertahankan.';
  return <div className="office-3d">
    <div className="scene-view-meta">
      <div className="scene-view-badges">
        <span className="render-badge"><i aria-hidden="true"/>Model 3D orisinal</span>
        <span className="demo-motion-badge"><strong>Simulasi kantor</strong><small>Bukan aktivitas Waker sebenarnya</small></span>
      </div>
      <label className="area-picker"><span aria-hidden="true">⌖</span><select aria-label="Pilih area kantor" value={areas.includes(selected) ? selected : ''} disabled={failed} onChange={event => { if (event.target.value) focus(event.target.value); }}>
        <option value="">Fokus area…</option><option value="development">Development Room</option><option value="delivery">Web Delivery Room</option>
        {facilities.map(facility => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
      </select></label>
    </div>
    <OfficeScene ref={scene} selected={selected} eligibleAgents={eligibleAgents} snapshotExpiresAt={snapshotExpiresAt} onSelect={onSelect} onZoomChange={setZoom} onFallback={unavailable} onMotionChange={setMotionRunning} onActivityChange={(next, held) => { setActivity(next); setBlocked(held); }}/>
    <div className="scene-room-switch" role="group" aria-label="Fokus ruang tim">
      <button aria-label="Fokus Development Room" disabled={failed} onClick={() => focus('development')}>Development <span>5</span></button>
      <button aria-label="Fokus Web Delivery Room" disabled={failed} onClick={() => focus('delivery')}>Web Delivery <span>3</span></button>
      <button disabled={failed} onClick={() => { fit(); onSelect('pm'); }}>Seluruh kantor</button>
    </div>
    <div className="scene-bottom-bar">
      <div className="simulation-controls">
        <div className="simulation-buttons" role="group" aria-label="Animasi lokal saja, bukan kontrol QoderWake">
          <button aria-label={motionRunning ? 'Jeda simulasi kantor' : 'Lanjutkan simulasi kantor'} aria-pressed={motionRunning} disabled={!motionRunning && motionUnavailable} onClick={() => { setStopped(false); if (motionRunning) scene.current?.stopMotion(); else scene.current?.startMotion(); }}>{motionRunning ? 'Jeda' : 'Lanjut'}<span>simulasi</span></button>
          <button aria-label="Hentikan semua gerakan simulasi" disabled={failed} onClick={() => { scene.current?.stopMotion(); setStopped(true); }}>Hentikan semua</button>
        </div>
        <span className="simulation-hint" data-testid="simulation-hint" role="status">{motionHint}</span>
        <small>Hanya animasi lokal · tidak mengendalikan QoderWake</small>
      </div>
      <div className="scene-controls" role="group" aria-label="Kontrol tampilan kantor">
        <button aria-label="Perkecil tampilan" title="Perkecil" disabled={failed} onClick={() => scene.current?.zoomOut()}>−</button>
        <span className="scene-zoom" data-testid="scene-zoom" aria-label="Zoom kantor">{zoom}%</span>
        <button aria-label="Perbesar tampilan" title="Perbesar" disabled={failed} onClick={() => scene.current?.zoomIn()}>＋</button>
        <span className="control-divider" aria-hidden="true"/>
        <button aria-label="Sesuaikan kantor" title="Sesuaikan kantor" disabled={failed} onClick={fit}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4"/></svg><span>Fit</span></button>
        <button className="scene-view-toggle" aria-label={topView ? 'Tampilan isometrik' : 'Tampak atas'} aria-pressed={topView} title={topView ? 'Tampilan isometrik' : 'Tampak atas'} disabled={failed} onClick={() => { const next = !topView; setTopView(next); scene.current?.setTopView(next); }}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2 7 4-7 4-7-4 7-4Zm-7 8 7 4 7-4M3 14l7 4 7-4"/></svg><span>{topView ? 'Isometrik' : 'Atas'}</span></button>
      </div>
    </div>
  </div>;
}
