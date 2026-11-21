import { BoxGeometry, Color, CylinderGeometry, Euler, Group, Mesh, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, Vector3 } from 'three';
import { agents, type Agent } from './agents';
import type { OfficeModel } from './office-model';

export type ActivityKind = 'coffee' | 'eat' | 'read' | 'tv' | 'game' | 'phone' | 'chat' | 'whiteboard' | 'stretch';

export type ProjectStage =
  | { kind: 'kickoff'; label: string }
  | { kind: 'handoff'; from: Agent['id']; to: Agent['id']; label: string }
  | { kind: 'approval'; label: string }
  | { kind: 'celebrate'; label: string };

export type MotionRoute = {
  agentId: Agent['id'];
  slotId: string;
  facilityId: string;
  activity: ActivityKind;
  facingYaw?: number;
  points: Vector3[];
  destinationIndex: number;
};

export type OfficeMotion = {
  readonly running: boolean;
  readonly activeAgent: string | null;
  readonly activity: string | null;
  readonly blocked: boolean;
  setEligibleAgents: (ids: readonly string[]) => void;
  setProjectStage: (stage: ProjectStage | null) => void;
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

type Destination = {
  slotId: string;
  facilityId: string;
  activities: ActivityKind[];
  point: [number, number];
  approach?: Array<[number, number]>;
  facingYaw?: number;
};

const MAX_ACTIVE_ROUTES = 4;

// Stay wide until the swinging limbs clear the wall, then move left before the sofa.
const pantry = {
  slotId: 'pantry',
  facilityId: 'pantry',
  point: [.85, 4.65] as [number, number],
  approach: [[3.66, 2.55], [3.66, 3.65], [3.55, 3.85], [3.55, 4.65]] as Array<[number, number]>,
};
const focus = {
  slotId: 'focus',
  facilityId: 'focus',
  point: [-7.55, .9] as [number, number],
};
// The east approach avoids both sofas, the coffee table and the lounge plant.
// Only the final 0.77m segment (and its reverse) docks onto the seat support.
const lounge = {
  slotId: 'lounge',
  facilityId: 'lounge',
  point: [5.9, 4.67] as [number, number],
  approach: [[7.1, 3.45], [7.1, 5.44], [5.9, 5.44]] as Array<[number, number]>,
};
const meetingChatA = {
  slotId: 'meeting-chat-a',
  facilityId: 'meeting',
  point: [-7.45, 4.55] as [number, number],
  approach: [[-6.45, 3.15], [-7.45, 3.15]] as Array<[number, number]>,
  facingYaw: -Math.PI / 2,
};
const meetingChatB = {
  slotId: 'meeting-chat-b',
  facilityId: 'meeting',
  point: [-6.45, 4.55] as [number, number],
  approach: [[-6.45, 3.15]] as Array<[number, number]>,
  facingYaw: Math.PI / 2,
};
const meetingBoard = {
  slotId: 'meeting-board',
  facilityId: 'meeting',
  point: [-3.85, 3.72] as [number, number],
  approach: [[-2.35, 1.55], [-2.35, 3.72]] as Array<[number, number]>,
  facingYaw: 0,
};

const destinations: Record<Agent['id'], Destination> = {
  pm: { ...pantry, activities: ['coffee', 'eat'] },
  design: { ...focus, activities: ['read'] },
  backend: { ...meetingChatA, activities: ['chat', 'stretch'] },
  frontend: { ...meetingChatB, activities: ['chat'] },
  qa: { ...lounge, activities: ['tv', 'game', 'phone'], approach: [[4, 2.45], [4, 3.45], ...lounge.approach] },
  intake: { ...pantry, activities: ['coffee', 'eat'] },
  delivery: { ...lounge, activities: ['game', 'phone', 'tv'] },
  billing: { ...meetingBoard, activities: ['whiteboard', 'stretch'] },
};

// Verified collision-clear spots inside Ruang Rapat for All-Hands Kickoff Meeting.
const kickoffSpots: Record<Agent['id'], { approach: Array<[number, number]>; point: [number, number]; facingYaw: number; bubble?: boolean }> = {
  pm: { approach: [[-6.25, 3.15], [-6.25, 3.72]], point: [-4.25, 3.72], facingYaw: Math.PI, bubble: true },
  design: { approach: [[-6.25, 3.15], [-6.25, 3.85]], point: [-5.95, 3.85], facingYaw: -Math.PI * .72 },
  frontend: { approach: [[-6.25, 3.15]], point: [-6.25, 4.85], facingYaw: -Math.PI / 2 },
  backend: { approach: [[-6.25, 3.15]], point: [-6.25, 5.95], facingYaw: -Math.PI / 2 },
  qa: { approach: [[-6.25, 3.15]], point: [-6.25, 7.20], facingYaw: -Math.PI * .28 },
  intake: { approach: [[-2.38, 1.55], [-2.38, 3.72]], point: [-3.15, 3.72], facingYaw: Math.PI * .82, bubble: true },
  delivery: { approach: [[-2.38, 1.55], [-2.38, 7.80]], point: [-4.80, 7.80], facingYaw: 0 },
  billing: { approach: [[-2.38, 1.55], [-2.38, 7.80]], point: [-3.45, 7.80], facingYaw: 0 },
};

const activities: Record<ActivityKind, { facility: string; action: string; dwell: number }> = {
  coffee: { facility: 'pantry', action: 'Minum kopi', dwell: 9 },
  eat: { facility: 'pantry', action: 'Makan buah', dwell: 9 },
  read: { facility: 'sudut fokus', action: 'Membaca buku', dwell: 10 },
  tv: { facility: 'lounge', action: 'Menonton TV', dwell: 11 },
  game: { facility: 'lounge', action: 'Bermain konsol', dwell: 11 },
  phone: { facility: 'lounge', action: 'Bermain HP', dwell: 10 },
  chat: { facility: 'ruang rapat', action: 'Ngobrol santai', dwell: 13 },
  whiteboard: { facility: 'ruang rapat', action: 'Diskusi papan tulis', dwell: 11 },
  stretch: { facility: 'ruang rapat', action: 'Peregangan singkat', dwell: 8 },
};

const partNames = [
  'torso', 'left-arm', 'right-arm', 'left-hand', 'right-hand',
  'left-leg', 'right-leg', 'left-shin', 'right-shin', 'left-shoe', 'right-shoe',
];
const up = new Vector3(0, 1, 0);
const speed = 1.5;
const projectSpeed = 2.35;
const isoBubbleYaw = Math.atan2(25, 31);

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
      slotId: destination.slotId,
      facilityId: destination.facilityId,
      activity: destination.activities[0],
      facingYaw: destination.facingYaw,
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
  prop.name = {
    coffee: 'idle-cup',
    eat: 'idle-snack',
    read: 'idle-notebook',
    tv: 'idle-tv',
    game: 'idle-controller',
    phone: 'idle-phone',
    chat: 'idle-chat-bubble',
    whiteboard: 'idle-marker',
    stretch: 'idle-stretch',
  }[kind];
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
  } else if (kind === 'chat') {
    box('bubble-frame', [.42, .22, .035], [0, 0, -.012], '#0f766e');
    box('bubble-card', [.38, .18, .042], [0, 0, 0], '#ffffff');
    const tail = box('bubble-tail', [.075, .075, .035], [-.06, -.105, 0], '#ffffff');
    tail.rotation.z = Math.PI / 4;
    for (let dot = 0; dot < 3; dot++) {
      const dotMesh = new Mesh(new SphereGeometry(.026, 10, 8), material('#0f766e'));
      dotMesh.name = `chat-dot-${dot}`;
      dotMesh.position.set((dot - 1) * .095, 0, .026);
      prop.add(dotMesh);
    }
  } else if (kind === 'whiteboard') {
    const markerBody = new Mesh(new CylinderGeometry(.018, .018, .16, 10), material('#0f766e'));
    markerBody.name = 'marker-body';
    markerBody.rotation.x = Math.PI / 2;
    markerBody.castShadow = true;
    prop.add(markerBody);
    const markerTip = new Mesh(new CylinderGeometry(.007, .014, .038, 10), material('#111827'));
    markerTip.name = 'marker-tip';
    markerTip.rotation.x = Math.PI / 2;
    markerTip.position.set(0, 0, -.095);
    prop.add(markerTip);
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

function chatPose(state: AgentState, bubble: Group | undefined, facingYaw: number, elapsed: number, phaseOffset = 0) {
  standingPose(state, 0);
  const t = elapsed + phaseOffset;
  const sway = Math.sin(t * 2.2) * .08;
  state.figure.position.y = Math.abs(Math.sin(t * 3.1)) * .014;
  state.figure.rotation.y = facingYaw + sway;
  if (bubble) {
    bubble.visible = true;
    bubble.position.set(0, 1.94 + Math.sin(t * 2.8) * .035, 0);
    bubble.rotation.set(0, isoBubbleYaw - state.figure.rotation.y, 0);
    for (let dot = 0; dot < 3; dot++) {
      const dotMesh = bubble.getObjectByName(`chat-dot-${dot}`);
      if (dotMesh) dotMesh.position.y = Math.max(0, Math.sin(t * 5.2 - dot * 1.05)) * .026;
    }
  }
  const rightGesture = Math.sin(t * 4.4);
  const leftGesture = Math.sin(t * 4.4 + 2.1);
  const rightHand = new Vector3(.23 + Math.cos(t * 2.2) * .04, 1.01 + rightGesture * .13, -.33);
  const leftHand = new Vector3(-.23 - Math.cos(t * 2.2) * .03, .97 + leftGesture * .11, -.31);
  setLimb(state, 'right-arm', new Vector3(.22, 1.06, 0), rightHand);
  setLimb(state, 'left-arm', new Vector3(-.22, 1.06, 0), leftHand);
  state.parts.get('right-hand')!.object.position.copy(rightHand);
  state.parts.get('left-hand')!.object.position.copy(leftHand);
}

function whiteboardPose(state: AgentState, marker: Group, elapsed: number) {
  standingPose(state, 0);
  state.figure.position.y = 0;
  state.figure.rotation.y = Math.sin(elapsed * 1.1) * .12;
  const writeX = .18 + Math.sin(elapsed * 3.6) * .14;
  const writeY = 1.24 + Math.cos(elapsed * 2.4) * .12;
  const rightHand = new Vector3(writeX, writeY, -.42);
  const leftHand = new Vector3(-.2, .94, -.26);
  setLimb(state, 'right-arm', new Vector3(.22, 1.06, 0), rightHand);
  setLimb(state, 'left-arm', new Vector3(-.22, 1.06, 0), leftHand);
  state.parts.get('right-hand')!.object.position.copy(rightHand);
  state.parts.get('left-hand')!.object.position.copy(leftHand);
  marker.visible = true;
  marker.position.copy(rightHand).add(new Vector3(0, .02, -.06));
  marker.rotation.set(.15, 0, -.25);
}

function stretchPose(state: AgentState, facingYaw: number, elapsed: number) {
  standingPose(state, 0);
  const reach = (Math.sin(elapsed * 1.9 - Math.PI / 2) + 1) * .5;
  state.figure.position.y = reach * .025;
  state.figure.rotation.y = facingYaw + Math.sin(elapsed * .95) * .1;
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right';
    const hand = new Vector3(side * (.27 + reach * .12), .72 + reach * .78, -.16 * reach);
    setLimb(state, `${label}-arm`, new Vector3(side * .22, 1.06, 0), hand);
    state.parts.get(`${label}-hand`)!.object.position.copy(hand);
  }
}

