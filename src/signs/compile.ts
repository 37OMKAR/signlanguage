// Compile authored (degree-based, human-friendly) frames into runtime
// quaternion frames the player can drive directly.
import * as THREE from "three";
import type {
  AuthoredEntry, AuthoredFrame, FingerName, Quat, SignEntry, SignFrame, Vec3,
} from "../types";

const DEG = Math.PI / 180;

// Curl around local X-axis (finger flexion is negative-X for our rig).
function curlQuat(deg: number): Quat {
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -deg * DEG,
  );
  return [q.x, q.y, q.z, q.w];
}

function eulerQuat(xd: number, yd: number, zd: number): Quat {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(xd * DEG, yd * DEG, zd * DEG, "XYZ"),
  );
  return [q.x, q.y, q.z, q.w];
}

// Given a finger name and its 2- or 3-segment curl array, emit bone
// quaternions keyed as `{finger}0`, `{finger}1`, `{finger}2`.
function fingerBones(
  finger: FingerName,
  curls: number[],
): Record<string, Quat> {
  const out: Record<string, Quat> = {};
  const max = finger.endsWith("thumb") ? 2 : 3;
  for (let i = 0; i < max; i++) {
    const deg = curls[i] ?? 0;
    out[`${finger}${i}`] = curlQuat(deg);
  }
  return out;
}

function compileFrame(af: AuthoredFrame): SignFrame {
  const bones: Record<string, Quat> = {};
  const positions: Record<string, Vec3> = {};

  if (af.curls) {
    for (const [finger, curls] of Object.entries(af.curls)) {
      Object.assign(bones, fingerBones(finger as FingerName, curls ?? []));
    }
  }
  if (af.R_palm_deg) {
    bones["R_palm"] = eulerQuat(...af.R_palm_deg);
  }
  if (af.L_palm_deg) {
    bones["L_palm"] = eulerQuat(...af.L_palm_deg);
  }
  if (af.R_palm_pos) positions["R_palm"] = af.R_palm_pos;
  if (af.L_palm_pos) positions["L_palm"] = af.L_palm_pos;

  return {
    t_ms: af.t_ms,
    bones,
    positions: Object.keys(positions).length ? positions : undefined,
    blendshapes: af.blendshapes,
  };
}

export function compileEntry(e: AuthoredEntry): SignEntry {
  return {
    gloss: e.gloss,
    duration_ms: e.duration_ms,
    frames: e.frames.map(compileFrame),
    provenance: e.provenance,
    commercial_safe: e.commercial_safe,
    notes: e.notes,
  };
}

export function compileDictionary(
  raw: Record<string, AuthoredEntry>,
): Record<string, SignEntry> {
  const out: Record<string, SignEntry> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = compileEntry(v);
  return out;
}
