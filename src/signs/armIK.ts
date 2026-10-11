// Two-bone arm IK + named body anchors.
//
// Signs name WHERE the wrist goes ("chin", "forehead", "chest") instead of
// hand-tuning shoulder/elbow angles. The solver places the elbow on the
// circle of valid positions (pole vector keeps it down and out, like a real
// elbow) and rotates upper arm and forearm so the wrist lands on the target.
import * as THREE from "three";
import type { ArmTarget, Vec3 } from "../types";

// Anchor positions relative to the head bone's world position, written for
// the RIGHT hand (x < 0 is her right). Mirrored in x for the left hand.
// Metres. The avatar faces +z. Values are wrist targets, i.e. already
// pulled back from the contact point by roughly a hand length.
export const ANCHORS: Record<string, Vec3> = {
  forehead: [0.0, 0.06, 0.17],
  temple:   [-0.08, 0.04, 0.12],
  ear:      [-0.11, -0.03, 0.06],
  cheek:    [-0.06, -0.06, 0.16],
  mouth:    [0.0, -0.07, 0.19],
  chin:     [0.0, -0.11, 0.18],
  neck:     [0.0, -0.16, 0.16],
  chest:    [-0.03, -0.26, 0.20],
  chestLow: [-0.03, -0.36, 0.20],
  // Neutral signing space, in front of the chest / shoulder.
  space:    [-0.08, -0.22, 0.30],
  center:   [0.0, -0.22, 0.28],
  forward:  [-0.08, -0.15, 0.40],
};

export function resolveAnchor(
  t: ArmTarget, head: THREE.Vector3, side: "R" | "L", out: THREE.Vector3,
): THREE.Vector3 {
  const a = ANCHORS[t.anchor] ?? ANCHORS.space;
  const mx = side === "R" ? 1 : -1;
  return out.set(
    head.x + a[0] * mx + t.off[0] * mx,
    head.y + a[1] + t.off[1],
    head.z + a[2] + t.off[2],
  );
}

export interface ArmRig {
  upper: THREE.Object3D;
  lower: THREE.Object3D;
  hand: THREE.Object3D;
  restUpper: THREE.Quaternion;
  restLower: THREE.Quaternion;
}

const S = new THREE.Vector3();
const E = new THREE.Vector3();
const W = new THREE.Vector3();
const U = new THREE.Vector3();
const P = new THREE.Vector3();
const EH = new THREE.Vector3();
const T = new THREE.Vector3();
const C = new THREE.Vector3();
const D = new THREE.Vector3();
const qW = new THREE.Quaternion();
const qP = new THREE.Quaternion();
const qD = new THREE.Quaternion();

// Rotate `bone` (in world space, shortest arc) so its tip direction
// `from` becomes `to`, preserving roll.
function aim(bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  bone.getWorldQuaternion(qW);
  qD.setFromUnitVectors(C.copy(from).normalize(), D.copy(to).normalize());
  qW.premultiply(qD);
  if (bone.parent) {
    bone.parent.getWorldQuaternion(qP).invert();
    qW.premultiply(qP);
  }
  bone.quaternion.copy(qW);
}

// Pose the arm so the wrist reaches `target` (world space). `weight` 0..1
// blends from the rest pose (arm hanging) to the solved pose. Returns the
// wrist position actually reached (clamped to arm length).
export function solveArm(
  arm: ArmRig, target: THREE.Vector3, side: "R" | "L", weight: number,
): THREE.Vector3 {
  const { upper, lower, hand } = arm;
  upper.quaternion.copy(arm.restUpper);
  lower.quaternion.copy(arm.restLower);
  if (weight <= 0) return T.copy(target);

  upper.updateWorldMatrix(true, true);
  upper.getWorldPosition(S);
  lower.getWorldPosition(E);
  hand.getWorldPosition(W);
  const l1 = S.distanceTo(E);
  const l2 = E.distanceTo(W);

  U.subVectors(target, S);
  const raw = U.length();
  const d = THREE.MathUtils.clamp(raw, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  U.normalize();
  T.copy(S).addScaledVector(U, d);

  // Elbow hangs down and out (pole), orthogonalised against the reach axis.
  const out = side === "R" ? -1 : 1;
  P.set(out * 0.55, -1, -0.25);
  P.addScaledVector(U, -P.dot(U)).normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  EH.copy(S).addScaledVector(U, a).addScaledVector(P, h);

  // Upper arm: aim S->E at S->EH.
  aim(upper, E.sub(S), D.subVectors(EH, S));
  upper.updateWorldMatrix(true, true);
  // Forearm: aim E'->W' at E'->T.
  lower.getWorldPosition(E);
  hand.getWorldPosition(W);
  aim(lower, W.sub(E), D.subVectors(T, E));

  if (weight < 1) {
    upper.quaternion.copy(arm.restUpper).slerp(upper.quaternion, weight);
    lower.quaternion.copy(arm.restLower).slerp(lower.quaternion, weight);
  }
  return T;
}
