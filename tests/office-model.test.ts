import { afterEach, describe, expect, it } from 'vitest';
import { InstancedMesh, Mesh, MeshStandardMaterial, SphereGeometry, CapsuleGeometry, Vector3 } from 'three';
import { agents, facilities } from '@/lib/agents';
import { createOfficeModel, disposeOfficeModel, type OfficeModel } from '@/lib/office-model';

let model: OfficeModel | undefined;
afterEach(() => { if (model) disposeOfficeModel(model); model = undefined; });

describe('original 3D office model', () => {
  it('contains selectable team rooms and every shared facility', () => {
    model = createOfficeModel();
    const ids = model.pickTargets.map(target => target.userData.pickId);
    expect(new Set(ids)).toEqual(new Set([...agents.map(agent => agent.id), ...facilities.map(facility => facility.id), 'development', 'delivery']));
    expect(ids).toHaveLength(17);
  });

  it('uses modeled people rather than initials or flat markers', () => {
    model = createOfficeModel();
    expect(model.agentAnchors.size).toBe(8);
    for (const agent of agents) {
      const figure = model.root.getObjectByName(`avatar-${agent.id}`);
      expect(figure, agent.id).toBeDefined();
      for (const part of ['head', 'torso', 'left-arm', 'right-arm']) expect(figure!.getObjectByName(part), `${agent.id}:${part}`).toBeDefined();
      let curvedMeshes = 0;
      figure!.traverse(object => {
        if (object instanceof Mesh && (object.geometry instanceof SphereGeometry || object.geometry instanceof CapsuleGeometry)) curvedMeshes++;
      });
      expect(curvedMeshes, agent.id).toBeGreaterThanOrEqual(8);
    }
  });

  it('keeps selection anchors on seated agents when workstations face different directions', () => {
    model = createOfficeModel();
    model.root.updateMatrixWorld(true);
    const rotations = new Set<number>();
    for (const agent of agents) {
      const desk = model.root.getObjectByName(`workstation-${agent.id}`)!;
      const figure = desk.getObjectByName(`avatar-${agent.id}`)!;
      const position = figure.getWorldPosition(new Vector3());
      const anchor = model.agentAnchors.get(agent.id)!;
      rotations.add(desk.rotation.y);
      expect(anchor.x, agent.id).toBeCloseTo(position.x, 5);
      expect(anchor.z, agent.id).toBeCloseTo(position.z, 5);
    }
    expect(rotations.size).toBeGreaterThan(1);
  });

  it('seats every agent toward a monitor at a detailed role-specific workstation', () => {
    model = createOfficeModel();
    for (const agent of agents) {
      const desk = model.root.getObjectByName(`workstation-${agent.id}`)!;
      const figure = desk.getObjectByName(`avatar-${agent.id}`)!;
      const eye = figure.getObjectByName('eye')!;
      const monitor = desk.getObjectByName('monitor')!;
      model.root.updateMatrixWorld(true);
      const eyeInFigure = figure.worldToLocal(eye.getWorldPosition(new Vector3()));
      const monitorInFigure = figure.worldToLocal(monitor.getWorldPosition(new Vector3()));
      expect(Math.sign(eyeInFigure.z), `${agent.id} faces the monitor`).toBe(Math.sign(monitorInFigure.z));
      expect(desk.getObjectByName('privacy-panel'), agent.id).toBeDefined();
      expect(desk.getObjectByName('mouse'), agent.id).toBeDefined();
      const accessory = desk.getObjectByName('role-accessory');
      expect(accessory, agent.id).toBeDefined();
      expect(accessory!.children.length, agent.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('disposes every keyboard instance buffer with the office model', () => {
    model = createOfficeModel();
    let disposed = 0;
    model.root.traverse(object => {
      if (object instanceof InstancedMesh) object.addEventListener('dispose', () => disposed++);
    });
    disposeOfficeModel(model);
    model = undefined;
    expect(disposed).toBe(agents.length);
  });

  it('varies workstation finishes and storage arrangements by role', () => {
    model = createOfficeModel();
    const finishes = new Set<string>();
    const storageSides = new Set<number>();
    for (const agent of agents) {
      const desk = model.root.getObjectByName(`workstation-${agent.id}`)!;
      const desktop = desk.getObjectByName('desktop') as Mesh;
      const drawer = desk.getObjectByName('drawer') as Mesh;
      finishes.add((desktop.material as MeshStandardMaterial).uuid);
      storageSides.add(Math.sign(drawer.position.x));
    }
    expect(finishes.size).toBeGreaterThanOrEqual(3);
    expect(storageSides).toEqual(new Set([-1, 1]));
  });

  it('distinguishes team zones with their own thresholds and floor palettes', () => {
    model = createOfficeModel();
    const development = model.root.getObjectByName('area-development')!;
    const delivery = model.root.getObjectByName('area-delivery')!;
    expect(development.getObjectByName('team-threshold')).toBeDefined();
    expect(delivery.getObjectByName('team-threshold')).toBeDefined();
    const developmentRug = development.getObjectByName('team-rug') as Mesh;
    const deliveryRug = delivery.getObjectByName('team-rug') as Mesh;
    expect((developmentRug.material as MeshStandardMaterial).color.getHex())
      .not.toBe((deliveryRug.material as MeshStandardMaterial).color.getHex());
  });

  it('gives Web Delivery a visible fulfillment station', () => {
    model = createOfficeModel();
    const station = model.root.getObjectByName('delivery-fulfillment');
    expect(station).toBeDefined();
    expect(station!.getObjectByName('printer')).toBeDefined();
    expect(station!.getObjectByName('delivery-parcel')).toBeDefined();
  });

  it('instances repeated keyboard keys to limit workstation draw calls', () => {
    model = createOfficeModel();
    for (const agent of agents) {
      const desk = model.root.getObjectByName(`workstation-${agent.id}`)!;
      const keys = desk.getObjectByName('keys');
      expect(keys, agent.id).toBeInstanceOf(InstancedMesh);
      expect((keys as InstancedMesh).count, agent.id).toBe(24);
    }
  });
});
