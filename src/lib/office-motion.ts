import { BoxGeometry, CylinderGeometry, Euler, Group, Mesh, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, Vector3 } from 'three';
import { agents, type Agent } from './agents';
import type { OfficeModel } from './office-model';

export type ActivityKind = 'coffee' | 'eat' | 'read' | 'tv' | 'game' | 'phone';

export type MotionRoute = {
  agentId: Agent['id'];
  facilityId: string;
  activity: ActivityKind;
  points: Vector3[];
  destinationIndex: number;
};

export type OfficeMotion = {
  readonly running: boolean;
  readonly activeAgent: string | null;
  readonly activity: string | null;
  readonly blocked: boolean;
  setEligibleAgents: (ids: readonly string[]) => void;
  start: () => void;
  stop: () => void;
  update: (deltaSeconds: number) => boolean;
};

type RestPart = {
  object: Object3D;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
  length: number;
};

type AgentState = {
  figure: Object3D;
  desk: Object3D;
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
  parts: Map<string, RestPart>;
};

type Destination = { facilityId: string; activities: ActivityKind[]; point: [number, number]; approach?: Array<[number, number]> };
// Stay wide until the swinging limbs clear the wall, then move left before the sofa.
const pantry = { facilityId: 'pantry', point: [.85, 4.65] as [number, number], approach: [[3.66, 2.55], [3.66, 3.65], [3.55, 3.85], [3.55, 4.65]] as Array<[number, number]> };
const focus = { facilityId: 'focus', point: [-7.55, .9] as [number, number] };
// The east approach avoids both sofas, the coffee table and the lounge plant.
// Only the final 0.77m segment (and its reverse) docks onto the seat support.
const lounge = { facilityId: 'lounge', point: [5.9, 4.67] as [number, number], approach: [[7.1, 3.45], [7.1, 5.44], [5.9, 5.44]] as Array<[number, number]> };
const destinations: Record<Agent['id'], Destination> = {
  pm: { ...pantry, activities: ['coffee', 'eat'] },
  design: { ...focus, activities: ['read'] },
  backend: { ...pantry, activities: ['eat', 'coffee'] },
  frontend: { ...focus, activities: ['read'] },
  qa: { ...lounge, activities: ['tv', 'game', 'phone'], approach: [[4, 2.45], [4, 3.45], ...lounge.approach] },
  intake: { ...pantry, activities: ['coffee', 'eat'] },
  delivery: { ...lounge, activities: ['game', 'phone', 'tv'] },
  billing: { ...lounge, activities: ['phone', 'tv', 'game'] },
};
const activities: Record<ActivityKind, { facility: string; action: string; dwell: number }> = {
  coffee: { facility: 'pantry', action: 'Minum kopi', dwell: 8 },
  eat: { facility: 'pantry', action: 'Makan buah', dwell: 8 },
  read: { facility: 'sudut fokus', action: 'Membaca buku', dwell: 9 },
  tv: { facility: 'lounge', action: 'Menonton TV', dwell: 10 },
  game: { facility: 'lounge', action: 'Bermain konsol', dwell: 10 },
  phone: { facility: 'lounge', action: 'Bermain HP', dwell: 9 },
};
const partNames = [
  'torso', 'left-arm', 'right-arm', 'left-hand', 'right-hand',
  'left-leg', 'right-leg', 'left-shin', 'right-shin', 'left-shoe', 'right-shoe',
];
const up = new Vector3(0, 1, 0);
const speed = 1.5;

function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function point(x: number, z: number) {
  return new Vector3(x, 0, z);
}

export function createMotionRoutes(model: OfficeModel): MotionRoute[] {
  model.root.updateMatrixWorld(true);
  return agents.map(agent => {
    const figure = model.root.getObjectByName(`avatar-${agent.id}`)!;
    const desk = model.root.getObjectByName(`workstation-${agent.id}`)!;
    const seated = figure.getWorldPosition(new Vector3());
    const deskRotation = desk.getWorldQuaternion(new Quaternion());
    const behindOffset = new Vector3(0, 0, .82).applyQuaternion(deskRotation);
    const development = agent.group === 'development';
    const aisleZ = development ? -4.35 : -3.85;
    const exitX = development ? -6 : 3.25;
    const lateral = new Vector3(1, 0, 0).applyQuaternion(deskRotation);
    const lateralSign = Math.abs(lateral.z) > .5
      ? Math.sign(lateral.z)
      : Math.sign((exitX - seated.x) * lateral.x) || 1;
    const besideOffset = new Vector3(lateralSign * 1.05, 0, 0).applyQuaternion(deskRotation);
    const beside = point(seated.x + besideOffset.x, seated.z + besideOffset.z);
    const behindBeside = point(beside.x + behindOffset.x, beside.z + behindOffset.z);
    const destination = destinations[agent.id];
    const outbound = [
      point(seated.x, seated.z),
      beside,
      behindBeside,
      point(behindBeside.x, aisleZ),
      point(exitX, aisleZ),
      point(exitX, 1.55),
      ...(destination.approach ?? []).map(([x, z]) => point(x, z)),
      point(destination.point[0], destination.point[1]),
    ];
    return {
      agentId: agent.id,
      facilityId: destination.facilityId,
      activity: destination.activities[0],
      points: [...outbound, ...outbound.slice(0, -1).reverse()],
      destinationIndex: outbound.length - 1,
    };
  });
}

