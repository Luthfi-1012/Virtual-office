'use client';
import { useEffect, useRef, useState } from 'react';
import { facilities } from '@/lib/agents';
import type { WakerDisplayStatus } from '@/lib/qoderwake';
import type { ProjectStage } from '@/lib/office-motion';
import { OfficeScene, type OfficeSceneHandle } from './office-scene';

const areas = ['development', 'delivery', ...facilities.map(facility => facility.id)];

export function OfficeMap({ selected, eligibleAgents, wakerStatuses, snapshotExpiresAt, snapshotLabel, theme, projectStage, onSelect, onFallback }: {
  selected: string; eligibleAgents: readonly string[]; wakerStatuses: Readonly<Record<string, WakerDisplayStatus>>; snapshotExpiresAt: number; snapshotLabel: string;
  theme: 'light' | 'dark'; projectStage: ProjectStage | null;
  onSelect: (id: string) => void; onFallback: () => void;
}) {
  const scene = useRef<OfficeSceneHandle>(null);
  const [zoom, setZoom] = useState(100);
  const [topView, setTopView] = useState(false);
  const [failed, setFailed] = useState(false);
  const [motionRunning, setMotionRunning] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(true);

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

  const liveLabel = reducedMotion
    ? 'Preferensi kurangi gerak aktif.'
    : projectStage
      ? projectStage.label
      : eligibleAgents.length === 0 && !motionRunning
        ? 'Seluruh agent aktif mengerjakan tugas QoderWake.'
        : snapshotExpiresAt <= Date.now()
          ? `${snapshotLabel} · ${activity ?? 'aktivitas realtime berjalan'}`
          : motionRunning
            ? activity ?? 'Menyiapkan aktivitas kantor realtime…'
            : 'Kantor siap dalam mode realtime.';

  return <div className="office-3d">
    <div className="scene-view-meta">
      <div className="scene-room-switch" role="group" aria-label="Fokus ruang tim">
        <button aria-label="Fokus Development Room" aria-pressed={selected === 'development'} disabled={failed} onClick={() => focus('development')}>Development <span>5</span></button>
        <button aria-label="Fokus Web Delivery Room" aria-pressed={selected === 'delivery'} disabled={failed} onClick={() => focus('delivery')}>Web Delivery <span>3</span></button>
        <button aria-pressed={!areas.includes(selected) || selected === 'pm'} disabled={failed} onClick={() => { fit(); onSelect('pm'); }}>Seluruh kantor</button>
      </div>
      <label className="area-picker" htmlFor="office-area-select"><span aria-hidden="true">⌖</span><select id="office-area-select" name="officeArea" aria-label="Pilih area kantor" value={areas.includes(selected) ? selected : ''} disabled={failed} onChange={event => { if (event.target.value) focus(event.target.value); }}>
        <option value="">Fokus area…</option><option value="development">Development Room</option><option value="delivery">Web Delivery Room</option>
        {facilities.map(facility => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
      </select></label>
    </div>
    <OfficeScene ref={scene} selected={selected} eligibleAgents={eligibleAgents} wakerStatuses={wakerStatuses} snapshotExpiresAt={snapshotExpiresAt} theme={theme} projectStage={projectStage} onSelect={onSelect} onZoomChange={setZoom} onFallback={unavailable} onMotionChange={setMotionRunning} onActivityChange={next => { setActivity(next); }}/>
    <div className="scene-bottom-bar">
      <div className={`live-activity-pill ${projectStage ? 'is-project' : ''}`} data-testid="live-activity" role="status">
        <span className={motionRunning ? 'live-dot active' : 'live-dot'} aria-hidden="true"/>
        <span>{liveLabel}</span>
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
