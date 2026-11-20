import {
  BoxGeometry, CapsuleGeometry, Color, CylinderGeometry, DataTexture, DoubleSide, FrontSide, Group,
  InstancedMesh, LinearFilter, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry,
  SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { agents, facilities } from './agents';

export type OfficeModel = {
  root: Group;
  pickTargets: Object3D[];
  agentAnchors: Map<string, Vector3>;
};

type Point = [number, number, number];
const materials = new Map<string, MeshStandardMaterial>();
function material(color: string, options: { roughness?: number; metalness?: number; opacity?: number; emissive?: string } = {}) {
  const key = JSON.stringify([color, options]);
  if (!materials.has(key)) materials.set(key, new MeshStandardMaterial({
    color, roughness: options.roughness ?? .78, metalness: options.metalness ?? 0,
    transparent: options.opacity !== undefined, opacity: options.opacity ?? 1,
    depthWrite: options.opacity === undefined, side: options.opacity === undefined ? FrontSide : DoubleSide,
    emissive: new Color(options.emissive ?? '#000000'), emissiveIntensity: options.emissive ? .35 : 0,
  }));
  return materials.get(key)!;
}
const palette = {
  ivory: material('#e9e2d3'), edge: material('#aaa393'), wall: material('#f0e9db'),
  sage: material('#829b85'), sageDark: material('#315547'), sageLight: material('#b3c4a9'),
  wood: material('#aa7c50'), woodLight: material('#cda270'), woodDark: material('#6f5138'),
  coral: material('#c9856e'), cream: material('#f4eedf'), charcoal: material('#2e3934'),
  metal: material('#5d6961', { metalness: .35, roughness: .42 }),
  glass: material('#a8cabe', { opacity: .16, roughness: .12 }),
  screen: material('#2f5548', { emissive: '#315c4b', roughness: .28 }),
  white: material('#f7f6ef'), water: material('#9dbfba', { roughness: .2 }),
  leaf: material('#527551'), leafLight: material('#829c6b'), soil: material('#594b3b'),
  light: material('#ffe2a0', { emissive: '#ffd283' }),
};

function group(parent: Object3D, name: string, position: Point = [0, 0, 0]) {
  const value = new Group(); value.name = name; value.position.set(...position); parent.add(value); return value;
}
function box(parent: Object3D, name: string, size: Point, position: Point, surface: MeshStandardMaterial, radius = 0) {
  const geometry = radius > 0
    ? new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(value => value / 2)))
    : new BoxGeometry(...size);
  const mesh = new Mesh(geometry, surface); mesh.name = name; mesh.position.set(...position);
  mesh.castShadow = surface.opacity === 1; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function sphere(parent: Object3D, name: string, radius: number, position: Point, surface: MeshStandardMaterial, scale: Point = [1, 1, 1]) {
  const mesh = new Mesh(new SphereGeometry(radius, 16, 12), surface); mesh.name = name;
  mesh.position.set(...position); mesh.scale.set(...scale); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent: Object3D, name: string, top: number, bottom: number, height: number, position: Point, surface: MeshStandardMaterial) {
  const mesh = new Mesh(new CylinderGeometry(top, bottom, height, 16), surface); mesh.name = name;
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function limb(parent: Object3D, name: string, start: Point, end: Point, radius: number, surface: MeshStandardMaterial) {
  const from = new Vector3(...start); const to = new Vector3(...end); const direction = to.clone().sub(from);
  const mesh = new Mesh(new CapsuleGeometry(radius, Math.max(.01, direction.length() - radius * 2), 4, 8), surface);
  mesh.name = name; mesh.position.copy(from.add(to).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true; parent.add(mesh); return mesh;
}
let shadowTexture: DataTexture | undefined;
function contactShadow(parent: Object3D, x: number, z: number, width: number, depth: number, opacity = .2) {
  if (!shadowTexture) {
    const size = 64; const data = new Uint8Array(size * size * 4);
    for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
      const dx = (column + .5) / size * 2 - 1; const dy = (row + .5) / size * 2 - 1;
      const value = Math.round(Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy)) ** 2 * 255);
      const offset = (row * size + column) * 4;
      data[offset] = value; data[offset + 1] = value; data[offset + 2] = value; data[offset + 3] = 255;
    }
    shadowTexture = new DataTexture(data, size, size);
    shadowTexture.minFilter = LinearFilter; shadowTexture.magFilter = LinearFilter; shadowTexture.needsUpdate = true;
  }
  const surface = new MeshBasicMaterial({ color: '#414638', transparent: true, opacity, alphaMap: shadowTexture, depthWrite: false });
  const shadow = new Mesh(new PlaneGeometry(width, depth), surface); shadow.name = 'contact-shadow';
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(x, .115, z); shadow.renderOrder = 1; parent.add(shadow); return shadow;
}
function plant(parent: Object3D, x: number, z: number, size = 1) {
  const item = group(parent, 'potted-plant', [x, 0, z]); item.scale.setScalar(size);
  contactShadow(item, 0, 0, .72, .72, .18);
  cylinder(item, 'pot', .24, .18, .38, [0, .2, 0], palette.woodLight);
  cylinder(item, 'soil', .21, .21, .03, [0, .4, 0], palette.soil);
  limb(item, 'stem', [0, .4, 0], [0, 1.25, 0], .025, palette.woodDark);
  for (let index = 0; index < 7; index++) {
    const angle = index * 2.4; const height = .63 + index * .095;
    const leaf = sphere(item, 'leaf', .2, [Math.cos(angle) * .2, height, Math.sin(angle) * .2], index % 2 ? palette.leaf : palette.leafLight, [.65, 1.7, .38]);
    leaf.rotation.set(Math.sin(angle) * .7, angle, Math.cos(angle) * .75);
  }
}
function chair(parent: Object3D, x: number, z: number, color = palette.sage, rotation = 0) {
  const item = group(parent, 'chair', [x, 0, z]); item.rotation.y = rotation;
  contactShadow(item, 0, 0, .85, .85, .14);
  box(item, 'seat', [.58, .14, .55], [0, .48, 0], color, .07);
  box(item, 'back', [.58, .58, .12], [0, .81, .25], color, .06);
  cylinder(item, 'stem', .045, .045, .36, [0, .27, 0], palette.metal);
  for (let index = 0; index < 5; index++) {
    const angle = index / 5 * Math.PI * 2;
    limb(item, 'base', [0, .13, 0], [Math.sin(angle) * .33, .1, Math.cos(angle) * .33], .025, palette.metal);
    sphere(item, 'caster', .055, [Math.sin(angle) * .33, .07, Math.cos(angle) * .33], palette.charcoal, [1, .75, 1]);
  }
  return item;
}
const clothing = ['#537468', '#c68c72', '#748b9b', '#b69a62', '#7c6e91', '#6c927e', '#b27968', '#486f68'];
const skins = ['#d8a377', '#e4b98e', '#bd8965', '#e0ac82', '#c89470', '#e5b88b', '#c98f66', '#d9a47b'];
const hair = ['#3a3029', '#544033', '#282a27', '#5a4130', '#2d2a28', '#46372e', '#302b27', '#49382c'];
function person(parent: Object3D, id: string, index: number, x: number, z: number, rotation: number) {
  const figure = group(parent, `avatar-${id}`, [x, -.12, z]); figure.rotation.y = rotation; figure.scale.setScalar(1.12);
  figure.userData.pickId = id; figure.userData.kind = 'agent';
  const shirt = material(clothing[index]); const skin = material(skins[index]); const hairMaterial = material(hair[index]);
  const torso = new Mesh(new CapsuleGeometry(.23, .36, 4, 12), shirt); torso.name = 'torso'; torso.position.set(0, .92, 0); torso.scale.z = .78; torso.castShadow = true; figure.add(torso);
  box(figure, 'shirt-collar', [.16, .08, .035], [0, 1.1, -.18], palette.cream, .015);
  cylinder(figure, 'neck', .085, .085, .14, [0, 1.22, 0], skin);
  sphere(figure, 'head', .235, [0, 1.43, 0], skin, [.9, 1.08, .92]);
  const cap = new Mesh(new SphereGeometry(.225, 16, 10, 0, Math.PI * 2, 0, Math.PI * .58), hairMaterial);
  cap.name = 'hair'; cap.position.set(0, 1.48, .015); cap.scale.set(.94, 1.05, .96); cap.castShadow = true; figure.add(cap);
  box(figure, 'hair-back', [.35, index === 1 || index === 5 ? .38 : .25, .09], [0, index === 1 || index === 5 ? 1.38 : 1.44, .19], hairMaterial, .05);
  for (const side of [-1, 1]) {
    sphere(figure, 'eye', .019, [side * .074, 1.45, -.207], palette.charcoal, [1, 1, .6]);
    sphere(figure, 'ear', .044, [side * .213, 1.43, 0], skin, [.55, 1, .7]);
    const brow = box(figure, 'eyebrow', [.065, .012, .012], [side * .074, 1.51, -.207], hairMaterial, .004); brow.rotation.z = side * .08;
  }
  sphere(figure, 'nose', .028, [0, 1.405, -.223], skin, [.75, 1, .8]);
  box(figure, 'smile', [.075, .012, .012], [0, 1.345, -.206], palette.woodDark, .005);
  limb(figure, 'left-arm', [-.22, 1.06, 0], [-.32, .94, -.48], .075, shirt);
  limb(figure, 'right-arm', [.22, 1.06, 0], [.32, .94, -.48], .075, shirt);
  sphere(figure, 'left-hand', .075, [-.32, .93, -.5], skin, [1, .7, 1]);
  sphere(figure, 'right-hand', .075, [.32, .93, -.5], skin, [1, .7, 1]);
  limb(figure, 'left-leg', [-.12, .72, 0], [-.15, .5, -.42], .09, palette.charcoal);
  limb(figure, 'right-leg', [.12, .72, 0], [.15, .5, -.42], .09, palette.charcoal);
  limb(figure, 'left-shin', [-.15, .5, -.42], [-.15, .2, -.4], .075, palette.charcoal);
  limb(figure, 'right-shin', [.15, .5, -.42], [.15, .2, -.4], .075, palette.charcoal);
  box(figure, 'left-shoe', [.17, .1, .28], [-.15, .16, -.5], palette.woodDark, .04);
  box(figure, 'right-shoe', [.17, .1, .28], [.15, .16, -.5], palette.woodDark, .04);
  if (index === 1) {
    const band = new Mesh(new SphereGeometry(.26, 16, 8, 0, Math.PI * 2, 0, Math.PI * .35), palette.coral);
    band.position.set(0, 1.5, 0); band.scale.y = 1.15; figure.add(band);
  }
  if (index === 5) {
    const band = new Mesh(new TorusGeometry(.23, .022, 6, 20, Math.PI), palette.charcoal); band.position.set(0, 1.46, 0); figure.add(band);
    for (const side of [-1, 1]) sphere(figure, 'headset-pad', .065, [side * .225, 1.43, 0], palette.charcoal, [.45, 1, .8]);
    limb(figure, 'headset-microphone', [-.22, 1.4, -.02], [-.14, 1.33, -.22], .014, palette.charcoal);
  }
  return figure;
}
function roleAccessories(parent: Object3D, index: number) {
  const item = group(parent, 'role-accessory');
  if (index === 2 || index === 3) {
    box(item, 'second-monitor', [.54, .4, .055], [.58, 1.19, -.18], palette.charcoal, .02);
    box(item, 'second-screen', [.47, .33, .01], [.58, 1.19, -.145], palette.screen, .006);
    box(item, 'second-stand', [.05, .22, .05], [.58, .96, -.18], palette.metal);
    for (let row = 0; row < 4; row++) box(item, 'code-line', [.29 - row * .035, .018, .008], [.53, 1.29 - row * .065, -.136], row % 2 ? palette.sageLight : palette.cream);
    return item;
  }
  if (index === 1) {
    box(item, 'design-tablet', [.48, .035, .48], [.57, .925, .1], palette.charcoal, .025);
    box(item, 'tablet-screen', [.41, .012, .4], [.57, .949, .1], palette.cream, .015);
    for (let swatch = 0; swatch < 3; swatch++) box(item, 'color-swatch', [.09, .012, .12], [.43 + swatch * .13, .96, .16], [palette.coral, palette.sage, palette.woodLight][swatch]);
    limb(item, 'stylus', [.38, .97, -.09], [.69, .97, -.17], .012, palette.charcoal);
    return item;
  }
  if (index === 4) {
    box(item, 'qa-clipboard', [.42, .035, .53], [.58, .925, .08], palette.woodDark, .02);
    box(item, 'qa-checklist', [.36, .015, .46], [.58, .951, .08], palette.cream, .01);
    for (let row = 0; row < 3; row++) {
      box(item, 'qa-check', [.035, .012, .035], [.46, .964, -.04 + row * .12], palette.sage);
      box(item, 'qa-line', [.18, .012, .018], [.59, .964, -.04 + row * .12], palette.edge);
    }
    return item;
  }
  if (index === 5) {
    box(item, 'phone-base', [.4, .09, .35], [.6, .94, .08], palette.charcoal, .035);
    box(item, 'phone-handset', [.43, .07, .11], [.6, 1.02, -.02], palette.sageDark, .035);
    for (let button = 0; button < 6; button++) box(item, 'phone-button', [.035, .015, .035], [.5 + button % 3 * .09, .995, .08 + Math.floor(button / 3) * .07], palette.cream, .006);
    return item;
  }
  if (index === 6) {
    for (let page = 0; page < 3; page++) box(item, 'delivery-document', [.42, .018, .5], [.57 + page * .018, .92 + page * .022, .07 - page * .015], palette.cream, .008);
    cylinder(item, 'delivery-seal', .055, .055, .012, [.63, .99, .13], palette.coral);
    limb(item, 'document-pen', [.39, .96, -.12], [.68, .96, -.18], .012, palette.sageDark);
    return item;
  }
  if (index === 7) {
    box(item, 'calculator', [.4, .055, .48], [.58, .94, .08], palette.charcoal, .025);
    box(item, 'calculator-display', [.28, .012, .08], [.58, .973, -.06], palette.sageLight, .008);
    for (let button = 0; button < 12; button++) box(item, 'calculator-key', [.045, .015, .04], [.48 + button % 3 * .1, .978, .04 + Math.floor(button / 3) * .07], button % 4 === 3 ? palette.coral : palette.cream, .005);
    return item;
  }
  box(item, 'planning-notebook', [.38, .04, .48], [.58, .93, .08], index === 0 ? palette.coral : palette.sage, .02);
  box(item, 'planning-page', [.32, .012, .4], [.58, .957, .08], palette.cream, .01);
  limb(item, 'planning-pen', [.42, .98, -.11], [.7, .98, -.17], .012, palette.charcoal);
  return item;
}
function workstation(parent: Object3D, agentId: string, index: number, x: number, z: number, rotation = 0) {
  const item = group(parent, `workstation-${agentId}`, [x, 0, z]); item.rotation.y = rotation;
  const desktopFinishes = [palette.woodLight, material('#d8ba90'), material('#b88b60'), material('#c8a377')];
  const storageSide = index % 2 === 0 ? 1 : -1;
  contactShadow(item, 0, .25, 2.35, 2.15, .24);
  box(item, 'desktop', [1.9, .13, .85], [0, .82, 0], desktopFinishes[index % desktopFinishes.length], .055);
  box(item, 'desktop-edge', [1.82, .025, .77], [0, .89, 0], palette.wood, .025);
  for (const side of [-1, 1]) for (const depth of [-1, 1])
    box(item, 'desk-leg', [.065, .75, .065], [side * .79, .4, depth * .3], palette.metal);
  box(item, 'drawer', [.4, .5, .62], [storageSide * .65, .52, 0], palette.sageLight, .035);
  for (let level = 0; level < 2; level++) box(item, 'drawer-handle', [.15, .025, .025], [storageSide * .65, .49 + level * .18, .324], palette.metal);
  box(item, 'computer-tower', [.28, .48, .46], [-storageSide * .65, .35, -.05], palette.charcoal, .025);
  box(item, 'tower-light', [.06, .025, .012], [-storageSide * .65, .47, .186], palette.sageLight, .005);
  box(item, 'privacy-panel', [1.82, .48, .055], [0, 1.16, -.48], index < 5 ? palette.sageLight : palette.coral, .025);
  box(item, 'privacy-trim', [1.84, .035, .065], [0, 1.415, -.48], palette.woodLight, .012);
  box(item, 'monitor', [.77, .49, .065], [-.15, 1.2, -.18], palette.charcoal, .025);
  box(item, 'screen', [.68, .39, .012], [-.15, 1.2, -.142], palette.screen, .008);
  box(item, 'screen-header', [.56, .035, .008], [-.15, 1.33, -.132], palette.sageLight, .004);
  for (let row = 0; row < 3; row++) box(item, 'screen-ui', [.4 - row * .045, .022, .008], [-.21, 1.23 - row * .065, -.132], row === 1 ? palette.coral : palette.cream, .003);
  box(item, 'monitor-stand', [.07, .25, .07], [-.15, .94, -.18], palette.metal);
  box(item, 'monitor-foot', [.35, .025, .2], [-.15, .9, -.12], palette.metal, .02);
  box(item, 'keyboard', [.6, .035, .21], [-.12, .925, .19], palette.cream, .02);
  const keys = new InstancedMesh(new BoxGeometry(.045, .008, .035), palette.edge, 24);
  keys.name = 'keys'; keys.receiveShadow = true;
  const keyTransform = new Object3D();
  for (let row = 0; row < 3; row++) for (let column = 0; column < 8; column++) {
    keyTransform.position.set(-.36 + column * .065, .948, .13 + row * .052);
    keyTransform.updateMatrix(); keys.setMatrixAt(row * 8 + column, keyTransform.matrix);
  }
  keys.instanceMatrix.needsUpdate = true; keys.computeBoundingBox(); item.add(keys);
  box(item, 'mouse-pad', [.28, .012, .3], [.32, .91, .18], palette.sageDark, .025);
  sphere(item, 'mouse', .075, [.32, .96, .18], palette.cream, [.72, .48, 1]);
  roleAccessories(item, index);
  cylinder(item, 'cup', .075, .065, .16, [-.76, .98, .17], palette.cream);
  const handle = new Mesh(new TorusGeometry(.06, .013, 6, 12, Math.PI * 1.65), palette.cream); handle.position.set(-.82, .99, .17); handle.rotation.y = Math.PI / 2; item.add(handle);
  cylinder(item, 'cable-grommet', .055, .055, .012, [-.72, .91, -.25], palette.charcoal);
  chair(item, 0, .79, index % 2 ? palette.sageLight : palette.sage);
  person(item, agentId, index, 0, .67, 0);
  return item;
}
function floorArea(root: Group, pickTargets: Object3D[], id: string, x: number, z: number, width: number, depth: number, color: string) {
  const area = group(root, `area-${id}`, [x, 0, z]); area.userData.pickId = id; area.userData.kind = 'area';
  box(area, 'floor', [width, .09, depth], [0, .025, 0], material(color), .035);
  pickTargets.push(area); return area;
}
function glass(parent: Object3D, x: number, z: number, width: number, rotation = 0, height = 2.05) {
  const item = group(parent, 'glass-partition', [x, 0, z]); item.rotation.y = rotation;
  box(item, 'glass', [width, height, .025], [0, height / 2 + .08, 0], palette.glass);
  for (const side of [-1, 1]) box(item, 'frame', [.045, height + .08, .055], [side * width / 2, height / 2 + .08, 0], palette.sageDark);
  box(item, 'top-frame', [width, .045, .055], [0, height + .08, 0], palette.sageDark);
  box(item, 'bottom-frame', [width, .045, .055], [0, .1, 0], palette.sageDark);
}
function pendant(parent: Object3D, x: number, z: number, height = 2.65) {
  cylinder(parent, 'pendant-cord', .013, .013, .6, [x, height + .3, z], palette.charcoal);
  cylinder(parent, 'pendant-shade', .09, .27, .19, [x, height, z], palette.sageDark);
  sphere(parent, 'pendant-glow', .13, [x, height - .1, z], palette.light, [1, .45, 1]);
}
function sofa(parent: Object3D, x: number, z: number, width = 2.4, color = palette.coral) {
  const item = group(parent, 'sofa', [x, 0, z]);
  contactShadow(item, 0, 0, width + .35, 1.15, .2);
  box(item, 'base', [width, .3, .85], [0, .3, 0], color, .1);
  box(item, 'back', [width, .75, .22], [0, .67, -.35], color, .09);
  for (const side of [-1, 1]) box(item, 'arm', [.2, .55, .88], [side * (width / 2 - .08), .49, 0], color, .08);
  const cushions = Math.max(2, Math.round(width / .8));
  for (let index = 0; index < cushions; index++) box(item, 'cushion', [width / cushions - .1, .16, .62], [-width / 2 + width / cushions * (index + .5), .53, .07], color, .07);
  box(item, 'accent-pillow', [.42, .4, .15], [-width * .25, .79, -.18], palette.cream, .08).rotation.z = -.13;
}
function buildFacilities(root: Group, pickTargets: Object3D[]) {
  const lobby = floorArea(root, pickTargets, 'lobby', -9.7, 5.9, 5.4, 5.7, '#ddd8c7');
  box(lobby, 'rug', [3.7, .025, 2.5], [0, .09, .8], palette.sageLight, .08);
  box(lobby, 'reception', [2.8, .85, .7], [-.6, .48, -1.5], palette.sage, .07);
  box(lobby, 'counter', [3, .12, .88], [-.6, .94, -1.5], palette.woodLight, .035);
  box(lobby, 'reception-screen', [.55, .4, .06], [-.5, 1.18, -1.5], palette.charcoal, .025);
  for (let index = 0; index < 3; index++) box(lobby, 'reception-mark', [.09, .28 + index * .09, .025], [-1.35 + index * .16, .55, -1.13], palette.cream).rotation.z = -.16;
  box(lobby, 'visitor-brochure', [.38, .025, .28], [.35, 1.02, -1.42], palette.coral, .01).rotation.y = -.15;
  for (let index = 0; index < 4; index++) box(lobby, 'rug-stripe', [3.35, .008, .025], [0, .107, .1 + index * .45], palette.cream);
  sofa(lobby, 1.5, 1.45, 1.65, palette.sage);
  cylinder(lobby, 'side-table', .35, .35, .06, [-.1, .45, 1.2], palette.woodLight);
  cylinder(lobby, 'side-table-leg', .055, .09, .42, [-.1, .23, 1.2], palette.metal);
  plant(lobby, -2.15, 1.95, .85);

  const meeting = floorArea(root, pickTargets, 'meeting', -4.25, 5.7, 5.1, 5.4, '#e4d9c7');
  box(meeting, 'meeting-rug', [3.7, .025, 3.4], [0, .085, 0], material('#c8cbb7'), .08);
  contactShadow(meeting, 0, 0, 3.15, 2.15, .22);
  box(meeting, 'meeting-table', [2.65, .14, 1.35], [0, .78, 0], palette.woodLight, .15);
  for (const side of [-1, 1]) box(meeting, 'table-leg', [.13, .72, .85], [side * .9, .4, 0], palette.woodDark);
  for (const x of [-.9, 0, .9]) { chair(meeting, x, -1.12, palette.sageLight, Math.PI); chair(meeting, x, 1.12, palette.sageLight); }
  for (const x of [-.75, .75]) {
    box(meeting, 'meeting-notebook', [.4, .025, .48], [x, .87, .05], palette.cream, .015).rotation.y = x * .12;
    cylinder(meeting, 'meeting-cup', .065, .055, .13, [x + .32, .94, -.25], palette.coral);
  }
  box(meeting, 'whiteboard', [2.4, 1.15, .08], [0, 1.35, -2.55], palette.white, .02);
  box(meeting, 'board-tray', [1.1, .045, .12], [.45, .78, -2.46], palette.metal, .015);
  for (let index = 0; index < 5; index++) box(meeting, 'board-note', [.3, .24, .015], [-.85 + index * .4, 1.45 + (index % 2) * .27, -2.5], index % 2 ? palette.coral : palette.sageLight);
  glass(meeting, 2.5, .4, 3.7, Math.PI / 2, 1.75);

  const pantry = floorArea(root, pickTargets, 'pantry', .85, 5.7, 4.8, 5.4, '#d9d2be');
  box(pantry, 'pantry-back-wall', [4.75, 1.85, .12], [0, .98, -2.56], palette.wall);
  box(pantry, 'open-shelf', [2.25, .09, .36], [.35, 1.65, -2.31], palette.woodLight, .02);
  for (let index = 0; index < 4; index++) cylinder(pantry, 'shelf-cup', .065, .055, .15, [-.35 + index * .32, 1.77, -2.29], index % 2 ? palette.coral : palette.cream);
  box(pantry, 'cabinet', [3.6, .8, .68], [0, .45, -2.05], palette.sageLight, .035);
  box(pantry, 'counter', [3.75, .1, .8], [0, .9, -2.05], palette.cream, .025);
  box(pantry, 'sink-rim', [.72, .025, .48], [-.45, .96, -2.02], palette.metal, .08);
  box(pantry, 'sink-basin', [.6, .018, .37], [-.45, .978, -2.02], palette.water, .07);
  limb(pantry, 'sink-tap', [-.45, .96, -2.28], [-.45, 1.25, -2.28], .025, palette.metal);
  limb(pantry, 'sink-spout', [-.45, 1.25, -2.28], [-.45, 1.25, -2.05], .025, palette.metal);
  for (const x of [-1.3, -.45, .45, 1.3]) box(pantry, 'cabinet-line', [.02, .65, .02], [x, .46, -1.7], palette.edge);
  box(pantry, 'fridge', [.8, 1.8, .75], [-1.65, .95, -1.95], palette.cream, .06);
  box(pantry, 'fridge-handle', [.035, .55, .05], [-1.36, 1.15, -1.54], palette.metal);
  box(pantry, 'coffee-machine', [.48, .55, .42], [.65, 1.2, -2], palette.charcoal, .04);
  cylinder(pantry, 'coffee-cup', .07, .055, .13, [.65, 1.03, -1.73], palette.white);
  contactShadow(pantry, 0, .45, 2.4, 2.15, .2);
  cylinder(pantry, 'island', .95, .85, .1, [0, .83, .45], palette.woodLight);
  cylinder(pantry, 'island-leg', .12, .25, .75, [0, .42, .45], palette.woodDark);
  sphere(pantry, 'fruit-bowl', .25, [0, .94, .45], palette.cream, [1, .3, 1]);
  for (const [x, z] of [[-.1, .42], [.09, .5], [.02, .32]] as Array<[number, number]>) sphere(pantry, 'fruit', .085, [x, 1.01, z], palette.coral);
  for (const x of [-.9, .9]) { cylinder(pantry, 'stool-seat', .29, .29, .11, [x, .63, .55], palette.coral); cylinder(pantry, 'stool-leg', .045, .07, .57, [x, .32, .55], palette.metal); }
  plant(pantry, 1.85, 1.9, .75);

  const lounge = floorArea(root, pickTargets, 'lounge', 5.95, 5.7, 5.2, 5.4, '#dcd4c2');
  box(lounge, 'rug', [4.1, .025, 3.35], [0, .09, .2], material('#b9c3ac'), .08);
  sofa(lounge, -.65, -1.15, 2.5, palette.coral);
  sofa(lounge, 1.7, .75, 1.5, palette.sage);
  box(lounge, 'coffee-table', [1.55, .12, .85], [-.5, .45, .55], palette.woodLight, .15);
  for (const x of [-1.05, .05]) box(lounge, 'coffee-leg', [.07, .4, .07], [x, .22, .55], palette.woodDark);
  box(lounge, 'console', [2.3, .45, .48], [-.55, .28, 2.15], palette.wood, .04);
  box(lounge, 'television', [1.8, 1.05, .09], [-.55, 1.15, 2.28], palette.charcoal, .025);
  box(lounge, 'tv-screen', [1.65, .9, .015], [-.55, 1.15, 2.22], palette.screen, .008);
  box(lounge, 'console-device', [.48, .09, .28], [-.55, .55, 2.1], palette.cream, .025);
  for (const x of [-.85, -.25]) {
    box(lounge, 'game-controller', [.3, .07, .18], [x, .56, .55], palette.charcoal, .06).rotation.y = x;
    sphere(lounge, 'controller-stick', .025, [x - .06, .61, .54], palette.coral);
  }
  box(lounge, 'coffee-table-book', [.42, .045, .32], [.05, .55, .58], palette.coral, .015).rotation.y = -.18;
  cylinder(lounge, 'lamp-base', .22, .26, .055, [-2.05, .12, 1.85], palette.metal);
  cylinder(lounge, 'lamp-pole', .025, .025, 1.65, [-2.05, .94, 1.85], palette.metal);
  cylinder(lounge, 'lamp-shade', .22, .36, .42, [-2.05, 1.75, 1.85], palette.light);
  plant(lounge, 2.05, -1.85, .9);

  const prayer = floorArea(root, pickTargets, 'prayer', 10.25, 4.1, 3.1, 3.8, '#ccd6c5');
  for (const x of [-.72, .38]) {
    box(prayer, 'prayer-mat', [.85, .035, 1.65], [x, .09, -.4], palette.sage, .06);
    box(prayer, 'mat-detail', [.55, .012, .07], [x, .115, -.95], palette.cream);
    for (let stripe = 0; stripe < 3; stripe++) box(prayer, 'mat-weave', [.68, .008, .018], [x, .116, -.55 + stripe * .32], palette.sageLight);
    box(prayer, 'mat-arch', [.42, .012, .42], [x, .117, -.68], palette.sageDark, .16);
  }
  box(prayer, 'shoe-shelf', [.75, .35, .32], [-1.02, .23, 1.25], palette.woodLight, .025);
  for (const x of [-1.18, -.9]) box(prayer, 'slippers', [.18, .06, .3], [x, .45, 1.25], palette.woodDark, .06);
  box(prayer, 'wudu-basin', [1.25, .25, .55], [.4, .55, 1.32], palette.white, .1);
  box(prayer, 'wudu-water', [1.05, .025, .37], [.4, .68, 1.32], palette.water, .08);
  limb(prayer, 'wudu-tap', [.4, .7, 1.53], [.4, 1.02, 1.53], .035, palette.metal);
  limb(prayer, 'wudu-spout', [.4, 1.02, 1.53], [.4, 1.02, 1.3], .035, palette.metal);
  box(prayer, 'low-divider', [3.05, .8, .12], [0, .45, 1.88], palette.wall);

  const toilet = floorArea(root, pickTargets, 'toilet', 10.25, 7.4, 3.1, 2.5, '#d5ded9');
  box(toilet, 'cistern', [.65, .75, .25], [-.55, .65, -.75], palette.white, .06);
  sphere(toilet, 'toilet-bowl', .4, [-.55, .42, -.35], palette.white, [1, .65, 1.2]);
  sphere(toilet, 'toilet-seat', .31, [-.55, .57, -.35], palette.cream, [1, .18, 1.2]);
  box(toilet, 'sink', [.75, .18, .55], [.65, .85, -.65], palette.white, .12);
  cylinder(toilet, 'sink-pedestal', .11, .16, .75, [.65, .43, -.65], palette.white);
  box(toilet, 'mirror', [.7, .75, .035], [.65, 1.55, -.98], palette.water, .04);
  limb(toilet, 'sink-tap', [.65, .94, -.82], [.65, 1.15, -.82], .022, palette.metal);
  limb(toilet, 'sink-spout', [.65, 1.15, -.82], [.65, 1.15, -.63], .022, palette.metal);
  box(toilet, 'privacy-divider', [.1, 1.45, 2.35], [-1.48, .77, 0], palette.wall);
  cylinder(toilet, 'toilet-paper', .09, .09, .12, [-1.15, .78, -.55], palette.cream).rotation.z = Math.PI / 2;

  const focus = floorArea(root, pickTargets, 'focus', -9.65, 1.45, 5.25, 2.6, '#d3d5c6');
  box(focus, 'focus-desktop', [2.5, .13, .75], [0, .78, 0], palette.woodLight, .04);
  for (const side of [-1, 1]) box(focus, 'focus-leg', [.08, .72, .6], [side, .39, 0], palette.woodDark);
  box(focus, 'acoustic-left', [.15, 1.4, 1.9], [-1.65, .75, 0], palette.sageLight, .05);
  box(focus, 'acoustic-back', [3.4, 1.4, .12], [0, .75, -.95], palette.sageLight, .05);
  for (let index = 0; index < 7; index++) box(focus, 'acoustic-slat', [.055, 1.12, .025], [-1.32 + index * .44, .78, -.875], palette.sage);
  box(focus, 'laptop', [.68, .43, .055], [0, 1.12, -.1], palette.charcoal, .02);
  box(focus, 'laptop-screen', [.59, .34, .012], [0, 1.12, -.065], palette.screen);
  box(focus, 'laptop-base', [.75, .04, .52], [0, .88, .13], palette.metal, .02);
  box(focus, 'focus-notebook', [.42, .035, .5], [.82, .88, .06], palette.coral, .02).rotation.y = -.15;
  cylinder(focus, 'focus-cup', .075, .065, .16, [-.82, .94, .08], palette.cream);
  chair(focus, 0, .82, palette.sage);
  plant(focus, 2.05, .6, .7);
}
export function createOfficeModel(): OfficeModel {
  materials.clear();
  const root = new Group(); root.name = 'original-virtual-office';
  const pickTargets: Object3D[] = []; const agentAnchors = new Map<string, Vector3>();
  box(root, 'foundation', [26.5, .38, 19.4], [0, -.23, 0], palette.edge, .18);
  box(root, 'main-floor', [26.2, .12, 19.1], [0, -.015, 0], palette.ivory, .08);
  for (let index = 0; index < 26; index++) box(root, 'floor-board', [.025, .008, 18.7], [-12.5 + index, .052, 0], index % 3 ? material('#ded7c7') : material('#e6dfd0'));
  box(root, 'back-wall', [26.2, 2.8, .2], [0, 1.4, -9.45], palette.wall);
  box(root, 'left-wall', [.2, 2.8, 19.1], [-13, 1.4, 0], palette.wall);
  box(root, 'back-skirting', [26, .18, .08], [0, .13, -9.3], palette.woodLight);
  box(root, 'left-skirting', [.08, .18, 18.8], [-12.87, .13, 0], palette.woodLight);
  for (const x of [-9.6, -6.3, 4.8, 8.1]) {
    box(root, 'window-frame', [2.45, 1.45, .09], [x, 1.65, -9.31], palette.sageDark, .015);
    box(root, 'window', [2.27, 1.28, .035], [x, 1.65, -9.25], palette.water);
    box(root, 'window-cross', [.045, 1.3, .045], [x, 1.65, -9.2], palette.cream);
    box(root, 'window-cross', [2.3, .045, .045], [x, 1.65, -9.2], palette.cream);
  }
  box(root, 'brand-plaque', [3.7, .88, .08], [-.5, 1.7, -9.28], palette.sageDark, .035);
  for (let index = 0; index < 4; index++) box(root, 'brand-mark', [.12, .38 + index % 2 * .15, .03], [-1.65 + index * .2, 1.7, -9.22], palette.cream).rotation.z = -.18;
  box(root, 'brand-line', [1.45, .07, .03], [.35, 1.84, -9.22], palette.cream);
  box(root, 'brand-line-small', [1.1, .045, .03], [.18, 1.61, -9.22], palette.sageLight);
  for (const [index, z] of [-4.5, 3.7].entries()) {
    box(root, 'wall-art-frame', [.055, 1.15, 1.55], [-12.85, 1.55, z], palette.woodDark, .025);
    box(root, 'wall-art-canvas', [.025, 1.01, 1.41], [-12.81, 1.55, z], palette.cream);
    cylinder(root, 'wall-art-disc', .28, .28, .018, [-12.78, 1.68, z - .25], index ? palette.coral : palette.sage).rotation.z = Math.PI / 2;
    box(root, 'wall-art-line', [.018, .08, .72], [-12.77, 1.3, z + .12], index ? palette.sage : palette.woodLight).rotation.x = -.35;
  }

  const development = floorArea(root, pickTargets, 'development', -6.45, -4.25, 11.9, 9.4, '#d7dfd0');
  const delivery = floorArea(root, pickTargets, 'delivery', 6.4, -4.25, 11.9, 9.4, '#e6d8c3');
  box(development, 'team-rug', [10.9, .025, 8.25], [0, .09, 0], material('#b9cab8'), .09);
  box(delivery, 'team-rug', [10.9, .025, 8.25], [0, .09, 0], material('#dbc5a6'), .09);
  box(development, 'team-threshold', [2.4, .018, .12], [0, .115, 4.03], palette.sageDark, .025);
  box(delivery, 'team-threshold', [2.4, .018, .12], [0, .115, 4.03], palette.wood, .025);
  const devDesks: Point[] = [[-9.6, 0, -6.8], [-6.45, 0, -6.8], [-3.3, 0, -6.8], [-8.2, 0, -2.7], [-4.7, 0, -2.7]];
  const deliveryDesks: Point[] = [[3.05, 0, -6.25], [6.35, 0, -6.25], [9.65, 0, -6.25]];
  const locations = [...devDesks, ...deliveryDesks];
  const deskRotations = [-Math.PI / 2, 0, Math.PI / 2, -Math.PI / 2, Math.PI / 2, -Math.PI / 2, 0, Math.PI / 2];
  agents.forEach((agent, index) => {
    const [x, , z] = locations[index];
    const rotation = deskRotations[index];
    workstation(root, agent.id, index, x, z, rotation);
    pickTargets.push(root.getObjectByName(`avatar-${agent.id}`)!);
    const seatOffset = new Vector3(0, 0, .67).applyAxisAngle(new Vector3(0, 1, 0), rotation);
    agentAnchors.set(agent.id, new Vector3(x + seatOffset.x, 1.75, z + seatOffset.z));
  });
  glass(root, 0, -6.7, 5.3, Math.PI / 2);
  glass(root, 0, -1.75, 2.6, Math.PI / 2, 1.65);
  glass(root, -8.95, .48, 4.9, 0, 1.55);
  glass(root, 7.8, .48, 7.8, 0, 1.55);
  box(root, 'dev-low-divider', [3.5, .72, .12], [-2.2, .4, .48], palette.sageLight);
  box(root, 'delivery-low-divider', [2.25, .72, .12], [1.5, .4, .48], palette.woodLight);
  const fulfillment = group(root, 'delivery-fulfillment', [11.35, 0, -2.15]);
  contactShadow(fulfillment, 0, 0, 1.6, 2.55, .2);
  box(fulfillment, 'fulfillment-cabinet', [1.2, .72, 2.1], [0, .4, 0], palette.sageLight, .045);
  box(fulfillment, 'fulfillment-counter', [1.32, .1, 2.25], [0, .8, 0], palette.cream, .035);
  for (const z of [-.65, 0, .65]) box(fulfillment, 'cabinet-seam', [.025, .55, .02], [.61, .43, z], palette.edge);
  box(fulfillment, 'printer', [.78, .4, .65], [0, 1.04, -.55], palette.white, .055);
  box(fulfillment, 'printer-slot', [.5, .055, .015], [0, 1.05, -.215], palette.charcoal, .008);
  box(fulfillment, 'printer-paper', [.6, .025, .45], [0, 1.27, -.48], palette.cream, .01);
  box(fulfillment, 'delivery-parcel', [.7, .44, .58], [0, 1.06, .58], palette.woodLight, .025);
  box(fulfillment, 'parcel-tape', [.1, .012, .59], [0, 1.286, .58], palette.cream);
  box(fulfillment, 'parcel-label', [.3, .16, .012], [.1, 1.08, .877], palette.white, .008);
  buildFacilities(root, pickTargets);
  for (const [x, z, size] of [[-12, -8.4, .85], [-1.1, -8.4, .85], [11.85, -8.3, 1], [1.25, -.75, .75], [-11.8, 8.55, .75], [8.5, 8.5, .8]] as Point[]) plant(root, x, z, size);
  for (const [x, z] of [[-7, -4], [6.3, -4], [-4.2, 5.4], [5.7, 5.3]] as Array<[number, number]>) pendant(root, x, z);
  box(root, 'walkway', [1.5, .018, 7.2], [0, .075, 4.4], material('#e9e2d3'), .04);
  root.userData.illustrativeFigures = true;
  return { root, pickTargets, agentAnchors };
}
export function disposeOfficeModel(model: OfficeModel) {
  const geometries = new Set<{ dispose: () => void }>();
  const surfaces = new Set<MeshStandardMaterial | MeshBasicMaterial>();
  const textures = new Set<DataTexture>();
  model.root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    if (object instanceof InstancedMesh) object.dispose();
    geometries.add(object.geometry);
    const surface = object.material as MeshStandardMaterial | MeshBasicMaterial;
    surfaces.add(surface);
    if (surface instanceof MeshBasicMaterial && surface.alphaMap instanceof DataTexture) textures.add(surface.alphaMap);
  });
  geometries.forEach(geometry => geometry.dispose());
  surfaces.forEach(surface => surface.dispose());
  textures.forEach(texture => texture.dispose());
  if (shadowTexture && textures.has(shadowTexture)) shadowTexture = undefined;
}
export const facilityIds = facilities.map(facility => facility.id);