function captureState(model: OfficeModel, agentId: Agent['id']): AgentState {
  const figure = model.root.getObjectByName(`avatar-${agentId}`)!;
  const parts = new Map<string, RestPart>();
  for (const name of partNames) {
    const object = figure.getObjectByName(name)!;
    let length = 1;
    if (object instanceof Mesh && !name.includes('hand') && !name.includes('shoe')) {
      object.geometry.computeBoundingBox();
      length = object.geometry.boundingBox!.max.y - object.geometry.boundingBox!.min.y;
    }
    parts.set(name, { object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(), length });
  }
  return {
    figure,
    desk: model.root.getObjectByName(`workstation-${agentId}`)!,
    position: figure.position.clone(),
    rotation: figure.rotation.clone(),
    scale: figure.scale.clone(),
    parts,
  };
}

function restoreParts(state: AgentState) {
  for (const part of state.parts.values()) {
    part.object.position.copy(part.position);
    part.object.quaternion.copy(part.quaternion);
    part.object.scale.copy(part.scale);
  }
}

function setLimb(state: AgentState, name: string, start: Vector3, end: Vector3) {
  const part = state.parts.get(name)!;
  const direction = end.clone().sub(start);
  const length = direction.length();
  part.object.position.copy(start).add(end).multiplyScalar(.5);
  part.object.quaternion.setFromUnitVectors(up, direction.normalize());
  part.object.scale.copy(part.scale);
  part.object.scale.y *= length / part.length;
}

function standingPose(state: AgentState, phase: number, stride = 1) {
  restoreParts(state);
  const swing = Math.sin(phase) * stride;
  state.figure.position.y = Math.abs(Math.cos(phase)) * .015 * stride;
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right';
    const legSwing = swing * (side < 0 ? -.22 : .22);
    const armSwing = -legSwing * .9;
    const shoulder = new Vector3(side * .22, 1.06, 0);
    const hand = new Vector3(side * .27, .56, armSwing);
    const hip = new Vector3(side * .12, .72, 0);
    const knee = new Vector3(side * .13, .43, legSwing * .65);
    const ankle = new Vector3(side * .14, .2, legSwing);
    setLimb(state, `${label}-arm`, shoulder, hand);
    setLimb(state, `${label}-leg`, hip, knee);
    setLimb(state, `${label}-shin`, knee, ankle);
    state.parts.get(`${label}-hand`)!.object.position.copy(hand);
    state.parts.get(`${label}-shoe`)!.object.position.set(side * .15, .18, legSwing - .08);
  }
}

function loungePose(state: AgentState) {
  // Finish bending before crossing the cushion's front edge (z=4.93).
  // Hips/thigh undersides rest at y=.61; the back ends at z=4.31 and the
  // nearest arm begins at x=6.37, retaining .36/.47 centre clearance.
  const amount = smoothstep((5.44 - state.figure.position.z) / .4);
  const scale = state.figure.scale.y;
  const seatedY = .61 - (.72 - .09) * scale;
  standingPose(state, 0);
  state.figure.position.y = seatedY * amount;
  state.figure.rotation.y = Math.PI;
  const torso = state.parts.get('torso')!;
  torso.object.scale.y = torso.scale.y * (1 - .3 * amount);
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right';
    const hand = new Vector3(side * .27, .56, 0).lerp(new Vector3(side * .18, .81, -.29), amount);
    const hip = new Vector3(side * .12, .72, 0);
    const knee = new Vector3(side * .13, .43, 0).lerp(new Vector3(side * .12, .72, -.45), amount);
    const ankle = new Vector3(side * .14, .2, 0).lerp(new Vector3(side * .14, (.22 - seatedY) / scale, -.48), amount);
    setLimb(state, `${label}-arm`, new Vector3(side * .22, 1.06, 0), hand);
    setLimb(state, `${label}-leg`, hip, knee);
    setLimb(state, `${label}-shin`, knee, ankle);
    state.parts.get(`${label}-hand`)!.object.position.copy(hand);
    state.parts.get(`${label}-shoe`)!.object.position.set(side * .15, .18, -.08)
      .lerp(new Vector3(side * .15, (.165 - seatedY) / scale, -.56), amount);
  }
}

