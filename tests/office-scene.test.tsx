// @vitest-environment jsdom
import { StrictMode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfficeScene } from '@/components/office-scene';
import { agents } from '@/lib/agents';

const lifecycle = vi.hoisted(() => ({
  maps: [] as import('three').WebGLRenderTarget[],
  mapDisposals: 0,
  depthDisposals: 0,
}));

vi.mock('three', async () => {
  const three = await vi.importActual<typeof import('three')>('three');
  return {
    ...three,
    WebGLRenderer: class {
      shadowMap = {};
      setPixelRatio() {}
      setSize() {}
      render(scene: import('three').Scene) {
        scene.traverse(object => {
          if (!(object instanceof three.DirectionalLight) || !object.castShadow || object.shadow.map) return;
          const map = new three.WebGLRenderTarget(16, 16);
          map.depthTexture = new three.DepthTexture(16, 16);
          map.addEventListener('dispose', () => {
            lifecycle.mapDisposals++;
            map.depthTexture?.dispose();
          });
          map.depthTexture.addEventListener('dispose', () => lifecycle.depthDisposals++);
          object.shadow.map = map;
          lifecycle.maps.push(map);
        });
      }
      dispose() {}
    },
  };
});

vi.mock('three/addons/controls/OrbitControls.js', async () => {
  const { Vector3 } = await vi.importActual<typeof import('three')>('three');
  return {
    OrbitControls: class {
      target = new Vector3();
      minZoom = 0;
      maxZoom = 10;
      minPolarAngle = 0;
      maxPolarAngle = Math.PI;
      update() {}
      addEventListener() {}
      removeEventListener() {}
      dispose() {}
    },
  };
});

describe('office scene resource lifecycle', () => {
  beforeEach(() => {
    lifecycle.maps.length = 0;
    lifecycle.mapDisposals = 0;
    lifecycle.depthDisposals = 0;
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('disposes shadow render targets on both StrictMode cleanup and final unmount', () => {
    const view = render(<StrictMode>
      <OfficeScene
        selected=""
        eligibleAgents={[]}
        wakerStatuses={Object.fromEntries(agents.map(agent => [agent.id, { kind: 'unknown' as const, label: 'Status tidak diketahui' }]))}
        snapshotExpiresAt={0}
        onActivityChange={() => {}}
        onSelect={() => {}}
        onZoomChange={() => {}}
        onFallback={() => {}}
        onMotionChange={() => {}}
      />
    </StrictMode>);
    expect(lifecycle.maps).toHaveLength(2);
    view.unmount();
    expect(lifecycle.mapDisposals).toBe(2);
    expect(lifecycle.depthDisposals).toBe(2);
  });
});
