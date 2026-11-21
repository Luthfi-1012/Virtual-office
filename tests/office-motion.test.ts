import { isDeepStrictEqual } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Mesh, Object3D, Quaternion, Vector3 } from 'three';
import { agents } from '@/lib/agents';
import { createOfficeModel, disposeOfficeModel, type OfficeModel } from '@/lib/office-model';
import { createMotionRoutes, createOfficeMotion, type OfficeMotion } from '@/lib/office-motion';

let model: OfficeModel | undefined;
afterEach(() => { if (model) disposeOfficeModel(model); model = undefined; });

function worldPosition(name: string) {
  model!.root.updateMatrixWorld(true);
  return model!.root.getObjectByName(name)!.getWorldPosition(new Vector3());
}

function figurePose(id: string) {
  model!.root.updateMatrixWorld(true);
  const figure = model!.root.getObjectByName(`avatar-${id}`)!;
  const parts: unknown[] = [];
  figure.traverse(object => parts.push({
    name: object.name, parent: object.parent?.uuid, visible: object.visible,
    position: object.position.toArray(), quaternion: object.quaternion.toArray(),
    // Quaternion callbacks can spell a zero Euler angle as -0. It is the
    // same transform; keep quaternion/world-matrix comparisons bit-exact.
    rotation: object.rotation.toArray().map(value => value === 0 ? 0 : value),
    scale: object.scale.toArray(), world: object.matrixWorld.toArray(),
  }));
  return parts;
}

function eligibleMotion(ids: readonly string[] = agents.map(agent => agent.id)) {
  const motion = createOfficeMotion(model!);
  expect(typeof motion.setEligibleAgents).toBe('function');
  motion.setEligibleAgents(ids);
  return motion;
}

function advanceUntil(motion: OfficeMotion, predicate: () => boolean) {
  for (let index = 0; index < 4000 && !predicate(); index++) motion.update(.05);
  expect(predicate(), 'motion must reach the expected state within 200 seconds').toBe(true);
}

function at(id: string, x: number, z: number) {
  const position = worldPosition(`avatar-${id}`);
  return Math.hypot(position.x - x, position.z - z) < .00001;
}

function workstationAncestor(object: Object3D) {
  let current: Object3D | null = object;
  while (current) {
    if (current.name.startsWith('workstation-')) return current.name;
    current = current.parent;
  }
  return undefined;
}

const solidNames = new Set([
  'back-wall', 'left-wall', 'glass-partition', 'dev-low-divider', 'delivery-low-divider',
  'reception', 'counter', 'meeting-table', 'whiteboard', 'pantry-back-wall', 'cabinet',
  'fridge', 'island', 'stool-seat', 'coffee-table', 'console', 'lamp-pole', 'wudu-basin',
  'shoe-shelf', 'low-divider', 'cistern', 'toilet-bowl', 'sink', 'privacy-divider',
  'focus-desktop', 'acoustic-left', 'acoustic-back', 'sofa', 'chair', 'potted-plant',
  'delivery-fulfillment',
]);

type Obstacle = { name: string; box: Box3 };

function loungeSofa() {
  return model!.root.getObjectByName('area-lounge')!.children.find(object => object.name === 'sofa')!;
}

function routeObstacles(agentId: string, docking = false) {
  const obstacles: Obstacle[] = [];
  model!.root.updateMatrixWorld(true);
  model!.root.traverse(object => {
    const workstation = workstationAncestor(object);
    if (workstation) {
      if (workstation === `workstation-${agentId}`) {
        if (object.name === 'back' && object.parent?.name === 'chair') {
          obstacles.push({ name: `${workstation} chair back`, box: new Box3().setFromObject(object) });
        }
        return;
      }
      if (object.name !== workstation) return;
      obstacles.push({ name: workstation, box: new Box3().setFromObject(object) });
      return;
    }
    if (!solidNames.has(object.name)) return;
    if (docking && object === loungeSofa()) {
      for (const child of object.children) {
        if (['base', 'cushion', 'contact-shadow'].includes(child.name)) continue;
        obstacles.push({ name: `lounge sofa ${child.name}`, box: new Box3().setFromObject(child) });
      }
    } else obstacles.push({ name: object.name, box: new Box3().setFromObject(object) });
  });
  return obstacles;
}