function createActivityProp(state: AgentState, kind: ActivityKind) {
  const prop = new Group();
  prop.name = { coffee: 'idle-cup', eat: 'idle-snack', read: 'idle-notebook', tv: 'idle-tv', game: 'idle-controller', phone: 'idle-phone' }[kind];
  prop.visible = false;
  prop.scale.setScalar(1.35);
  state.figure.add(prop);
  const material = (color: string) => new MeshStandardMaterial({ color, roughness: .82 });
  const box = (name: string, size: [number, number, number], position: [number, number, number], color: string) => {
    const mesh = new Mesh(new BoxGeometry(...size), material(color));
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    prop.add(mesh);
    return mesh;
  };
  if (kind === 'read') {
    box('notebook-cover', [.44, .025, .31], [0, 0, 0], '#537468');
    for (const side of [-1, 1]) {
      box('notebook-page', [.2, .018, .28], [side * .106, .021, 0], '#f4eedf');
      for (let line = 0; line < 4; line++) box('notebook-line', [.14, .002, .006], [side * .106, .031, -.09 + line * .05], '#6f5138');
    }
    const pencil = box('idle-pencil', [.012, .012, .16], [.09, .045, -.02], '#6f5138');
    pencil.rotation.y = -.3;
    pencil.visible = false;
  } else if (kind === 'coffee') {
    const cup = new Mesh(new CylinderGeometry(.065, .055, .14, 14), material('#f4eedf'));
    cup.name = 'cup-body';
    cup.castShadow = true;
    prop.add(cup);
    const coffee = new Mesh(new CylinderGeometry(.052, .052, .006, 14), material('#65452f'));
    coffee.position.y = .073;
    prop.add(coffee);
    const handle = new Mesh(new BoxGeometry(.035, .075, .025), material('#f4eedf'));
    handle.position.set(.075, 0, 0);
    prop.add(handle);
  } else if (kind === 'eat') {
    const fruit = new Mesh(new SphereGeometry(.075, 14, 10), material('#d88945'));
    fruit.name = 'fruit-snack';
    fruit.castShadow = true;
    prop.add(fruit);
    const stem = new Mesh(new CylinderGeometry(.008, .01, .045, 7), material('#537468'));
    stem.position.y = .085;
    stem.rotation.z = -.25;
    prop.add(stem);
  } else if (kind === 'phone') {
    box('phone-body', [.14, .24, .025], [0, 0, 0], '#293a38');
    box('phone-screen', [.115, .19, .006], [0, 0, .016], '#8eb9ae');
  } else if (kind === 'game') {
    box('controller-body', [.3, .075, .16], [0, 0, 0], '#405b54');
    for (const side of [-1, 1]) {
      const stick = new Mesh(new CylinderGeometry(.025, .025, .035, 10), material('#233c35'));
      stick.position.set(side * .075, .05, 0);
      prop.add(stick);
      const button = new Mesh(new SphereGeometry(.018, 8, 6), material(side < 0 ? '#d7a75f' : '#d88975'));
      button.position.set(side * .115, .045, -.045);
      prop.add(button);
    }
  }
  return prop;
}

function readingPose(state: AgentState, book: Group, elapsed: number) {
  standingPose(state, 0);
  state.figure.position.y = 0;
  state.figure.rotation.y = Math.atan2(2.1, -.55);
  book.position.set(0, 1, -.34);
  book.rotation.set(.3 + Math.sin(elapsed * .7) * .015, 0, 0);
  book.visible = true;
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right';
    const hand = book.position.clone().add(new Vector3(side * .18, side < 0 ? -.02 : .045, .01));
    setLimb(state, `${label}-arm`, new Vector3(side * .22, 1.06, 0), hand);
    state.parts.get(`${label}-hand`)!.object.position.copy(hand);
  }
}

