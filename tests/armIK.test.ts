import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { solveArm, resolveAnchor, ANCHORS, type ArmRig } from "../src/signs/armIK";

// Minimal right arm hanging down: shoulder -> elbow -> wrist, bones' +Y
// runs down the limb like the Godette rig.
function makeArm() {
  const upper = new THREE.Bone();
  const lower = new THREE.Bone();
  const hand = new THREE.Bone();
  upper.position.set(-0.11, 1.31, 0.03);
  lower.position.set(0, 0.2, 0); // child offset along local +Y
  hand.position.set(0, 0.22, 0);
  // Rig convention: +Y points down the arm, so flip the root so +Y is world -Y.
  upper.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  upper.add(lower);
  lower.add(hand);
  new THREE.Group().add(upper);
  upper.updateWorldMatrix(true, true);
  const rig: ArmRig = {
    upper, lower, hand,
    restUpper: upper.quaternion.clone(),
    restLower: lower.quaternion.clone(),
  };
  return rig;
}

const wrist = (rig: ArmRig) => rig.hand.getWorldPosition(new THREE.Vector3());

describe("solveArm", () => {
  it("places the wrist on a reachable target", () => {
    const rig = makeArm();
    const target = new THREE.Vector3(-0.02, 1.4, 0.2);
    solveArm(rig, target, "R", 1);
    rig.upper.updateWorldMatrix(true, true);
    expect(wrist(rig).distanceTo(target)).toBeLessThan(0.005);
  });

  it("keeps segment lengths (no stretching)", () => {
    const rig = makeArm();
    solveArm(rig, new THREE.Vector3(0.1, 1.45, 0.25), "R", 1);
    rig.upper.updateWorldMatrix(true, true);
    const s = rig.upper.getWorldPosition(new THREE.Vector3());
    const e = rig.lower.getWorldPosition(new THREE.Vector3());
    expect(s.distanceTo(e)).toBeCloseTo(0.2, 3);
    expect(e.distanceTo(wrist(rig))).toBeCloseTo(0.22, 3);
  });

  it("clamps unreachable targets to arm length without NaN", () => {
    const rig = makeArm();
    solveArm(rig, new THREE.Vector3(-0.11, 1.31, 3), "R", 1);
    rig.upper.updateWorldMatrix(true, true);
    const w = wrist(rig);
    expect(Number.isFinite(w.x + w.y + w.z)).toBe(true);
    const s = rig.upper.getWorldPosition(new THREE.Vector3());
    expect(s.distanceTo(w)).toBeLessThanOrEqual(0.42);
  });

  it("weight 0 leaves the rest pose", () => {
    const rig = makeArm();
    const before = wrist(rig).clone();
    solveArm(rig, new THREE.Vector3(0, 1.4, 0.2), "R", 0);
    rig.upper.updateWorldMatrix(true, true);
    expect(wrist(rig).distanceTo(before)).toBeLessThan(1e-6);
  });
});

describe("resolveAnchor", () => {
  it("mirrors x for the left hand and applies offsets", () => {
    const head = new THREE.Vector3(0, 1.46, 0.04);
    const r = resolveAnchor({ anchor: "ear", off: [0.01, 0, 0] }, head, "R", new THREE.Vector3());
    const l = resolveAnchor({ anchor: "ear", off: [0.01, 0, 0] }, head, "L", new THREE.Vector3());
    expect(r.x).toBeCloseTo(ANCHORS.ear[0] + 0.01);
    expect(l.x).toBeCloseTo(-(ANCHORS.ear[0] + 0.01));
    expect(r.y).toBeCloseTo(l.y);
  });
});