function workingPose(state: AgentState, elapsed: number, offset: number) {
  restoreParts(state);
  const cycle = (elapsed * .65 + offset * 1.7) % 10;
  const glance = cycle > 8.4 ? Math.sin((cycle - 8.4) / 1.6 * Math.PI) * .14 : 0;
  state.figure.rotation.y = state.rotation.y + glance;
  const typing = (Math.sin(elapsed * 8 + offset) + 1) * .105;
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right';
    const hand = new Vector3(side * .32, .93 + (side < 0 ? typing : .21 - typing), -.5);
    setLimb(state, `${label}-arm`, new Vector3(side * .22, 1.06, 0), hand);
    state.parts.get(`${label}-hand`)!.object.position.copy(hand);
  }
}

function pointSegmentDistance(target: Vector3, start: Vector3, end: Vector3) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (!lengthSquared) return Math.hypot(target.x - start.x, target.z - start.z);
  const t = Math.max(0, Math.min(1, ((target.x - start.x) * dx + (target.z - start.z) * dz) / lengthSquared));
  return Math.hypot(target.x - start.x - t * dx, target.z - start.z - t * dz);
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

function polylinePointDistance(target: Vector3, points: readonly Vector3[], startIndex: number, endIndex: number) {
  let min = Infinity;
  for (let i = Math.max(1, startIndex); i <= endIndex; i++) {
    min = Math.min(min, pointSegmentDistance(target, points[i - 1], points[i]));
  }
  return min;
}