function heldPropPose(state: AgentState, prop: Group, kind: 'coffee' | 'eat', elapsed: number) {
  standingPose(state, 0);
  state.figure.position.y = 0;
  state.figure.rotation.y = Math.PI;
  const lift = Math.sin((elapsed % 4) / 4 * Math.PI);
  prop.visible = true;
  prop.position.set(kind === 'coffee' ? .08 : 0, .98 + lift * .27, kind === 'coffee' ? -.34 : -.29);
  prop.rotation.set(kind === 'coffee' ? -.18 * lift : 0, 0, 0);
  const rightHand = prop.position.clone().add(new Vector3(.055, 0, 0));
  const leftHand = new Vector3(-.24, kind === 'coffee' ? .8 : .68, -.12);
  setLimb(state, 'right-arm', new Vector3(.22, 1.06, 0), rightHand);
  setLimb(state, 'left-arm', new Vector3(-.22, 1.06, 0), leftHand);
  state.parts.get('right-hand')!.object.position.copy(rightHand);
  state.parts.get('left-hand')!.object.position.copy(leftHand);
}

function seatedActivityPose(state: AgentState, prop: Group, kind: 'tv' | 'game' | 'phone', elapsed: number) {
  loungePose(state);
  if (kind === 'tv') return;
  prop.visible = true;
  prop.position.set(0, kind === 'phone' ? .88 : .82, kind === 'phone' ? -.34 : -.35);
  prop.rotation.set(kind === 'phone' ? -.28 : 0, 0, 0);
  const movement = Math.sin(elapsed * (kind === 'phone' ? 5 : 3)) * .008;
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right';
    const hand = new Vector3(side * (kind === 'phone' ? .085 : .17) + (side > 0 ? movement : 0), prop.position.y, prop.position.z + .02);
    setLimb(state, `${label}-arm`, new Vector3(side * .22, 1.06, 0), hand);
    state.parts.get(`${label}-hand`)!.object.position.copy(hand);
  }
}

function workingPose(state: AgentState, elapsed: number, offset: number) {
  restoreParts(state);
  const typing = (Math.sin(elapsed * 8 + offset) + 1) * .105;
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right';
    const hand = new Vector3(side * .32, .93 + (side < 0 ? typing : .21 - typing), -.5);
    setLimb(state, `${label}-arm`, new Vector3(side * .22, 1.06, 0), hand);
    state.parts.get(`${label}-hand`)!.object.position.copy(hand);
  }
}

function pointSegmentDistance(point: Vector3, start: Vector3, end: Vector3) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.z - start.z);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  return Math.hypot(point.x - start.x - t * dx, point.z - start.z - t * dz);
}

function segmentDistance(a: Vector3, b: Vector3, c: Vector3, d: Vector3) {
  const cross = (p: Vector3, q: Vector3, r: Vector3) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return 0;
  return Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d), pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b));
}

function routesAreCompatible(a: MotionRoute, b: MotionRoute) {
  for (let first = 0; first < a.points.length - 1; first++) {
    for (let second = 0; second < b.points.length - 1; second++) {
      if (segmentDistance(a.points[first], a.points[first + 1], b.points[second], b.points[second + 1]) < .68) return false;
    }
  }
  return true;
}

