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
      // Only the seat underneath the hips is support. Keep the full back, arms,
      // pillow and every other sofa/obstacle solid; a shadow is not geometry.
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
  expect(forward.x).toBeCloseTo(expected.x, 5);
  expect(forward.z).toBeCloseTo(expected.z, 5);
}

describe('office local idle motion', () => {
  it('keeps every agent seated and unchanged before the simulation starts', () => {
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

  it('moves only the active agent and keeps its selection anchor on the figure', () => {
    model = createOfficeModel();
    const motion = eligibleMotion();
    const before = agents.map(agent => worldPosition(`avatar-${agent.id}`));
    motion.start();
    expect(motion.update(.05)).toBe(true);
    expect(motion.activeAgent).toBe('pm');
    const moved = worldPosition('avatar-pm');
    expect(moved.distanceTo(before[0])).toBeGreaterThan(.01);
    for (let index = 1; index < agents.length; index++) expect(worldPosition(`avatar-${agents[index].id}`)).toEqual(before[index]);
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

  it('stop freezes the exact pre-stop world transform and every limb, then explicitly resumes', () => {
    model = createOfficeModel();
    const motion = eligibleMotion();
    motion.start();
    for (let index = 0; index < 8; index++) motion.update(.05);
    const stopped = figurePose('pm');
    const position = worldPosition('avatar-pm');
    motion.stop();
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

  it.each(['walking', 'pantry dwell', 'focus dwell', 'lounge dock', 'lounge dwell'])(
    'eligibility loss during %s freezes everything and locks out other routes until explicit resume', phase => {
      model = createOfficeModel();
      const id = phase.startsWith('focus') ? 'design' : phase.startsWith('lounge') ? 'qa' : 'pm';
      const motion = eligibleMotion([id]);
      motion.start();
      if (phase === 'pantry dwell') advanceUntil(motion, () => at(id, .85, 4.65));
      else if (phase === 'focus dwell') advanceUntil(motion, () => at(id, -7.55, .9));
      else if (phase === 'lounge dwell') advanceUntil(motion, () => at(id, 5.9, 4.67));
      else if (phase === 'lounge dock') advanceUntil(motion, () => {
        const p = worldPosition(`avatar-${id}`);
        return Math.abs(p.x - 5.9) < .00001 && p.z < 5.3 && p.z > 4.8;
      });
      else for (let index = 0; index < 8; index++) motion.update(.05);
      if (phase.endsWith('dwell')) for (let index = 0; index < 7; index++) motion.update(.05);
      const frozen = figurePose(id);
      const anchor = model.agentAnchors.get(id)!.clone();
      motion.setEligibleAgents(['backend']);
      expect(motion.running).toBe(false);
      expect(motion.blocked).toBe(true);
      expect(motion.activeAgent).toBe(id);
      expect(motion.activity).toBeNull();
      expect(figurePose(id)).toEqual(frozen);
      motion.start();
      motion.stop();
      motion.setEligibleAgents([]); // A stale/unknown snapshot must not imply work.
      for (let index = 0; index < 150; index++) expect(motion.update(.1)).toBe(false);
      motion.setEligibleAgents(['backend']);
      motion.start();
      expect(motion.running).toBe(false);
      expect(motion.blocked).toBe(true);
      expect(figurePose(id)).toEqual(frozen);
      expect(model.agentAnchors.get(id)).toEqual(anchor);
      motion.setEligibleAgents([id, 'backend']);
      expect(motion.blocked).toBe(false);
      expect(motion.running).toBe(false);
      expect(motion.update(.05)).toBe(false);
      expect(figurePose(id)).toEqual(frozen);
      motion.start();
      expect(figurePose(id)).toEqual(frozen);
      expect(motion.running).toBe(true);
      expect(motion.activeAgent).toBe(id);
      if (phase.endsWith('dwell')) {
        const p = worldPosition(`avatar-${id}`);
        for (let index = 0; index < 110; index++) motion.update(.05);
        expect(worldPosition(`avatar-${id}`)).toEqual(p); // Frozen time did not consume the dwell.
      }
      advanceUntil(motion, () => motion.activeAgent !== id);
      expect(model.root.getObjectByName(`avatar-${id}`)!.parent?.name).toBe(`workstation-${id}`);
    },
  );

  it('rechecks eligibility for future turns without interrupting the still-eligible character', () => {
    model = createOfficeModel();
    const motion = eligibleMotion(['pm', 'design', 'qa']);
    const untouched = ['design', 'qa', 'frontend', 'intake', 'delivery'];
    const before = untouched.map(id => figurePose(id));
    const backendStart = worldPosition('avatar-backend');
    const billingStart = worldPosition('avatar-billing');
    motion.start();
    motion.update(.05);
    const current = figurePose('pm');
    motion.setEligibleAgents(['pm', 'backend', 'billing']);
    expect(motion.running).toBe(true);
    expect(motion.blocked).toBe(false);
    expect(figurePose('pm')).toEqual(current);
    advanceUntil(motion, () => worldPosition('avatar-backend').distanceTo(backendStart) > .1);
    advanceUntil(motion, () => worldPosition('avatar-billing').distanceTo(billingStart) > .1);
    expect(untouched.map(id => figurePose(id))).toEqual(before);
  });

  it.each([
    { id: 'pm', x: .85, z: 4.65 },
    { id: 'delivery', x: 5.9, z: 4.67 },
  ])('manual stop preserves the $id facility pose and unconsumed dwell', ({ id, x, z }) => {
    model = createOfficeModel();
    const motion = eligibleMotion([id]);
    motion.start();
    advanceUntil(motion, () => at(id, x, z));
    for (let index = 0; index < 7; index++) motion.update(.05);
    const frozen = figurePose(id);
    motion.stop();
    expect(figurePose(id)).toEqual(frozen);
    for (let index = 0; index < 100; index++) expect(motion.update(.1)).toBe(false);
    expect(figurePose(id)).toEqual(frozen);
    motion.start();
    expect(figurePose(id)).toEqual(frozen);
    for (let index = 0; index < 110; index++) motion.update(.05);
    expect(at(id, x, z)).toBe(true);
    advanceUntil(motion, () => !at(id, x, z));
  });

  it('eligibility loss also blocks a manually paused route', () => {
    model = createOfficeModel();
    const motion = eligibleMotion();
    motion.start();
    motion.update(.05);
    motion.stop();
    const frozen = figurePose('pm');
    motion.setEligibleAgents(['design']);
    motion.start();
    expect(motion.blocked).toBe(true);
    expect(motion.running).toBe(false);
    expect(figurePose('pm')).toEqual(frozen);
  });

  it('stops when eligibility empties between turns and requires a new start', () => {
    model = createOfficeModel();
    const motion = eligibleMotion(['pm']);
    motion.start();
    advanceUntil(motion, () => motion.activeAgent === null);
    expect(motion.activity).toBeNull();
    motion.setEligibleAgents([]);
    expect(motion.running).toBe(false);
    expect(motion.blocked).toBe(false);
    motion.setEligibleAgents(['billing']);
    for (let index = 0; index < 30; index++) expect(motion.update(.1)).toBe(false);
    motion.start();
    expect(motion.activeAgent).toBe('billing');
  });

  it.each([
    { id: 'pm', facility: 'pantry', x: .85, z: 4.65, facing: [0, 1], action: /minum kopi/i },
    { id: 'design', facility: 'fokus', x: -7.55, z: .9, facing: [-2.1, .55], action: /membaca/i },
    { id: 'qa', facility: 'lounge', x: 5.9, z: 4.67, facing: [0, 1], action: /menonton/i },
  ])('performs a meaningful $facility pose and fully restores the desk pose', ({ id, facility, x, z, facing, action }) => {
    model = createOfficeModel();
    const before = figurePose(id);
    const figure = model.root.getObjectByName(`avatar-${id}`)!;
    const motion = eligibleMotion([id]);
    motion.start();
    expect(motion.activity?.toLowerCase()).toContain(facility);
    expect(motion.activity).toMatch(action);
    advanceUntil(motion, () => at(id, x, z));
    expectFacing(figure, facing[0], facing[1]);
    expect(motion.activity?.toLowerCase()).toContain(facility);
    expect(motion.activity).toMatch(action);
    expect(motion.activity).not.toMatch(/menuju|kembali/i);
    const leftHand = figure.getObjectByName('left-hand')!;
    const rightHand = figure.getObjectByName('right-hand')!;
    expect(leftHand.position.y).toBeGreaterThan(.75);
    expect(rightHand.position.y).toBeGreaterThan(.75);
    expect(rightHand.position.z).toBeLessThan(-.2);
    if (facility !== 'pantry') expect(leftHand.position.z).toBeLessThan(-.2);
    if (facility === 'fokus') {
      const book = figure.getObjectByName('idle-notebook');
      expect(book, 'reading must have a real procedural book').toBeDefined();
      expect(book!.visible).toBe(true);
      expect(leftHand.position.distanceTo(book!.position)).toBeLessThan(.3);
      expect(rightHand.position.distanceTo(book!.position)).toBeLessThan(.3);
    } else if (facility === 'pantry') {
      const cup = figure.getObjectByName('idle-cup')!;
      expect(cup.visible).toBe(true);
      expect(rightHand.position.distanceTo(cup.position)).toBeLessThan(.3);
    } else {
      const sofa = loungeSofa();
      const thigh = new Box3().setFromObject(figure.getObjectByName('right-leg')!);
      const torso = new Box3().setFromObject(figure.getObjectByName('torso')!);
      const cushion = sofa.children.filter(child => child.name === 'cushion')
        .map(child => new Box3().setFromObject(child)).find(box => box.min.x < x && box.max.x > x)!;
      expect(cushion.max.y).toBeCloseTo(.61, 5);
      expect(thigh.min.y).toBeCloseTo(cushion.max.y, 2);
      expect(torso.min.y).toBeGreaterThanOrEqual(cushion.max.y - .001);
      expect(z).toBeGreaterThan(cushion.min.z);
      expect(z).toBeLessThan(cushion.max.z);
      expect(figure.getObjectByName('right-leg')!.position.z).toBeLessThan(-.2);
      expect(figure.getObjectByName('right-shin')!.position.z).toBeLessThan(-.4);
      for (const name of ['left-shoe', 'right-shoe']) {
        expect(new Box3().setFromObject(figure.getObjectByName(name)!).min.y).toBeGreaterThan(.1);
      }
    }
    const facilityPosition = worldPosition(`avatar-${id}`);
    for (let index = 0; index < 118; index++) {
      motion.update(.05);
      expect(worldPosition(`avatar-${id}`)).toEqual(facilityPosition);
    }
    advanceUntil(motion, () => /kembali/i.test(motion.activity ?? ''));
    expect(worldPosition(`avatar-${id}`).distanceTo(facilityPosition)).toBeGreaterThan(.001);
    expect(motion.activity).toMatch(/kembali/i);
    expect(motion.activity?.toLowerCase()).toContain(facility);
    advanceUntil(motion, () => motion.activeAgent === null);
    expect(figurePose(id)).toEqual(before);
    const seat = worldPosition(`avatar-${id}`);
    expect(model.agentAnchors.get(id)!.x).toBeCloseTo(seat.x, 5);
    expect(model.agentAnchors.get(id)!.z).toBeCloseTo(seat.z, 5);
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
      // No limb or torso may penetrate the seat. Contact is only support below hips.
      model.root.updateMatrixWorld(true);
      for (const part of figure.children.filter(child => child instanceof Mesh)) {
        const body = new Box3().setFromObject(part);
        for (const support of loungeSofa().children.filter(child => ['base', 'cushion'].includes(child.name))) {
          const box = new Box3().setFromObject(support);
          box.max.y -= .002; // Permit surface contact, not penetration.
          expect(body.intersectsBox(box), `${part.name} penetrated ${support.name}`).toBe(false);
        }
      }
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
    expect(routes.map(route => route.facilityId)).toEqual(['pantry', 'focus', 'pantry', 'focus', 'lounge', 'pantry', 'lounge', 'lounge']);
    for (const route of routes) {
      const ordinary = routeObstacles(route.agentId);
      const docking = routeObstacles(route.agentId, true);
      if (route.facilityId === 'lounge') {
        expect(route.points.slice(route.destinationIndex - 3, route.destinationIndex + 1).map(p => [p.x, p.z]))
          .toEqual([[7.1, 3.45], [7.1, 5.44], [5.9, 5.44], [5.9, 4.67]]);
      }
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
        expect(body.intersectsBox(wall), `${id}:${part.name} at ${figure.position.x.toFixed(3)},${figure.position.z.toFixed(3)} intersects the pantry wall during ${returning ? 'return' : 'outbound'}; body x=${body.min.x.toFixed(4)}..${body.max.x.toFixed(4)} z=${body.min.z.toFixed(4)}..${body.max.z.toFixed(4)}`).toBe(false);
      }
    }
    expect(returning, `${id} must exercise the return route`).toBe(true);
    expect(motion.activeAgent).toBeNull();
  });

  it('staggers two compatible trips instead of freezing every other character', () => {
    model = createOfficeModel();
    const motion = eligibleMotion();
    const pmStart = worldPosition('avatar-pm');
    const deliveryStart = worldPosition('avatar-delivery');
    motion.start();
    expect(worldPosition('avatar-delivery')).toEqual(deliveryStart);
    for (let index = 0; index < 50; index++) motion.update(.05);
    expect(motion.activity).toMatch(/kopi/i);
    expect(motion.activity).toMatch(/konsol/i);
    expect(worldPosition('avatar-pm').distanceTo(pmStart)).toBeGreaterThan(.1);
    expect(worldPosition('avatar-delivery').distanceTo(deliveryStart)).toBeGreaterThan(.1);
  });

  it('animates four desk workers alongside two trips, leaving only two characters still', () => {
    model = createOfficeModel();
    const motion = eligibleMotion();
    const before = new Map(agents.map(agent => [agent.id, figurePose(agent.id)]));
    const backendPosition = worldPosition('avatar-backend');
    const frontendPosition = worldPosition('avatar-frontend');
    motion.start();
    for (let index = 0; index < 50; index++) motion.update(.05);
    const changed = agents.filter(agent => !isDeepStrictEqual(figurePose(agent.id), before.get(agent.id))).map(agent => agent.id);
    expect(changed).toHaveLength(6);
    expect(changed).not.toContain('design');
    expect(changed).not.toContain('billing');
    expect(motion.activity).toContain('4 agent bekerja di meja');
    expect(worldPosition('avatar-backend')).toEqual(backendPosition);
    expect(worldPosition('avatar-frontend')).toEqual(frontendPosition);
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

  it('rotates pantry activities with larger reusable props and no stacking', () => {
    model = createOfficeModel();
    const motion = eligibleMotion(['pm']);
    const figure = model.root.getObjectByName('avatar-pm')!;
    const initialCups = model.root.getObjectsByProperty('name', 'idle-cup').length;
    const initialSnacks = model.root.getObjectsByProperty('name', 'idle-snack').length;
    motion.start();
    advanceUntil(motion, () => at('pm', .85, 4.65));
    const cup = figure.getObjectByName('idle-cup')!;
    expect(cup.visible).toBe(true);
    expect(new Box3().setFromObject(cup).getSize(new Vector3()).y).toBeGreaterThan(.22);
    advanceUntil(motion, () => motion.activeAgent === null);
    expect(cup.visible).toBe(false);
    advanceUntil(motion, () => motion.activeAgent === 'pm' && /makan buah/i.test(motion.activity ?? '') && !/menuju/i.test(motion.activity ?? ''));
    const snack = figure.getObjectByName('idle-snack')!;
    expect(snack.visible).toBe(true);
    expect(cup.visible).toBe(false);
    expect(cup.parent).toBe(model.root);
    expect(figure.children.filter(child => child.name.startsWith('idle-'))).toEqual([snack]);
    expect(model.root.getObjectsByProperty('name', 'idle-cup')).toHaveLength(initialCups);
    expect(model.root.getObjectsByProperty('name', 'idle-snack')).toHaveLength(initialSnacks);
  });

  it.each([
    { id: 'pm', x: .85, z: 4.65, prop: 'idle-cup', action: /minum kopi/i },
    { id: 'backend', x: .85, z: 4.65, prop: 'idle-snack', action: /makan/i },
    { id: 'delivery', x: 5.9, z: 4.67, prop: 'idle-controller', action: /bermain konsol/i },
    { id: 'billing', x: 5.9, z: 4.67, prop: 'idle-phone', action: /bermain hp/i },
  ])('shows a visible $prop prop and distinct activity pose for $id', ({ id, x, z, prop, action }) => {
    model = createOfficeModel();
    const motion = eligibleMotion([id]);
    const figure = model.root.getObjectByName(`avatar-${id}`)!;
    motion.start();
    advanceUntil(motion, () => at(id, x, z));
    expect(motion.activity).toMatch(action);
    const activityProp = figure.getObjectByName(prop);
    expect(activityProp, `${id} must have a visible ${prop}`).toBeDefined();
    expect(activityProp!.visible).toBe(true);
    if (id === 'delivery' || id === 'billing') expect(figure.getObjectByName('right-leg')!.position.z).toBeLessThan(-.2);
    else expect(figure.getObjectByName('right-hand')!.position.y).toBeGreaterThan(.75);
  });

  it('runs compatible turns without crossings, teleports or stale anchors and fairly restores every character', () => {
    model = createOfficeModel();
    const before = new Map(agents.map(agent => [agent.id, figurePose(agent.id)]));
    const motion = eligibleMotion();
    const routes = createMotionRoutes(model);
    const seats = agents.map(agent => worldPosition(`avatar-${agent.id}`));
    const visited: string[] = [];
    const travelling = new Set<string>();
    let previous = agents.map(agent => worldPosition(`avatar-${agent.id}`));
    motion.start();
    agents.forEach((agent, index) => expect(worldPosition(`avatar-${agent.id}`).distanceTo(previous[index])).toBeLessThan(.000001));
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

  it('reuses its procedural book and leaves all its resources reachable by model disposal', () => {
    model = createOfficeModel();
    const existing = new Set<Object3D>();
    model.root.traverse(object => existing.add(object));
    const motion = eligibleMotion(['design']);
    motion.start();
    advanceUntil(motion, () => at('design', -7.55, .9));
    const book = model.root.getObjectByName('idle-notebook')!;
    expect(book).toBeDefined();
    advanceUntil(motion, () => motion.activeAgent === null);
    expect(model.root.getObjectByName('idle-notebook')).toBe(book);
    expect(book.visible).toBe(false);
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
});