function polylineDistance(a: readonly Vector3[], aStart: number, aEnd: number, b: readonly Vector3[], bStart: number, bEnd: number) {
  let min = Infinity;
  for (let i = Math.max(1, aStart); i <= aEnd; i++) {
    for (let j = Math.max(1, bStart); j <= bEnd; j++) {
      min = Math.min(min, segmentDistance(a[i - 1], a[i], b[j - 1], b[j]));
    }
  }
  return min;
}

export function createOfficeMotion(model: OfficeModel): OfficeMotion {
  type ActiveRoute = {
    route: MotionRoute;
    activity: ActivityKind;
    targetIndex: number;
    phase: number;
    dwell: number;
    waitingAtFacility: boolean;
    returningForWork: boolean;
    props: Map<ActivityKind, Group>;
  };

  type ProjectMove = {
    waypoints: Vector3[];
    index: number;
    phase: number;
    facingYaw: number;
    bubble: boolean;
    arrived: boolean;
    returningHome: boolean;
  };

  const routes = createMotionRoutes(model);
  const routeByAgent = new Map(routes.map(route => [route.agentId, route]));
  const states = new Map(agents.map(agent => [agent.id, captureState(model, agent.id)]));
  const routeIndexByAgent = new Map(routes.map((route, index) => [route.agentId, index]));

  const activityProps = new Map(routes.map(route => {
    const props = new Map(destinations[route.agentId].activities.map(activity => {
      const prop = createActivityProp(states.get(route.agentId)!, activity);
      model.root.add(prop);
      return [activity, prop] as const;
    }));
    if (!props.has('chat')) {
      const bubble = createActivityProp(states.get(route.agentId)!, 'chat');
      model.root.add(bubble);
      props.set('chat', bubble);
    }
    return [route.agentId, props] as const;
  }));

  const orbMaterial = new MeshStandardMaterial({ color: '#14b8a6', emissive: new Color('#14b8a6'), emissiveIntensity: 1.35, roughness: .25 });
  const handoffOrb = new Mesh(new SphereGeometry(.13, 14, 10), orbMaterial);
  handoffOrb.name = 'handoff-orb';
  handoffOrb.visible = false;
  model.root.add(handoffOrb);

  const activityTurns = new Map(routes.map(route => [route.agentId, 0]));
  const activeRoutes = new Map<Agent['id'], ActiveRoute>();
  const projectMoves = new Map<Agent['id'], ProjectMove>();
  const deskWorkers = new Set<Agent['id']>();
  const waitCredits = routes.map(() => 0);

  let running = false;
  let eligibleIds = new Set<string>();
  let projectStage: ProjectStage | null = null;
  let routeCursor = 0;
  let elapsed = 0;
  let projectElapsed = 0;
  let nextActivationAt = 0;

  const updateAnchor = (agentId: Agent['id']) => {
    const state = states.get(agentId)!;
    const position = state.figure.getWorldPosition(new Vector3());
    model.agentAnchors.get(agentId)!.set(position.x, 1.75, position.z);
  };

  const roomGroup = (agentId: Agent['id']) => (agentId === 'intake' || agentId === 'delivery' || agentId === 'billing' ? 'delivery' : 'development');
  const exitPointFor = (agentId: Agent['id']) => (roomGroup(agentId) === 'development' ? point(-6, 1.55) : point(3.25, 1.55));

  const hideAllProps = (agentId: Agent['id']) => {
    const props = activityProps.get(agentId)!;
    for (const prop of props.values()) {
      prop.visible = false;
      model.root.add(prop);
    }
  };

  const snapActiveRoutesBackForProject = () => {
    for (const active of [...activeRoutes.values()]) {
      hideAllProps(active.route.agentId);
      activeRoutes.delete(active.route.agentId);
    }
  };

  const buildProjectTarget = (agentId: Agent['id'], stage: ProjectStage): { goalApproach: Array<[number, number]>; point: [number, number]; facingYaw: number; bubble: boolean } | null => {
    if (stage.kind === 'kickoff') {
      const spot = kickoffSpots[agentId];
      return { goalApproach: spot.approach, point: spot.point, facingYaw: spot.facingYaw, bubble: Boolean(spot.bubble) };
    }
    if (stage.kind === 'handoff') {
      if (agentId !== stage.from && agentId !== stage.to) return null;
      const isA = agentId === stage.from;
      const dev = roomGroup(agentId) === 'development';
      const bridge: Array<[number, number]> = dev ? [] : [[3.25, 2.55], [-6.45, 2.55]];
      const huddleApproach: Array<[number, number]> = isA ? [...bridge, [-6.45, 3.15], [-7.45, 3.15]] : [...bridge, [-6.45, 3.15]];
      return {
        goalApproach: huddleApproach,
        point: isA ? [-7.45, 4.55] : [-6.45, 4.55],
        facingYaw: isA ? -Math.PI / 2 : Math.PI / 2,
        bubble: true,
      };
    }
    if (stage.kind === 'approval') {
      if (agentId !== 'pm' && agentId !== 'billing') return null;
      const isPm = agentId === 'pm';
      const approach: Array<[number, number]> = isPm ? [[-6.45, 3.15], [-7.45, 3.15]] : [[3.25, 2.55], [-6.45, 2.55], [-6.45, 3.15]];
      return {
        goalApproach: approach,
        point: isPm ? [-7.45, 4.55] : [-6.45, 4.55],
        facingYaw: isPm ? -Math.PI / 2 : Math.PI / 2,
        bubble: true,
      };
    }
    return null;
  };

  const enqueueToDesk = (agentId: Agent['id']) => {
    const state = states.get(agentId)!;
    if (state.figure.parent === state.desk) return;
    hideAllProps(agentId);
    model.root.updateMatrixWorld(true);
    const currentPos = state.figure.getWorldPosition(new Vector3());
    const door = exitPointFor(agentId);
    const deskRoute = routeByAgent.get(agentId)!;
    const deskReturn = deskRoute.points.slice(0, 6).reverse();
    const waypoints: Vector3[] = [];
    if (currentPos.z >= 1.4) {
      if (roomGroup(agentId) === 'delivery' && currentPos.x < -1.5) {
        if (currentPos.z > 4.2 && currentPos.x < -5.8) waypoints.push(point(-6.45, 3.15), point(-6.45, 2.55));
        else if (currentPos.x < -2.6 && currentPos.z > 4.1) waypoints.push(point(-2.38, 3.72));
        waypoints.push(point(3.25, 2.55));
      } else if (roomGroup(agentId) === 'development' && currentPos.x > -2.5) {
        waypoints.push(point(-6.45, 2.55));
      } else if (currentPos.x < -3.0 && currentPos.z > 4.0) {
        waypoints.push(point(-6.25, 3.15));
      }
      waypoints.push(door, ...deskReturn.slice(1));
    } else {
      waypoints.push(...deskReturn);
    }
    projectMoves.set(agentId, {
      waypoints,
      index: 0,
      phase: 0,
      facingYaw: state.rotation.y,
      bubble: false,
      arrived: false,
      returningHome: true,
    });
  };

  const enqueueToMeetingGoal = (agentId: Agent['id'], target: NonNullable<ReturnType<typeof buildProjectTarget>>) => {
    const state = states.get(agentId)!;
    hideAllProps(agentId);
    model.root.updateMatrixWorld(true);
    const waypoints: Vector3[] = [];
    if (state.figure.parent === state.desk) {
      model.root.attach(state.figure);
      deskWorkers.delete(agentId);
      const deskExit = routeByAgent.get(agentId)!.points.slice(1, 6);
      waypoints.push(...deskExit);
    } else {
      const currentPos = state.figure.getWorldPosition(new Vector3());
      const dev = roomGroup(agentId) === 'development';
      const door = exitPointFor(agentId);
      if (currentPos.z < 1.35) {
        const deskExit = routeByAgent.get(agentId)!.points.slice(1, 6);
        // Find nearest remaining desk-exit point onward toward doorway so agent stays inside aisle.
        let nearestIdx = 0;
        let bestDist = Infinity;
        deskExit.forEach((pt, i) => {
          const d = Math.hypot(currentPos.x - pt.x, currentPos.z - pt.z);
          if (d < bestDist) { bestDist = d; nearestIdx = i; }
        });
        waypoints.push(...deskExit.slice(nearestIdx));
      } else if (dev && currentPos.x > -2.5) {
        waypoints.push(door);
      } else if (!dev && currentPos.x < -5.8) {
        waypoints.push(point(-6.45, 3.15));
      } else if (currentPos.x < -3.0 && currentPos.z > 4.0 && dev) {
        waypoints.push(point(-6.25, 3.15));
      }
    }
    for (const [x, z] of target.goalApproach) waypoints.push(point(x, z));
    waypoints.push(point(target.point[0], target.point[1]));
    projectMoves.set(agentId, {
      waypoints,
      index: 0,
      phase: 0,
      facingYaw: target.facingYaw,
      bubble: target.bubble,
      arrived: false,
      returningHome: false,
    });
  };

  const isInsideRoomAisle = (active: ActiveRoute) => {
    const pos = states.get(active.route.agentId)!.figure.getWorldPosition(new Vector3());
    if (active.waitingAtFacility) return false;
    return pos.z < 1.95;
  };

  const hasReturningInRoom = (group: 'development' | 'delivery') => [...activeRoutes.values()].some(
    active => roomGroup(active.route.agentId) === group && active.targetIndex > active.route.destinationIndex,
  );

  const hasActiveMovingInSegmentRange = (candidatePoints: readonly Vector3[], startIdx: number, endIdx: number, excludeAgent?: Agent['id']) => {
    for (const active of activeRoutes.values()) {
      if (active.route.agentId === excludeAgent) continue;
      const otherPos = states.get(active.route.agentId)!.figure.getWorldPosition(new Vector3());
      if (active.waitingAtFacility) {
        if (polylinePointDistance(otherPos, candidatePoints, startIdx, endIdx) < .72) return true;
        continue;
      }
      const otherStart = active.targetIndex;
      const otherEnd = active.targetIndex <= active.route.destinationIndex
        ? active.route.destinationIndex
        : active.route.points.length - 1;
      const remaining = [otherPos, ...active.route.points.slice(otherStart, otherEnd + 1)];
      if (polylineDistance(candidatePoints, startIdx, endIdx, remaining, 1, remaining.length - 1) < .72) return true;
    }
    return false;
  };

  const distanceAlongOutboundToDoorway = (route: MotionRoute) => {
    let total = 0;
    const end = Math.min(5, route.destinationIndex);
    for (let i = 1; i <= end; i++) total += route.points[i].distanceTo(route.points[i - 1]);
    return total;
  };

  const remainingDistanceToDoorway = (active: ActiveRoute) => {
    const pos = states.get(active.route.agentId)!.figure.getWorldPosition(new Vector3());
    const end = Math.min(5, active.route.destinationIndex);
    if (active.targetIndex > end) return 0;
    let total = pos.distanceTo(active.route.points[active.targetIndex]);
    for (let i = active.targetIndex + 1; i <= end; i++) total += active.route.points[i].distanceTo(active.route.points[i - 1]);
    return total;
  };

  const canEnterSegmentClear = (candidate: MotionRoute) => {
    const myGroup = roomGroup(candidate.agentId);
    if (hasReturningInRoom(myGroup)) return false;
    const candidatePos = candidate.points[0];
    const candidateDoorDist = distanceAlongOutboundToDoorway(candidate);
    for (const other of activeRoutes.values()) {
      const otherPos = states.get(other.route.agentId)!.figure.getWorldPosition(new Vector3());
      if (polylinePointDistance(otherPos, candidate.points, 1, 2) < 1.25) return false;
      if (other.waitingAtFacility) {
        if (polylinePointDistance(otherPos, candidate.points, 1, candidate.destinationIndex) < .72) return false;
        continue;
      }
      const sameRoom = roomGroup(other.route.agentId) === myGroup;
      if (!sameRoom || other.targetIndex > other.route.destinationIndex) {
        const otherStart = other.targetIndex;
        const otherEnd = other.targetIndex <= other.route.destinationIndex
          ? other.route.destinationIndex
          : other.route.points.length - 1;
        const remaining = [otherPos, ...other.route.points.slice(otherStart, otherEnd + 1)];
        if (polylineDistance(candidate.points, 1, candidate.destinationIndex, remaining, 1, remaining.length - 1) < .72) return false;
        continue;
      }
      if (isInsideRoomAisle(other)) {
        const otherRemain = remainingDistanceToDoorway(other);
        if (candidateDoorDist - otherRemain < 1.4) return false;
        if (otherPos.distanceTo(candidatePos) < 1.8) return false;
      }
      if (candidate.destinationIndex > 5 && other.route.destinationIndex > 5) {
        const myPostPts = [
          candidate.points[5].clone().lerp(candidate.points[6], .45),
          ...candidate.points.slice(6, candidate.destinationIndex + 1),
        ];
        const otherSegs = other.targetIndex > 5
          ? [otherPos, ...other.route.points.slice(other.targetIndex, other.route.destinationIndex + 1)]
          : [other.route.points[5].clone().lerp(other.route.points[6], .45), ...other.route.points.slice(6, other.route.destinationIndex + 1)];
        if (otherSegs.length > 1 && polylineDistance(myPostPts, 1, myPostPts.length - 1, otherSegs, 1, otherSegs.length - 1) < .72) {
          return false;
        }
      }
    }
    return true;
  };

  const canStartReturn = (active: ActiveRoute) => {
    const startIdx = active.route.destinationIndex + 1;
    const endIdx = active.route.points.length - 1;
    return !hasActiveMovingInSegmentRange(active.route.points, startIdx, endIdx, active.route.agentId);
  };

  const blocked = () => false;
  const hasEligible = () => routes.some(candidate => eligibleIds.has(candidate.agentId));

  const facilityPose = (active: ActiveRoute) => {
    const { route, activity } = active;
    const prop = active.props.get(activity)!;
    const state = states.get(route.agentId)!;
    const poseElapsed = Math.max(0, activities[activity].dwell - active.dwell);
    prop.visible = false;
    if (activity === 'read') readingPose(state, prop, poseElapsed);
    else if (activity === 'coffee' || activity === 'eat') heldPropPose(state, prop, activity, poseElapsed);
    else if (activity === 'chat') chatPose(state, prop, route.facingYaw ?? Math.PI, poseElapsed);
    else if (activity === 'whiteboard') whiteboardPose(state, prop, poseElapsed);
    else if (activity === 'stretch') stretchPose(state, route.facingYaw ?? Math.PI, poseElapsed);
    else seatedActivityPose(state, prop, activity, poseElapsed);
    updateAnchor(route.agentId);
  };

  const activate = (route: MotionRoute) => {
    const state = states.get(route.agentId)!;
    const turn = activityTurns.get(route.agentId)!;
    const variants = destinations[route.agentId].activities;
    const activity = variants[turn % variants.length];
    activityTurns.set(route.agentId, turn + 1);
    state.figure.rotation.copy(state.rotation);
    restoreParts(state);
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
      returningForWork: false,
      props: activityProps.get(route.agentId)!,
    });
    updateAnchor(route.agentId);
  };

  const occupiedSlots = () => new Set([...activeRoutes.values()].map(active => active.route.slotId));

  const schedule = () => {
    if (projectStage || projectMoves.size > 0 || activeRoutes.size >= MAX_ACTIVE_ROUTES || elapsed < nextActivationAt || !hasEligible()) return;
    const usedSlots = occupiedSlots();
    const chatPartnerWaiting = (
      (activeRoutes.has('backend') && !activeRoutes.has('frontend') && eligibleIds.has('frontend'))
      || (activeRoutes.has('frontend') && !activeRoutes.has('backend') && eligibleIds.has('backend'))
    );
    const candidates = routes
      .map((route, index) => {
        const isChatPartnerBonus = chatPartnerWaiting && (route.agentId === 'backend' || route.agentId === 'frontend') ? 50 : 0;
        return { route, index, priority: waitCredits[index] + isChatPartnerBonus };
      })
      .filter(({ route }) => eligibleIds.has(route.agentId) && !activeRoutes.has(route.agentId) && !usedSlots.has(route.slotId))
      .sort((a, b) => b.priority - a.priority
        || ((a.index - routeCursor + routes.length) % routes.length) - ((b.index - routeCursor + routes.length) % routes.length));

    for (const candidate of candidates) {
      if (!canEnterSegmentClear(candidate.route)) continue;
      activate(candidate.route);
      waitCredits[candidate.index] = 0;
      routeCursor = (candidate.index + 1) % routes.length;
      nextActivationAt = elapsed + .6 + (candidate.index % 3) * .25;
      return;
    }
  };

  const syncWorkers = () => {
    for (const id of [...deskWorkers]) {
      const state = states.get(id)!;
      if ((!projectStage && !eligibleIds.has(id)) || activeRoutes.has(id) || projectMoves.has(id) || state.figure.parent !== state.desk) {
        deskWorkers.delete(id);
        if (state.figure.parent === state.desk) {
          state.figure.rotation.copy(state.rotation);
          restoreParts(state);
        }
      }
    }
    for (const route of routes) {
      const state = states.get(route.agentId)!;
      const shouldWorkAtDesk = (eligibleIds.has(route.agentId) || Boolean(projectStage))
        && !activeRoutes.has(route.agentId)
        && !projectMoves.has(route.agentId)
        && state.figure.parent === state.desk;
      if (shouldWorkAtDesk) {
        deskWorkers.add(route.agentId);
      }
    }
  };

  const restoreSeat = (agentId: Agent['id']) => {
    const state = states.get(agentId)!;
    hideAllProps(agentId);
    state.desk.add(state.figure);
    state.figure.position.copy(state.position);
    state.figure.rotation.copy(state.rotation);
    state.figure.scale.copy(state.scale);
    restoreParts(state);
    activeRoutes.delete(agentId);
    projectMoves.delete(agentId);
    model.root.updateMatrixWorld(true);
    updateAnchor(agentId);
  };

  const shouldYieldStep = (active: ActiveRoute, nextPos: Vector3) => {
    const currentPos = states.get(active.route.agentId)!.figure.position;
    const myPriority = (active.targetIndex > active.route.destinationIndex ? 100 : 0) - routeIndexByAgent.get(active.route.agentId)!;
    for (const route of routes) {
      if (route.agentId === active.route.agentId) continue;
      const otherActive = activeRoutes.get(route.agentId);
      const otherPos = otherActive
        ? states.get(route.agentId)!.figure.position
        : states.get(route.agentId)!.figure.getWorldPosition(new Vector3());
      const distAfter = Math.hypot(nextPos.x - otherPos.x, nextPos.z - otherPos.z);
      const distBefore = Math.hypot(currentPos.x - otherPos.x, currentPos.z - otherPos.z);
      if (distAfter < .72 && distAfter < distBefore) {
        if (!otherActive || otherActive.waitingAtFacility) return true;
        const otherPriority = (otherActive.targetIndex > otherActive.route.destinationIndex ? 100 : 0) - routeIndexByAgent.get(route.agentId)!;
        if (myPriority < otherPriority) return true;
      }
    }
    return false;
  };

  const shouldYieldProjectStep = (agentId: Agent['id'], nextPos: Vector3, returningHome: boolean) => {
    const currentPos = states.get(agentId)!.figure.position;
    const myIdx = routeIndexByAgent.get(agentId)!;
    for (const route of routes) {
      if (route.agentId === agentId) continue;
      const otherMove = projectMoves.get(route.agentId);
      if (!otherMove) continue;
      const otherPos = states.get(route.agentId)!.figure.position;
      const distAfter = Math.hypot(nextPos.x - otherPos.x, nextPos.z - otherPos.z);
      const distBefore = Math.hypot(currentPos.x - otherPos.x, currentPos.z - otherPos.z);
      if (distAfter < .66 && distAfter < distBefore) {
        if (otherMove.arrived) continue;
        const otherPriority = (otherMove.returningHome ? 100 : 0) - routeIndexByAgent.get(route.agentId)!;
        const myPriority = (returningHome ? 100 : 0) - myIdx;
        if (myPriority < otherPriority) return true;
      }
    }
    return false;
  };

  const advanceProjectMove = (agentId: Agent['id'], move: ProjectMove, delta: number) => {
    const state = states.get(agentId)!;
    if (move.arrived) {
      const bubble = move.bubble ? activityProps.get(agentId)!.get('chat')! : undefined;
      if (bubble) state.figure.add(bubble);
      if (projectStage?.kind === 'celebrate') stretchPose(state, move.facingYaw, projectElapsed);
      else chatPose(state, bubble, move.facingYaw, projectElapsed, routeIndexByAgent.get(agentId)! * .7);
      updateAnchor(agentId);
      return true;
    }
    const target = move.waypoints[move.index];
    if (!target) {
      if (move.returningHome) {
        restoreSeat(agentId);
        return true;
      }
      move.arrived = true;
      return true;
    }
    const direction = target.clone().sub(state.figure.position);
    direction.y = 0;
    const distance = direction.length();
    if (distance < .001) {
      move.index++;
      if (move.index >= move.waypoints.length) {
        if (move.returningHome) restoreSeat(agentId);
        else move.arrived = true;
      }
      return true;
    }
    direction.normalize();
    const travel = Math.min(distance, projectSpeed * delta);
    const nextPos = state.figure.position.clone().addScaledVector(direction, travel);
    if (shouldYieldProjectStep(agentId, nextPos, move.returningHome)) {
      standingPose(state, 0, 0);
      return true;
    }
    state.figure.position.copy(nextPos);
    if (travel >= distance) {
      state.figure.position.x = target.x;
      state.figure.position.z = target.z;
    }
    move.phase += travel * 6.5;
    state.figure.rotation.y = Math.atan2(-direction.x, -direction.z);
    standingPose(state, move.phase, 1);
    updateAnchor(agentId);
    if (travel >= distance) {
      move.index++;
      if (move.index >= move.waypoints.length) {
        if (move.returningHome) {
          restoreSeat(agentId);
          return true;
        }
        move.arrived = true;
        const bubble = move.bubble ? activityProps.get(agentId)!.get('chat')! : undefined;
        if (bubble) state.figure.add(bubble);
        chatPose(state, bubble, move.facingYaw, projectElapsed, routeIndexByAgent.get(agentId)! * .7);
      }
    }
    return true;
  };

  const updateHandoffOrb = () => {
    handoffOrb.visible = false;
    if (!projectStage || (projectStage.kind !== 'handoff' && projectStage.kind !== 'approval')) return;
    const aId: Agent['id'] = projectStage.kind === 'handoff' ? projectStage.from : 'pm';
    const bId: Agent['id'] = projectStage.kind === 'handoff' ? projectStage.to : 'billing';
    const moveA = projectMoves.get(aId);
    const moveB = projectMoves.get(bId);
    if (!moveA?.arrived || !moveB?.arrived) return;
    const posA = states.get(aId)!.figure.position;
    const posB = states.get(bId)!.figure.position;
    const t = (Math.sin(projectElapsed * 2.6) + 1) * .5;
    handoffOrb.visible = true;
    orbMaterial.color.set(projectStage.kind === 'approval' ? '#f59e0b' : '#14b8a6');
    orbMaterial.emissive.set(projectStage.kind === 'approval' ? '#f59e0b' : '#14b8a6');
    handoffOrb.position.set(
      posA.x + (posB.x - posA.x) * t,
      1.75 + Math.sin(t * Math.PI) * .42,
      posA.z + (posB.z - posA.z) * t,
    );
  };

  const advanceRoute = (active: ActiveRoute, delta: number) => {
    const { route } = active;
    if (active.waitingAtFacility) {
      if (active.dwell > 0) {
        active.dwell = Math.max(0, active.dwell - delta);
        facilityPose(active);
        return true;
      }
      if (!canStartReturn(active)) {
        facilityPose(active);
        return true;
      }
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
    const nextPos = state.figure.position.clone().addScaledVector(direction, travel);
    if (!docking && shouldYieldStep(active, nextPos)) {
      standingPose(state, 0, 0);
      return true;
    }

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
      active.dwell = active.returningForWork ? 0 : activities[active.activity].dwell;
      active.waitingAtFacility = true;
      state.figure.add(active.props.get(active.activity)!);
      facilityPose(active);
      return true;
    }
    if (active.targetIndex === route.points.length - 1) {
      restoreSeat(route.agentId);
      return true;
    }
    active.targetIndex++;
    return true;
  };

  return {
    get running() { return running; },
    get activeAgent() {
      if (projectMoves.size > 0) return projectMoves.keys().next().value ?? null;
      return activeRoutes.keys().next().value ?? null;
    },
    get activity() {
      if (!running) return null;
      if (projectStage) return projectStage.label;
      if (projectMoves.size > 0) return 'Tim kembali ke meja & melanjutkan aktivitas kantor realtime';
      const list = [...activeRoutes.values()];
      const chatActive = list.filter(item => item.activity === 'chat' && item.waitingAtFacility);
      const descriptions: string[] = [];
      if (chatActive.length >= 2) descriptions.push(`${chatActive.length} agent ngobrol di ruang rapat`);
      for (const active of list) {
        if (chatActive.length >= 2 && active.activity === 'chat' && active.waitingAtFacility) continue;
        const { route } = active;
        const { facility, action } = activities[active.activity];
        if (active.waitingAtFacility) descriptions.push(`${action} di ${facility}`);
        else if (active.targetIndex > route.destinationIndex) descriptions.push(`Kembali ke meja dari ${facility}`);
        else descriptions.push(`Menuju ${facility} untuk ${action.toLowerCase()}`);
      }
      if (deskWorkers.size) descriptions.push(`${deskWorkers.size} agent bekerja di meja`);
      return descriptions.length ? descriptions.join(' · ') : null;
    },
    get blocked() { return blocked(); },
    setEligibleAgents(ids) {
      eligibleIds = new Set(ids);
      for (const active of activeRoutes.values()) {
        if (!eligibleIds.has(active.route.agentId)) {
          active.returningForWork = true;
          if (active.waitingAtFacility) active.dwell = 0;
        } else {
          active.returningForWork = false;
        }
      }
      syncWorkers();
      if (!projectStage && projectMoves.size === 0 && !hasEligible() && activeRoutes.size === 0) running = false;
    },
    setProjectStage(stage) {
      projectStage = stage;
      projectElapsed = 0;
      handoffOrb.visible = false;
      if (!stage) {
        for (const agent of agents) {
          if (states.get(agent.id)!.figure.parent !== states.get(agent.id)!.desk) enqueueToDesk(agent.id);
          else projectMoves.delete(agent.id);
        }
        syncWorkers();
        if (!hasEligible() && projectMoves.size === 0 && activeRoutes.size === 0) running = false;
        return;
      }
      snapActiveRoutesBackForProject();
      for (const agent of agents) {
        const target = buildProjectTarget(agent.id, stage);
        if (target) enqueueToMeetingGoal(agent.id, target);
        else enqueueToDesk(agent.id);
      }
      syncWorkers();
    },
    start() {
      if (running || (!projectStage && projectMoves.size === 0 && !hasEligible() && activeRoutes.size === 0)) return;
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
      if (!projectStage && projectMoves.size === 0 && !hasEligible() && activeRoutes.size === 0) {
        running = false;
        return false;
      }
      elapsed += delta;
      if (projectStage || projectMoves.size > 0) {
        projectElapsed += delta;
        let changed = false;
        for (const [id, move] of [...projectMoves.entries()]) {
          changed = advanceProjectMove(id, move, delta) || changed;
        }
        syncWorkers();
        for (const id of deskWorkers) {
          workingPose(states.get(id)!, elapsed, routeIndexByAgent.get(id)!);
          changed = true;
        }
        updateHandoffOrb();
        if (!projectStage && projectMoves.size === 0) nextActivationAt = elapsed + .4;
        return changed || handoffOrb.visible;
      }

      handoffOrb.visible = false;
      routes.forEach((route, index) => {
        if (eligibleIds.has(route.agentId) && !activeRoutes.has(route.agentId)) waitCredits[index] += delta;
      });
      syncWorkers();
      schedule();
      let changed = false;
      for (const id of deskWorkers) {
        workingPose(states.get(id)!, elapsed, routeIndexByAgent.get(id)!);
        changed = true;
      }
      for (const active of [...activeRoutes.values()]) {
        changed = advanceRoute(active, delta) || changed;
      }
      if (!hasEligible() && activeRoutes.size === 0) running = false;
      return changed;
    },
  };
}