function expectSegmentClear(start: Vector3, end: Vector3, obstacles: Obstacle[], label: string) {
  const radius = .3;
  const samples = Math.max(1, Math.ceil(start.distanceTo(end) / .08));
  for (let index = 0; index <= samples; index++) {
    const point = start.clone().lerp(end, index / samples);
    for (const { name, box } of obstacles) {
      const x = Math.max(box.min.x, Math.min(point.x, box.max.x));
      const z = Math.max(box.min.z, Math.min(point.z, box.max.z));
      const clearance = Math.hypot(point.x - x, point.z - z);
      expect(clearance, `${label} near ${name} at ${point.x.toFixed(2)},${point.z.toFixed(2)}`).toBeGreaterThanOrEqual(radius - .0001);
    }
  }
}

function expectFacing(figure: Object3D, x: number, z: number) {
  model!.root.updateMatrixWorld(true);
  const forward = new Vector3(0, 0, -1).applyQuaternion(figure.getWorldQuaternion(new Quaternion()));
  const expected = new Vector3(x, 0, z).normalize();
  expect(forward.x).toBeCloseTo(expected.x, 4);
  expect(forward.z).toBeCloseTo(expected.z, 4);
}

describe('office realtime motion', () => {
  it('keeps every agent seated and unchanged before the motion starts', () => {
    model = createOfficeModel();
    const before = agents.map(agent => figurePose(agent.id));
    const motion = createOfficeMotion(model);
    expect(motion.update(1)).toBe(false);
    expect(motion.running).toBe(false);
    expect(motion.activeAgent).toBeNull();
    expect(motion.activity).toBeNull();
    expect(motion.blocked).toBe(false);
    expect(agents.map(agent => figurePose(agent.id))).toEqual(before);
  });

  it('defaults to no eligible agents and never starts without known eligible IDs', () => {
    model = createOfficeModel();
    const before = agents.map(agent => figurePose(agent.id));
    const motion = createOfficeMotion(model);
    motion.start();
    expect(motion.running).toBe(false);
    expect(motion.update(.1)).toBe(false);
    expect(motion.activeAgent).toBeNull();
    expect(motion.activity).toBeNull();
    expect(typeof motion.setEligibleAgents).toBe('function');
    for (const ids of [[], ['unknown-agent']]) {
      motion.setEligibleAgents(ids);
      motion.start();
      expect(motion.running).toBe(false);
      expect(motion.update(.1)).toBe(false);
    }
    expect(agents.map(agent => figurePose(agent.id))).toEqual(before);
  });

  it('excludes active/unknown agents and copies eligibility without automatically starting', () => {
    model = createOfficeModel();
    const before = figurePose('pm');
    const ids = ['design'];
    const motion = eligibleMotion(ids);
    ids.push('pm');
    expect(motion.running).toBe(false);
    expect(motion.update(.05)).toBe(false);
    motion.start();
    expect(motion.activeAgent).toBe('design');
    motion.update(.05);
    expect(figurePose('pm')).toEqual(before);
    expect(motion.activity).toMatch(/menuju.*fokus.*membaca/i);
  });

  it('moves the first active agent and keeps its selection anchor synced to world position', () => {
    model = createOfficeModel();
    const motion = eligibleMotion();
    const pmBefore = worldPosition('avatar-pm');
    motion.start();
    expect(motion.update(.05)).toBe(true);
    expect(motion.activeAgent).toBe('pm');
    const moved = worldPosition('avatar-pm');
    expect(moved.distanceTo(pmBefore)).toBeGreaterThan(.01);
    expect(model.agentAnchors.get('pm')!.x).toBeCloseTo(moved.x, 5);
    expect(model.agentAnchors.get('pm')!.z).toBeCloseTo(moved.z, 5);
  });

  it('faces the travel direction and swings opposite arms and legs', () => {
    model = createOfficeModel();
    const figure = model.root.getObjectByName('avatar-pm')!;
    const leftArm = figure.getObjectByName('left-arm')!;
    const rightArm = figure.getObjectByName('right-arm')!;
    const restingArm = leftArm.position.clone();
    const motion = eligibleMotion();
    motion.start();
    for (let index = 0; index < 8; index++) motion.update(.05);
    expectFacing(figure, 0, 1);
    expect(leftArm.position.equals(restingArm)).toBe(false);
    expect(leftArm.position.z).not.toBeCloseTo(rightArm.position.z, 3);
    expect(figure.getObjectByName('left-leg')!.position.z).not.toBeCloseTo(figure.getObjectByName('right-leg')!.position.z, 3);
  });

  it('stop freezes the exact pre-stop world transform and every limb, then resumes cleanly', () => {
    model = createOfficeModel();
    const motion = eligibleMotion();
    motion.start();
    for (let index = 0; index < 8; index++) motion.update(.05);
    const stopped = figurePose('pm');
    const position = worldPosition('avatar-pm');
    motion.stop();
    expect(motion.running).toBe(false);
    expect(motion.blocked).toBe(false);
    expect(figurePose('pm')).toEqual(stopped);
    expect(motion.update(1)).toBe(false);
    expect(figurePose('pm')).toEqual(stopped);
    motion.start();
    expect(figurePose('pm')).toEqual(stopped);
    motion.update(.05);
    expect(worldPosition('avatar-pm').distanceTo(position)).toBeGreaterThan(.01);
  });

  it('gracefully recalls an active agent back to desk when its QoderWake status changes to working without freezing others', () => {
    model = createOfficeModel();
    const pmBefore = figurePose('pm');
    const motion = eligibleMotion(['pm', 'delivery', 'backend']);
    motion.start();
    advanceUntil(motion, () => at('pm', .85, 4.65));
    for (let index = 0; index < 5; index++) motion.update(.05);
    motion.setEligibleAgents(['delivery', 'backend']);
    expect(motion.running).toBe(true);
    expect(motion.blocked).toBe(false);
    advanceUntil(motion, () => model!.root.getObjectByName('avatar-pm')!.parent?.name === 'workstation-pm');
    expect(figurePose('pm')).toEqual(pmBefore);
    // Remaining eligible agents continue cleanly.
    const deliveryStart = worldPosition('avatar-delivery');
    advanceUntil(motion, () => worldPosition('avatar-delivery').distanceTo(deliveryStart) > .5);
  });

  it('stops automatically only after recalled agents return and no eligible agents remain', () => {
    model = createOfficeModel();
    const motion = eligibleMotion(['pm']);
    motion.start();
    advanceUntil(motion, () => at('pm', .85, 4.65));
    motion.setEligibleAgents([]);
    expect(motion.running).toBe(true);
    advanceUntil(motion, () => !motion.running);
    expect(motion.activeAgent).toBeNull();
    expect(model.root.getObjectByName('avatar-pm')!.parent?.name).toBe('workstation-pm');
  });

  it('animates 4 concurrent facility trips alongside 4 desk workers so all 8 figures feel alive', () => {
    model = createOfficeModel();
    const motion = eligibleMotion();
    const seats = new Map(agents.map(agent => [agent.id, worldPosition(`avatar-${agent.id}`)]));
    motion.start();
    // Wait ~12s for 4 agents to simultaneously leave their desks while 4 stay animating at desks.
    advanceUntil(motion, () => {
      const roamingCount = agents.filter(agent => model!.root.getObjectByName(`avatar-${agent.id}`)!.parent === model!.root).length;
      return roamingCount === 4;
    });
    for (let index = 0; index < 5; index++) motion.update(.05);
    const roaming = agents.filter(agent => worldPosition(`avatar-${agent.id}`).distanceTo(seats.get(agent.id)!) > .1).map(agent => agent.id);
    expect(roaming).toHaveLength(4);
    expect(motion.activity).toContain('4 agent bekerja di meja');
  });

  it.each([
    { id: 'pm', facility: 'pantry', x: .85, z: 4.65, facing: [0, 1], prop: 'idle-cup', action: /minum kopi/i },
    { id: 'design', facility: 'fokus', x: -7.55, z: .9, facing: [-2.1, .55], prop: 'idle-notebook', action: /membaca/i },
    { id: 'qa', facility: 'lounge', x: 5.9, z: 4.67, facing: [0, 1], prop: '', action: /menonton/i },
    { id: 'backend', facility: 'ruang rapat', x: -7.45, z: 4.55, facing: [1, 0], prop: 'idle-chat-bubble', action: /ngobrol/i },
    { id: 'frontend', facility: 'ruang rapat', x: -6.45, z: 4.55, facing: [-1, 0], prop: 'idle-chat-bubble', action: /ngobrol/i },
    { id: 'billing', facility: 'ruang rapat', x: -3.85, z: 3.72, facing: [0, -1], prop: 'idle-marker', action: /papan tulis/i },
  ])('performs a meaningful $facility pose ($action) and restores exact desk pose for $id', ({ id, facility, x, z, facing, prop, action }) => {
    model = createOfficeModel();
    const before = figurePose(id);
    const figure = model.root.getObjectByName(`avatar-${id}`)!;
    const motion = eligibleMotion([id]);
    motion.start();
    advanceUntil(motion, () => at(id, x, z));
    expectFacing(figure, facing[0], facing[1]);
    expect(motion.activity?.toLowerCase()).toContain(facility);
    expect(motion.activity).toMatch(action);
    if (prop) {
      const activityProp = figure.getObjectByName(prop);
      expect(activityProp, `${id} must have visible ${prop}`).toBeDefined();
      expect(activityProp!.visible).toBe(true);
    }
    const leftHand = figure.getObjectByName('left-hand')!;
    const rightHand = figure.getObjectByName('right-hand')!;
    expect(leftHand.position.y).toBeGreaterThan(.75);
    expect(rightHand.position.y).toBeGreaterThan(.75);
    if (facility === 'lounge') {
      const sofa = loungeSofa();
      const thigh = new Box3().setFromObject(figure.getObjectByName('right-leg')!);
      const torso = new Box3().setFromObject(figure.getObjectByName('torso')!);
      const cushion = sofa.children.filter(child => child.name === 'cushion')
        .map(child => new Box3().setFromObject(child)).find(box => box.min.x < x && box.max.x > x)!;
      expect(thigh.min.y).toBeCloseTo(cushion.max.y, 2);
      expect(torso.min.y).toBeGreaterThanOrEqual(cushion.max.y - .001);
    }
    advanceUntil(motion, () => motion.activeAgent === null);
    expect(figurePose(id)).toEqual(before);
    const seat = worldPosition(`avatar-${id}`);
    expect(model.agentAnchors.get(id)!.x).toBeCloseTo(seat.x, 5);
    expect(model.agentAnchors.get(id)!.z).toBeCloseTo(seat.z, 5);
  });

  it('brings backend and frontend together in the meeting room for face-to-face chatting with speech bubbles', () => {
    model = createOfficeModel();
    const motion = eligibleMotion(['backend', 'frontend']);
    motion.start();
    advanceUntil(motion, () => at('backend', -7.45, 4.55) && at('frontend', -6.45, 4.55));
    expect(motion.activity).toContain('2 agent ngobrol di ruang rapat');
    expect(model.root.getObjectByName('avatar-backend')!.getObjectByName('idle-chat-bubble')!.visible).toBe(true);
    expect(model.root.getObjectByName('avatar-frontend')!.getObjectByName('idle-chat-bubble')!.visible).toBe(true);
  });

  it('docks backwards facing the TV with gradual seated limbs, never walking through the sofa', () => {
    model = createOfficeModel();
    const motion = eligibleMotion(['delivery']);
    const figure = model.root.getObjectByName('avatar-delivery')!;
    motion.start();
    advanceUntil(motion, () => at('delivery', 5.9, 5.44));
    let previous = worldPosition('avatar-delivery');
    let previousLeg = figure.getObjectByName('right-leg')!.position.clone();
    let changes = 0;
    while (!at('delivery', 5.9, 4.67)) {
      motion.update(.05);
      const current = worldPosition('avatar-delivery');
      const leg = figure.getObjectByName('right-leg')!.position.clone();
      expectFacing(figure, 0, 1);
      expect(current.x).toBeCloseTo(5.9, 5);
      expect(current.z).toBeLessThan(previous.z);
      expect(current.distanceTo(previous)).toBeLessThan(.04);
      expect(leg.distanceTo(previousLeg)).toBeLessThan(.065);
      if (leg.distanceTo(previousLeg) > .0001) changes++;
      expectSegmentClear(previous, current, routeObstacles('delivery', true), 'runtime dock');
      previous = current;
      previousLeg = leg;
    }
    expect(changes).toBeGreaterThan(5);
  });

  it('preserves the exact original desk exits and aisle segments', () => {
    model = createOfficeModel();
    const exits: Record<string, number[][]> = {
      pm: [[-10.27, -6.8], [-10.27, -5.75], [-11.09, -5.75], [-11.09, -4.35], [-6, -4.35], [-6, 1.55]],
      design: [[-6.45, -6.13], [-5.4, -6.13], [-5.4, -5.31], [-5.4, -4.35], [-6, -4.35], [-6, 1.55]],
      backend: [[-2.63, -6.8], [-2.63, -5.75], [-1.81, -5.75], [-1.81, -4.35], [-6, -4.35], [-6, 1.55]],
      frontend: [[-8.87, -2.7], [-8.87, -1.65], [-9.69, -1.65], [-9.69, -4.35], [-6, -4.35], [-6, 1.55]],
      qa: [[-4.03, -2.7], [-4.03, -1.65], [-3.21, -1.65], [-3.21, -4.35], [-6, -4.35], [-6, 1.55]],
      intake: [[2.38, -6.25], [2.38, -5.2], [1.56, -5.2], [1.56, -3.85], [3.25, -3.85], [3.25, 1.55]],
      delivery: [[6.35, -5.58], [5.3, -5.58], [5.3, -4.76], [5.3, -3.85], [3.25, -3.85], [3.25, 1.55]],
      billing: [[10.32, -6.25], [10.32, -5.2], [11.14, -5.2], [11.14, -3.85], [3.25, -3.85], [3.25, 1.55]],
    };
    for (const route of createMotionRoutes(model)) {
      route.points.slice(0, 6).forEach((p, index) => {
        expect(p.x).toBeCloseTo(exits[route.agentId][index][0], 6);
        expect(p.z).toBeCloseTo(exits[route.agentId][index][1], 6);
      });
    }
  });

  it('keeps every predefined route clear with only the short lounge docking support exception', () => {
    model = createOfficeModel();
    const routes = createMotionRoutes(model);
    expect(routes.map(route => route.facilityId)).toEqual(['pantry', 'focus', 'meeting', 'meeting', 'lounge', 'pantry', 'lounge', 'meeting']);
    for (const route of routes) {
      const ordinary = routeObstacles(route.agentId);
      const docking = routeObstacles(route.agentId, true);
      for (let index = 1; index < route.points.length; index++) {
        const seatSegment = route.facilityId === 'lounge' && (index === route.destinationIndex || index === route.destinationIndex + 1);
        expectSegmentClear(route.points[index - 1], route.points[index], seatSegment ? docking : ordinary, `${route.agentId} segment ${index}`);
      }
    }
  }, 20000);

  it.each(['pm', 'backend', 'intake'] as const)('keeps every walking body part outside the pantry wall on both trip directions for %s', id => {
    model = createOfficeModel();
    const motion = eligibleMotion([id]);
    const wall = new Box3().setFromObject(model.root.getObjectByName('pantry-back-wall')!);
    const figure = model.root.getObjectByName(`avatar-${id}`)!;
    let returning = false;
    motion.start();
    for (let frame = 0; frame < 4000 && motion.activeAgent === id; frame++) {
      if (motion.activity?.startsWith('Kembali')) returning = true;
      motion.update(.05);
      model.root.updateMatrixWorld(true);
      for (const part of figure.children.filter(child => child instanceof Mesh)) {
        const body = new Box3().setFromObject(part);
        expect(body.intersectsBox(wall), `${id}:${part.name} intersects pantry wall`).toBe(false);
      }
    }
    expect(returning).toBe(true);
    expect(motion.activeAgent).toBeNull();
  });

  it('makes seated handwork readable at the whole-office scale', () => {
    model = createOfficeModel();
    const motion = eligibleMotion();
    const hand = model.root.getObjectByName('avatar-backend')!.getObjectByName('left-hand')!;
    motion.start();
    const heights: number[] = [];
    for (let index = 0; index < 10; index++) {
      motion.update(.05);
      heights.push(hand.position.y);
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(.16);
  });

  it('runs 4 simultaneous turns without crossings, teleports or stale anchors and fairly restores every character', () => {
    model = createOfficeModel();
    const before = new Map(agents.map(agent => [agent.id, figurePose(agent.id)]));
    const motion = eligibleMotion();
    const routes = createMotionRoutes(model);
    const seats = agents.map(agent => worldPosition(`avatar-${agent.id}`));
    const visited: string[] = [];
    const travelling = new Set<string>();
    let previous = agents.map(agent => worldPosition(`avatar-${agent.id}`));
    motion.start();
    for (let frame = 0; frame < 14000 && new Set(visited).size < agents.length; frame++) {
      motion.update(.05);
      model.root.updateMatrixWorld(true);
      const positions = agents.map(agent => model!.root.getObjectByName(`avatar-${agent.id}`)!.getWorldPosition(new Vector3()));
      agents.forEach((agent, index) => {
        const figure = model!.root.getObjectByName(`avatar-${agent.id}`)!;
        const moved = positions[index].distanceTo(previous[index]);
        expect(moved, `${agent.id} must not teleport`).toBeLessThan(.1);
        const anchor = model!.agentAnchors.get(agent.id)!;
        expect(anchor.x).toBeCloseTo(positions[index].x, 6);
        expect(anchor.z).toBeCloseTo(positions[index].z, 6);
        for (let other = index + 1; other < agents.length; other++) {
          expect(Math.hypot(positions[index].x - positions[other].x, positions[index].z - positions[other].z)).toBeGreaterThanOrEqual(.6);
        }
        if (figure.parent === model!.root) {
          const route = routes.find(candidate => candidate.agentId === agent.id)!;
          const onRoute = route.points.slice(1).some((end, routeIndex) => {
            const start = route.points[routeIndex];
            const direction = end.clone().sub(start);
            const p = new Vector3(positions[index].x, 0, positions[index].z);
            const t = Math.max(0, Math.min(1, p.clone().sub(start).dot(direction) / direction.lengthSq()));
            return p.distanceTo(start.clone().addScaledVector(direction, t)) < .000001;
          });
          expect(onRoute, `${agent.id} must follow its tested collision-clear segments`).toBe(true);
          if (positions[index].distanceTo(seats[index]) > .05) travelling.add(agent.id);
        }
        if (travelling.has(agent.id) && positions[index].distanceTo(seats[index]) < .000001) {
          travelling.delete(agent.id);
          if (!visited.includes(agent.id)) visited.push(agent.id);
          expect(figurePose(agent.id)).toEqual(before.get(agent.id));
        }
      });
      previous = positions;
    }
    expect(visited).toHaveLength(agents.length);
    expect([...visited].sort()).toEqual(agents.map(agent => agent.id).sort());
  }, 30000);

  it('reuses new procedural props (chat bubble and marker) and disposes all geometries and materials cleanly', () => {
    model = createOfficeModel();
    const existing = new Set<Object3D>();
    model.root.traverse(object => existing.add(object));
    const motion = eligibleMotion(['backend', 'billing']);
    motion.start();
    advanceUntil(motion, () => at('backend', -7.45, 4.55) && at('billing', -3.85, 3.72));
    expect(model.root.getObjectByName('idle-chat-bubble')).toBeDefined();
    expect(model.root.getObjectByName('idle-marker')).toBeDefined();
    const resources = new Set<{ addEventListener: (type: 'dispose', listener: () => void) => void }>();
    model.root.traverse(object => {
      if (object instanceof Mesh && !existing.has(object)) {
        resources.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
      }
    });
    expect(resources.size).toBeGreaterThan(0);
    let disposed = 0;
    resources.forEach(resource => resource.addEventListener('dispose', () => disposed++));
    disposeOfficeModel(model);
    model = undefined;
    expect(disposed).toBe(resources.size);
  });

  it('gathers all 8 agents in Ruang Rapat on kickoff, animates handoff orb, and resumes normal realtime office life afterward', () => {
    model = createOfficeModel();
    const seats = new Map(agents.map(agent => [agent.id, worldPosition(`avatar-${agent.id}`)]));
    const motion = eligibleMotion();
    motion.start();
    for (let i = 0; i < 40; i++) motion.update(.05);
    motion.setProjectStage({ kind: 'kickoff', label: 'Kickoff Meeting · 8 agent berkumpul' });
    expect(motion.activity).toContain('Kickoff Meeting');
    advanceUntil(motion, () => agents.every(agent => worldPosition(`avatar-${agent.id}`).z > 3.2));
    expect(model.root.getObjectByName('avatar-pm')!.getObjectByName('idle-chat-bubble')!.visible).toBe(true);
    expect(model.root.getObjectByName('avatar-intake')!.getObjectByName('idle-chat-bubble')!.visible).toBe(true);

    motion.setProjectStage({ kind: 'handoff', from: 'intake', to: 'pm', label: 'Handoff Intake -> PM' });
    advanceUntil(motion, () => at('intake', -7.45, 4.55) && at('pm', -6.45, 4.55));
    expect(model.root.getObjectByName('handoff-orb')!.visible).toBe(true);
    expect(model.root.getObjectByName('avatar-intake')!.getObjectByName('idle-chat-bubble')!.visible).toBe(true);
    expect(model.root.getObjectByName('avatar-pm')!.getObjectByName('idle-chat-bubble')!.visible).toBe(true);

    motion.setProjectStage(null);
    expect(model.root.getObjectByName('handoff-orb')!.visible).toBe(false);
    advanceUntil(motion, () => agents.every(agent => model!.root.getObjectByName(`avatar-${agent.id}`)!.parent === model!.root.getObjectByName(`workstation-${agent.id}`)));
    agents.forEach(agent => {
      const p = worldPosition(`avatar-${agent.id}`);
      expect(p.distanceTo(seats.get(agent.id)!)).toBeLessThan(.01);
    });
    // Normal realtime loop resumes automatically once returned to desks.
    for (let i = 0; i < 40; i++) motion.update(.05);
    expect(agents.some(agent => worldPosition(`avatar-${agent.id}`).distanceTo(seats.get(agent.id)!) > .1)).toBe(true);
  }, 20000);
});
