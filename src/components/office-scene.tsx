'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  AmbientLight, Box3, Color, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  OrthographicCamera, PCFShadowMap, PointLight, Raycaster, RingGeometry, Scene, SRGBColorSpace,
  Vector2, Vector3, WebGLRenderer, ACESFilmicToneMapping,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { agents } from '@/lib/agents';
import type { WakerDisplayStatus } from '@/lib/qoderwake';
import { createOfficeModel, disposeOfficeModel } from '@/lib/office-model';
import { createOfficeMotion, type ProjectStage } from '@/lib/office-motion';

export type OfficeSceneHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  focus: (id: string) => void;
  setTopView: (enabled: boolean) => void;
  startMotion: () => void;
  stopMotion: () => void;
};
type Props = {
  selected: string;
  eligibleAgents: readonly string[];
  wakerStatuses: Readonly<Record<string, WakerDisplayStatus>>;
  wakerNames?: Readonly<Record<string, string>>;
  snapshotExpiresAt: number;
  theme?: 'light' | 'dark';
  projectStage?: ProjectStage | null;
  onActivityChange: (activity: string | null, blocked: boolean) => void;
  onSelect: (id: string) => void;
  onZoomChange: (zoom: number) => void;
  onFallback: () => void;
  onMotionChange: (running: boolean) => void;
};
const isoOffset = new Vector3(25, 27, 31);
const defaultTarget = new Vector3(0, .85, 0);
const roomAnchors = { development: new Vector3(-5.8, 3.6, -9.35), delivery: new Vector3(5.4, 3.6, -9.35) };