export function createOfficeMotion(model: OfficeModel): OfficeMotion {
  type ActiveRoute = {
    route: MotionRoute;
    activity: ActivityKind;
    targetIndex: number;
    phase: number;
    dwell: number;
    waitingAtFacility: boolean;
    props: Map<ActivityKind, Group>;
  };
  const routes = createMotionRoutes(model);
  const states = new Map(agents.map(agent => [agent.id, captureState(model, agent.id)]));
  const activityProps = new Map(routes.map(route => {
    const props = new Map(destinations[route.agentId].activities.map(activity => {
      const prop = createActivityProp(states.get(route.agentId)!, activity);
      model.root.add(prop);
      return [activity, prop] as const;
    }));
    return [route.agentId, props] as const;
  }));
  const activityTurns = new Map(routes.map(route => [route.agentId, 0]));
  const activeRoutes = new Map<Agent['id'], ActiveRoute>();
  const deskWorkers = new Set<Agent['id']>();
  const waitCredits = routes.map(() => 0);
  let running = false;
  let eligibleIds = new Set<string>();
  let routeCursor = 0;
  let workerCursor = 2;
  let elapsed = 0;
  let nextActivationAt = 0;
  let nextWorkerRotation = 14;

  const updateAnchor = (agentId: Agent['id']) => {
    const state = states.get(agentId)!;
    const position = state.figure.getWorldPosition(new Vector3());
    model.agentAnchors.get(agentId)!.set(position.x, 1.75, position.z);
  };

  const blocked = () => [...activeRoutes.values()].some(active => !eligibleIds.has(active.route.agentId));
  const hasEligible = () => routes.some(candidate => eligibleIds.has(candidate.agentId));
  const facilityPose = (active: ActiveRoute) => {
    const { route, activity } = active;
    const prop = active.props.get(activity)!;
    const state = states.get(route.agentId)!;
    const poseElapsed = activities[activity].dwell - active.dwell;
    prop.visible = false;
    if (activity === 'read') readingPose(state, prop, poseElapsed);
    else if (activity === 'coffee' || activity === 'eat') heldPropPose(state, prop, activity, poseElapsed);
    else seatedActivityPose(state, prop, activity, poseElapsed);
    updateAnchor(route.agentId);
  };

  const activate = (route: MotionRoute) => {
    const state = states.get(route.agentId)!;
    const turn = activityTurns.get(route.agentId)!;
    const variants = destinations[route.agentId].activities;
    const activity = variants[turn % variants.length];
    activityTurns.set(route.agentId, turn + 1);
    model.root.updateMatrixWorld(true);
    model.root.attach(state.figure);
    deskWorkers.delete(route.agentId);
    activeRoutes.set(route.agentId, {
      route,
      activity,
      targetIndex: 1,
      phase: 0,
      dwell: 0,
      waitingAtFacility: false,
      props: activityProps.get(route.agentId)!,
    });
    updateAnchor(route.agentId);
  };

  const schedule = () => {
    if (activeRoutes.size >= 2 || elapsed < nextActivationAt || !hasEligible()) return;
    const candidates = routes
      .map((route, index) => ({ route, index }))
      .filter(({ route }) => eligibleIds.has(route.agentId) && !activeRoutes.has(route.agentId))
      .sort((a, b) => waitCredits[b.index] - waitCredits[a.index]
        || ((a.index - routeCursor + routes.length) % routes.length) - ((b.index - routeCursor + routes.length) % routes.length));
    for (const candidate of candidates) {
      const compatible = [...activeRoutes.values()].every(active => routesAreCompatible(active.route, candidate.route));
      if (!compatible && waitCredits[candidate.index] > 20) return;
      if (!compatible) continue;
      activate(candidate.route);
      waitCredits[candidate.index] = 0;
      routeCursor = (candidate.index + 1) % routes.length;
      nextActivationAt = elapsed + 1.6 + candidate.index % 3 * .45;
      return;
    }
  };

  const syncWorkers = () => {
    const desired = eligibleIds.size >= 6 ? 4 : eligibleIds.size >= 4 ? 2 : eligibleIds.size === 3 ? 1 : 0;
    if (elapsed >= nextWorkerRotation) {
      for (const id of deskWorkers) {
        const state = states.get(id)!;
        if (state.figure.parent === state.desk) restoreParts(state);
      }
      deskWorkers.clear();
      nextWorkerRotation = elapsed + 14;
    }
    for (const id of [...deskWorkers]) {
      const state = states.get(id)!;
      if (!eligibleIds.has(id) || activeRoutes.has(id) || state.figure.parent !== state.desk || deskWorkers.size > desired) {
        deskWorkers.delete(id);
        if (state.figure.parent === state.desk) restoreParts(state);
      }
    }
    let inspected = 0;
    while (deskWorkers.size < desired && inspected < routes.length) {
      const candidate = routes[workerCursor];
      workerCursor = (workerCursor + 1) % routes.length;
      inspected++;
      const state = states.get(candidate.agentId)!;
      if (eligibleIds.has(candidate.agentId) && !activeRoutes.has(candidate.agentId) && state.figure.parent === state.desk) deskWorkers.add(candidate.agentId);
    }
  };

  const restoreSeat = (active: ActiveRoute) => {
    const state = states.get(active.route.agentId)!;
    const prop = active.props.get(active.activity)!;
    prop.visible = false;
    model.root.add(prop);
    state.desk.add(state.figure);
    state.figure.position.copy(state.position);
    state.figure.rotation.copy(state.rotation);
    state.figure.scale.copy(state.scale);
    restoreParts(state);
    activeRoutes.delete(active.route.agentId);
    model.root.updateMatrixWorld(true);
    updateAnchor(active.route.agentId);
  };

  const advanceRoute = (active: ActiveRoute, delta: number) => {
    const { route } = active;
    if (active.dwell > 0) {
      active.dwell = Math.max(0, active.dwell - delta);
      facilityPose(active);
      return true;
    }
    if (active.waitingAtFacility) {
      active.waitingAtFacility = false;
      const prop = active.props.get(active.activity)!;
      prop.visible = false;
      model.root.add(prop);
      active.targetIndex++;
    }
    const state = states.get(route.agentId)!;
    const target = route.points[active.targetIndex];
    const direction = target.clone().sub(state.figure.position);
    direction.y = 0;
    const distance = direction.length();
    direction.normalize();
    const docking = route.facilityId === 'lounge'
      && (active.targetIndex === route.destinationIndex || active.targetIndex === route.destinationIndex + 1);
    const travel = Math.min(distance, (docking ? .4 : speed) * delta);
    state.figure.position.addScaledVector(direction, travel);
    if (travel >= distance) {
      state.figure.position.x = target.x;
      state.figure.position.z = target.z;
    }
    active.phase += travel * 7;
    if (docking) loungePose(state);
    else {
      state.figure.rotation.y = Math.atan2(-direction.x, -direction.z);
      let stride = 1;
      if (route.facilityId === 'lounge') {
        if (active.targetIndex === route.destinationIndex - 1) stride = smoothstep((distance - travel) / .45);
        if (active.targetIndex === route.destinationIndex + 2) {
          const start = route.points[active.targetIndex - 1];
          stride = smoothstep(Math.hypot(state.figure.position.x - start.x, state.figure.position.z - start.z) / .45);
        }
      }
      standingPose(state, active.phase, stride);
      if (active.targetIndex === 1 || active.targetIndex === route.points.length - 1) {
        const seat = route.points[0];
        const away = Math.hypot(state.figure.position.x - seat.x, state.figure.position.z - seat.z);
        const seated = 1 - smoothstep(away / .45);
        state.figure.position.y += (state.position.y - state.figure.position.y) * seated;
        for (const part of state.parts.values()) {
          part.object.position.lerp(part.position, seated);
          part.object.quaternion.slerp(part.quaternion, seated);
          part.object.scale.lerp(part.scale, seated);
        }
      }
    }
    updateAnchor(route.agentId);
    if (travel < distance) return true;
    if (active.targetIndex === route.destinationIndex) {
      active.dwell = activities[active.activity].dwell;
      active.waitingAtFacility = true;
      state.figure.add(active.props.get(active.activity)!);
      facilityPose(active);
      return true;
    }
    if (active.targetIndex === route.points.length - 1) {
      restoreSeat(active);
      return true;
    }
    active.targetIndex++;
    return true;
  };

  return {
    get running() { return running; },
    get activeAgent() { return activeRoutes.keys().next().value ?? null; },
    get activity() {
      if (!running || blocked()) return null;
      const descriptions = [...activeRoutes.values()].map(active => {
        const { route } = active;
        const { facility, action } = activities[active.activity];
        if (active.waitingAtFacility) return `${action} di ${facility}`;
        return active.targetIndex > route.destinationIndex
          ? `Kembali ke meja setelah ${action.toLowerCase()} di ${facility}`
          : `Menuju ${facility} untuk ${action.toLowerCase()}`;
      });
      if (deskWorkers.size) descriptions.push(`${deskWorkers.size} agent bekerja di meja`);
      return descriptions.length ? descriptions.join(' · ') : null;
    },
    get blocked() { return blocked(); },
    setEligibleAgents(ids) {
      eligibleIds = new Set(ids);
      if (blocked() || !hasEligible()) running = false;
    },
    start() {
      if (running || blocked() || !hasEligible()) return;
      running = true;
      syncWorkers();
      schedule();
    },
    stop() {
      running = false;
    },
    update(deltaSeconds: number) {
      if (!running || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return false;
      const delta = Math.min(deltaSeconds, .1);
      if (blocked() || !hasEligible()) { running = false; return false; }
      elapsed += delta;
      routes.forEach((route, index) => {
        if (eligibleIds.has(route.agentId) && !activeRoutes.has(route.agentId)) waitCredits[index] += delta;
      });
      syncWorkers();
      schedule();
      let changed = false;
      for (const id of deskWorkers) {
        workingPose(states.get(id)!, elapsed, routes.findIndex(route => route.agentId === id));
        changed = true;
      }
      for (const active of [...activeRoutes.values()]) {
        changed = advanceRoute(active, delta) || changed;
      }
      return changed;
    },
  };
}