export const OfficeScene = forwardRef<OfficeSceneHandle, Props>(function OfficeScene({ selected, eligibleAgents, wakerStatuses, wakerNames, snapshotExpiresAt, theme = 'light', projectStage = null, onActivityChange, onSelect, onZoomChange, onFallback, onMotionChange }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const hotspotRefs = useRef(new Map<string, HTMLButtonElement>());
  const roomLabelRefs = useRef(new Map<string, HTMLDivElement>());
  const operations = useRef<Partial<OfficeSceneHandle>>({});
  const renderScene = useRef<() => void>(() => {});
  const callbacks = useRef({ onSelect, onZoomChange, onFallback, onMotionChange, onActivityChange });
  callbacks.current = { onSelect, onZoomChange, onFallback, onMotionChange, onActivityChange };
  const motionPolicy = useRef({ eligibleAgents, snapshotExpiresAt, projectStage });
  motionPolicy.current = { eligibleAgents, snapshotExpiresAt, projectStage };
  const syncMotionPolicy = useRef<() => void>(() => {});
  const applyThemeRef = useRef<(mode: 'light' | 'dark') => void>(() => {});
  const applyProjectStageRef = useRef<(stage: ProjectStage | null) => void>(() => {});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [motionRunning, setMotionRunning] = useState(false);

  useImperativeHandle(ref, () => ({
    zoomIn: () => operations.current.zoomIn?.(),
    zoomOut: () => operations.current.zoomOut?.(),
    fit: () => operations.current.fit?.(),
    focus: id => operations.current.focus?.(id),
    setTopView: enabled => operations.current.setTopView?.(enabled),
    startMotion: () => operations.current.startMotion?.(),
    stopMotion: () => operations.current.stopMotion?.(),
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      setFailed(true);
      callbacks.current.onFallback();
      return;
    }
    canvas.setAttribute('data-engine', 'three.js');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;

    const scene = new Scene();
    scene.background = new Color('#eef1f5');
    const model = createOfficeModel();
    const motion = createOfficeMotion(model);
    scene.add(model.root);
    const ambient = new AmbientLight('#ffffff', .42);
    scene.add(ambient);
    const hemisphere = new HemisphereLight('#f8fafc', '#cbd5e1', .62);
    scene.add(hemisphere);
    const daylight = new DirectionalLight('#fff8eb', 2.35);
    daylight.position.set(-13, 24, 16);
    daylight.castShadow = true;
    daylight.shadow.mapSize.set(1024, 1024);
    daylight.shadow.camera.left = -18;
    daylight.shadow.camera.right = 18;
    daylight.shadow.camera.top = 18;
    daylight.shadow.camera.bottom = -18;
    daylight.shadow.camera.near = 1;
    daylight.shadow.camera.far = 60;
    daylight.shadow.bias = -.00025;
    daylight.shadow.normalBias = .035;
    scene.add(daylight);
    const interiorLights = [
      [-7, 2.35, -4], [6.3, 2.35, -4], [-4.2, 2.35, 5.4], [5.7, 2.35, 5.3], [3.9, 1.85, 7.55],
    ].map(([lx, ly, lz]) => {
      const pointLight = new PointLight('#ffcb7d', 0, 15, 1.6);
      pointLight.position.set(lx, ly, lz);
      scene.add(pointLight);
      return pointLight;
    });
    const screenMaterials = new Set<MeshStandardMaterial>();
    const lampMaterials = new Set<MeshStandardMaterial>();
    const windowMaterials = new Set<MeshStandardMaterial>();
    model.root.traverse(obj => {
      if (!(obj instanceof Mesh) || !(obj.material instanceof MeshStandardMaterial)) return;
      if (['screen', 'second-screen', 'laptop-screen', 'tv-screen'].includes(obj.name)) screenMaterials.add(obj.material);
      else if (['pendant-glow', 'lamp-shade'].includes(obj.name)) lampMaterials.add(obj.material);
      else if (obj.name === 'window') windowMaterials.add(obj.material);
    });

    const aspect = Math.max(container.clientWidth / Math.max(container.clientHeight, 1), .5);
    const frustum = Math.max(24.0, 31.5 / aspect);
    const camera = new OrthographicCamera(-frustum * aspect / 2, frustum * aspect / 2, frustum / 2, -frustum / 2, .1, 140);
    camera.position.copy(isoOffset).add(defaultTarget);
    camera.lookAt(defaultTarget);
    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(defaultTarget);
    controls.enableDamping = false;
    controls.rotateSpeed = .55;
    controls.zoomSpeed = .75;
    controls.panSpeed = .65;
    controls.minZoom = .65;
    controls.maxZoom = 2.75;
    controls.minPolarAngle = .015;
    controls.maxPolarAngle = Math.PI / 2.25;
    controls.update();

    const selection = new Mesh(new RingGeometry(.52, .64, 40), new MeshBasicMaterial({ color: '#0f766e', transparent: true, opacity: .9, depthWrite: false }));
    selection.rotation.x = -Math.PI / 2;
    selection.position.y = .105;
    selection.visible = false;
    scene.add(selection);

    const project = (anchor: Vector3, element: HTMLElement, lift = 0) => {
      const point = anchor.clone().project(camera);
      const x = (point.x * .5 + .5) * container.clientWidth;
      const y = (-point.y * .5 + .5) * container.clientHeight - lift;
      element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
      element.style.visibility = point.z > -1 && point.z < 1 && x > 5 && x < container.clientWidth - 5 && y > 5 && y < container.clientHeight + 30 ? 'visible' : 'hidden';
    };
    const render = () => {
      const selectedAnchor = model.agentAnchors.get(selectedRef.current);
      selection.visible = Boolean(selectedAnchor);
      if (selectedAnchor) selection.position.set(selectedAnchor.x, .105, selectedAnchor.z);
      renderer.render(scene, camera);
      for (const agent of agents) {
        const element = hotspotRefs.current.get(agent.id);
        const anchor = model.agentAnchors.get(agent.id);
        if (element && anchor) project(anchor, element, 5);
      }
      for (const [id, anchor] of Object.entries(roomAnchors)) {
        const element = roomLabelRefs.current.get(id);
        if (element) project(anchor, element);
      }
      callbacks.current.onZoomChange(Math.round(camera.zoom * 100));
    };
    renderScene.current = render;
    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      const nextAspect = width / height;
      const nextFrustum = Math.max(24.0, 31.5 / nextAspect);
      camera.left = -nextFrustum * nextAspect / 2;
      camera.right = nextFrustum * nextAspect / 2;
      camera.top = nextFrustum / 2;
      camera.bottom = -nextFrustum / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    controls.addEventListener('change', render);

    const raycaster = new Raycaster();
    const pointer = new Vector2();
    let pointerStart = { x: 0, y: 0 };
    const onPointerDown = (event: PointerEvent) => { pointerStart = { x: event.clientX, y: event.clientY }; };
    const onPointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
      const bounds = canvas.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(model.pickTargets, true)[0];
      if (!hit) return;
      let object = hit.object;
      while (object && !object.userData.pickId) object = object.parent!;
      if (object?.userData.pickId) callbacks.current.onSelect(object.userData.pickId);
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);

    const setZoom = (value: number) => {
      camera.zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, value));
      camera.updateProjectionMatrix();
      controls.update();
      render();
    };
    const fit = () => {
      controls.target.copy(defaultTarget);
      camera.position.copy(isoOffset).add(controls.target);
      camera.up.set(0, 1, 0);
      camera.lookAt(controls.target);
      setZoom(1);
    };
    let animationFrame = 0;
    let lastFrameTime = 0;
    let reportedMotion = false;
    let reportedActivity: string | null = null;
    let reportedBlocked = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const frameInterval = 1000 / 30;
    const reportMotion = () => {
      if (reportedMotion !== motion.running) {
        reportedMotion = motion.running;
        setMotionRunning(motion.running);
        callbacks.current.onMotionChange(motion.running);
      }
      if (reportedActivity !== motion.activity || reportedBlocked !== motion.blocked) {
        reportedActivity = motion.activity;
        reportedBlocked = motion.blocked;
        callbacks.current.onActivityChange(motion.activity, motion.blocked);
      }
    };
    const stopMotion = () => {
      motion.stop();
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastFrameTime = 0;
      reportMotion();
      render();
    };
    const tick = (time: number) => {
      if (reducedMotion.matches || document.hidden) {
        syncPolicy();
        return;
      }
      if (!motion.running) { animationFrame = 0; reportMotion(); return; }
      if (time - lastFrameTime >= frameInterval) {
        const delta = lastFrameTime === 0 ? 1 / 30 : (time - lastFrameTime) / 1000;
        lastFrameTime = time;
        if (motion.update(delta)) render();
        reportMotion();
      }
      animationFrame = motion.running ? requestAnimationFrame(tick) : 0;
    };
    const startMotion = () => {
      motion.setEligibleAgents(motionPolicy.current.eligibleAgents);
      if (motion.running || reducedMotion.matches || document.hidden) return;
      motion.start();
      reportMotion();
      render();
      if (!motion.running) return;
      lastFrameTime = 0;
      animationFrame = requestAnimationFrame(tick);
    };
    const syncPolicy = () => {
      motion.setEligibleAgents(motionPolicy.current.eligibleAgents);
      if (reducedMotion.matches || document.hidden) stopMotion();
      else if (!motion.running && (motionPolicy.current.eligibleAgents.length > 0 || motionPolicy.current.projectStage !== null)) startMotion();
      else reportMotion();
    };
    applyThemeRef.current = mode => {
      const dark = mode === 'dark';
      scene.background = new Color(dark ? '#0d121a' : '#eef1f5');
      ambient.color.set(dark ? '#7c96c2' : '#ffffff');
      ambient.intensity = dark ? .24 : .42;
      hemisphere.color.set(dark ? '#3b4e73' : '#f8fafc');
      hemisphere.groundColor.set(dark ? '#11161f' : '#cbd5e1');
      hemisphere.intensity = dark ? .35 : .62;
      daylight.color.set(dark ? '#8db4ff' : '#fff8eb');
      daylight.intensity = dark ? .52 : 2.35;
      renderer.toneMappingExposure = dark ? 1.12 : 1;
      for (const light of interiorLights) light.intensity = dark ? 5.2 : 0;
      for (const mat of screenMaterials) {
        mat.emissive.set(dark ? '#2dd4bf' : '#315c4b');
        mat.emissiveIntensity = dark ? .92 : .35;
      }
      for (const mat of lampMaterials) {
        mat.emissive.set('#ffd283');
        mat.emissiveIntensity = dark ? 1.85 : .35;
      }
      for (const mat of windowMaterials) {
        mat.color.set(dark ? '#172538' : '#9dbfba');
        mat.emissive.set(dark ? '#1e3a5f' : '#000000');
        mat.emissiveIntensity = dark ? .45 : 0;
      }
      (selection.material as MeshBasicMaterial).color.set(dark ? '#2dd4bf' : '#0f766e');
      render();
    };
    applyProjectStageRef.current = stage => {
      motion.setProjectStage(stage);
      syncPolicy();
    };
    syncMotionPolicy.current = syncPolicy;
    applyThemeRef.current(theme);
    applyProjectStageRef.current(projectStage);
    reducedMotion.addEventListener('change', syncPolicy);
    document.addEventListener('visibilitychange', syncPolicy);
    syncPolicy();
    operations.current = {
      zoomIn: () => setZoom(camera.zoom * 1.2),
      zoomOut: () => setZoom(camera.zoom / 1.2),
      fit,
      focus: id => {
        const target = model.pickTargets.find(item => item.userData.pickId === id);
        if (!target) return;
        const center = new Box3().setFromObject(target).getCenter(new Vector3());
        center.y = .5;
        controls.target.copy(center);
        camera.position.copy(center).add(isoOffset);
        camera.lookAt(center);
        setZoom(id === 'development' || id === 'delivery' ? 1.5 : 2.05);
      },
      setTopView: enabled => {
        if (!enabled) { fit(); return; }
        controls.target.set(0, 0, 0);
        camera.position.set(0, 48, .8);
        camera.lookAt(controls.target);
        setZoom(1);
      },
      startMotion,
      stopMotion,
    };
    resize();
    setReady(true);
    startMotion();

    return () => {
      motion.stop();
      if (animationFrame) cancelAnimationFrame(animationFrame);
      reducedMotion.removeEventListener('change', syncPolicy);
      document.removeEventListener('visibilitychange', syncPolicy);
      syncMotionPolicy.current = () => {};
      applyThemeRef.current = () => {};
      applyProjectStageRef.current = () => {};
      observer.disconnect();
      controls.removeEventListener('change', render);
      controls.dispose();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      selection.geometry.dispose();
      (selection.material as MeshBasicMaterial).dispose();
      disposeOfficeModel(model);
      daylight.shadow.dispose();
      operations.current = {};
      renderScene.current = () => {};
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    renderScene.current();
  }, [selected, ready]);
  const eligibleKey = eligibleAgents.join(',');
  useEffect(() => { syncMotionPolicy.current(); }, [eligibleKey, snapshotExpiresAt, ready]);
  useEffect(() => { if (ready) applyThemeRef.current(theme); }, [theme, ready]);
  useEffect(() => { if (ready) applyProjectStageRef.current(projectStage); }, [projectStage, ready]);

  return <div className={`scene-viewport ${ready ? 'is-ready' : ''}`} ref={containerRef}>
    <canvas ref={canvasRef} className="office-canvas" data-engine="three.js" data-scene-ready={ready ? 'true' : 'false'} data-motion-running={motionRunning ? 'true' : 'false'} role="img" aria-label="Kantor isometrik 3D dengan delapan figur, dua ruang tim, dan fasilitas bersama"/>
    {!ready && !failed && <div className="scene-loading" role="status">Menyiapkan model 3D…</div>}
    {failed && <div className="scene-fallback" role="status"><strong>Tampilan 3D tidak tersedia. Gunakan daftar agent untuk memilih peran.</strong><span>Semua pekerjaan dan detail agent tetap dapat digunakan.</span></div>}
    <div className="scene-room-labels" aria-hidden="true">
      <div ref={node => { if (node) roomLabelRefs.current.set('development', node); else roomLabelRefs.current.delete('development'); }}><strong>Development Room</strong><span>5 peran</span></div>
      <div ref={node => { if (node) roomLabelRefs.current.set('delivery', node); else roomLabelRefs.current.delete('delivery'); }}><strong>Web Delivery Room</strong><span>3 peran</span></div>
    </div>
    <div className="scene-hotspots" role="group" aria-label="Pilih figur agent">
      {agents.map(agent => {
        const status = wakerStatuses[agent.id];
        return <button key={agent.id} ref={node => { if (node) hotspotRefs.current.set(agent.id, node); else hotspotRefs.current.delete(agent.id); }} className="agent-hotspot" aria-label={`Pilih ${agent.name}`} aria-description={status.label} aria-pressed={selected === agent.id} data-waker-id={agent.wakerId} data-waker-status={status.kind} title={status.label} onClick={() => onSelect(agent.id)}>
          <span className="hotspot-name" aria-hidden="true"><i className={`name-dot native-${status.kind}`}/>{wakerNames?.[agent.id] ?? agent.short}</span><span className={`hotspot-point native-${status.kind}`} aria-hidden="true"/><span className="hotspot-label">{agent.name}<small>{status.label}</small></span>
        </button>;
      })}
    </div>
  </div>;
});
