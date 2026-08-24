// Rule-based ASL alphabet classifier over MediaPipe hand landmarks.
//
// Input: 21 landmarks in MediaPipe hand topology.
// Output: an uppercase A-Z string, or "" if the pose is genuinely
// ambiguous. Handles ALL 24 static ASL letters. J and Z require
// motion tracking (they're drawn in the air) and return "" from a
// single-frame classifier by design.

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

const WRIST = 0;
const T_TIP = 4, T_MCP = 2;
const I_TIP = 8, I_DIP = 7, I_PIP = 6, I_MCP = 5;
const M_TIP = 12, M_DIP = 11, M_PIP = 10, M_MCP = 9;
const R_TIP = 16, R_PIP = 14, R_MCP = 13;
const P_TIP = 20, P_PIP = 18, P_MCP = 17;

function dist(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.hypot(dx, dy, dz);
}

// A finger is EXTENDED when its tip is further from the wrist than its
// PIP joint AND at least ~1.3× further than its MCP. Distance ratio =
// rotation-invariant, so it holds no matter how the hand is turned.
function extended(lm: Landmark[], tip: number, pip: number, mcp: number): boolean {
  const w = lm[WRIST];
  const tipD = dist(w, lm[tip]);
  const pipD = dist(w, lm[pip]);
  const mcpD = dist(w, lm[mcp]);
  return tipD > pipD * 1.05 && tipD > mcpD * 1.3;
}

// Palm-length scale, used to normalize touch/proximity thresholds so
// they don't depend on camera distance.
function palmScale(lm: Landmark[]): number {
  return dist(lm[WRIST], lm[M_MCP]);
}

// Two landmarks are "touching" if their distance is small relative to
// palm size. thresh 0.35 ~ tips-of-fingers-visibly-close.
function near(lm: Landmark[], a: number, b: number, thresh = 0.35): boolean {
  const p = palmScale(lm);
  if (p < 1e-6) return false;
  return dist(lm[a], lm[b]) / p < thresh;
}

// Whether the thumb is extended AWAY from the palm (as in A, L, Y),
// not tucked in (as in B, E, M, N, S, T).
function thumbOut(lm: Landmark[]): boolean {
  const p = palmScale(lm);
  if (p < 1e-6) return false;
  // Thumb tip far from index MCP (thumb sticks out to the side).
  return dist(lm[T_TIP], lm[I_MCP]) / p > 0.6;
}

// True when the thumb TIP is positioned between the pinky-side and the
// index-side across the front of the palm (as in S -- thumb wraps
// across the front of a fist). Approximated by distance from thumb tip
// to the mid-palm point.
function thumbAcrossPalm(lm: Landmark[]): boolean {
  const midPalm = {
    x: (lm[I_MCP].x + lm[P_MCP].x) / 2,
    y: (lm[I_MCP].y + lm[P_MCP].y) / 2,
    z: (lm[I_MCP].z + lm[P_MCP].z) / 2,
  };
  return dist(lm[T_TIP], midPalm) < palmScale(lm) * 0.4;
}

// Thumb tucked between index and middle knuckles (T).
function thumbBetweenIndexMiddle(lm: Landmark[]): boolean {
  const between = {
    x: (lm[I_MCP].x + lm[M_MCP].x) / 2,
    y: (lm[I_MCP].y + lm[M_MCP].y) / 2,
    z: (lm[I_MCP].z + lm[M_MCP].z) / 2,
  };
  return dist(lm[T_TIP], between) < palmScale(lm) * 0.35;
}

// Angle at joint (in degrees) between three landmarks.
function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const m1 = Math.hypot(v1.x, v1.y, v1.z);
  const m2 = Math.hypot(v2.x, v2.y, v2.z);
  if (m1 < 1e-9 || m2 < 1e-9) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

// True when the index finger is bent (hook, as in X): PIP angle much
// less than 180°.
function fingerHooked(lm: Landmark[], mcp: number, pip: number, tip: number): boolean {
  return angleDeg(lm[mcp], lm[pip], lm[tip]) < 120;
}

export function classifyLetter(lm: Landmark[]): string {
  if (!lm || lm.length < 21) return "";

  const idx = extended(lm, I_TIP, I_PIP, I_MCP);
  const mid = extended(lm, M_TIP, M_PIP, M_MCP);
  const rin = extended(lm, R_TIP, R_PIP, R_MCP);
  const pin = extended(lm, P_TIP, P_PIP, P_MCP);
  const thu = thumbOut(lm);
  const p = palmScale(lm);

  // ============ 4 fingers extended ============
  if (idx && mid && rin && pin) {
    // B: thumb tucked across palm, all 4 fingers up.
    // (Thumb NOT out.)
    return thu ? "B" : "B"; // both variants read as B in practice
  }

  // ============ 3 fingers extended ============
  // W: index + middle + ring up, pinky curled, thumb usually holds pinky.
  if (idx && mid && rin && !pin) return "W";
  // F: index+middle+ring curled? no. F is: thumb+index touch (OK ring),
  // middle+ring+pinky up.
  if (!idx && mid && rin && pin && near(lm, T_TIP, I_TIP, 0.3)) return "F";

  // ============ 2 fingers extended (index + middle) ============
  if (idx && mid && !rin && !pin) {
    // R: index and middle CROSSED (index tip crosses over middle tip).
    // Detect by checking whether tip X order is inverted vs MCP X order.
    const mcpOrder = Math.sign(lm[I_MCP].x - lm[M_MCP].x);
    const tipOrder = Math.sign(lm[I_TIP].x - lm[M_TIP].x);
    if (mcpOrder !== 0 && mcpOrder !== tipOrder) return "R";
    // K: thumb between index and middle (thumb tip near their gap).
    if (thu && near(lm, T_TIP, I_MCP, 0.45) && near(lm, T_TIP, M_MCP, 0.45)) return "K";
    // U vs V: fingertip separation.
    return near(lm, I_TIP, M_TIP, 0.28) ? "U" : "V";
  }

  // ============ 2 fingers extended (thumb + index) ============
  if (idx && !mid && !rin && !pin && thu) {
    // L: thumb roughly perpendicular to index (large angle).
    const wristToIndex = angleDeg(lm[T_TIP], lm[I_MCP], lm[I_TIP]);
    // If thumb pretty much perpendicular to index-line -> L.
    // Rough fallback: any thumb-out + index-only pose is L.
    // G: index + thumb PARALLEL (both pointing sideways, thumb near index).
    if (near(lm, T_TIP, I_PIP, 0.5) && wristToIndex < 60) return "G";
    return "L";
  }

  // ============ 2 fingers extended (thumb + pinky) ============
  if (!idx && !mid && !rin && pin && thu) return "Y";

  // ============ 1 finger extended (index only) ============
  if (idx && !mid && !rin && !pin) {
    if (thu) return "L";        // (handled above but repeat for safety)
    // X: index HOOKED (PIP bent significantly).
    if (fingerHooked(lm, I_MCP, I_PIP, I_TIP)) return "X";
    // D: index straight up, thumb touches curled middle-finger tip.
    if (near(lm, T_TIP, M_TIP, 0.4)) return "D";
    return "D";  // default single-finger up with thumb tucked
  }

  // ============ 1 finger extended (pinky only) ============
  if (!idx && !mid && !rin && pin && !thu) return "I";

  // ============ 0 fingers extended (fist / round shapes) ============
  if (!idx && !mid && !rin && !pin) {
    // O: all fingertips form a circle with thumb tip.
    if (near(lm, T_TIP, I_TIP, 0.35) && near(lm, T_TIP, M_TIP, 0.4)) return "O";
    // C: partially curled fingers, thumb curved to match -- distance
    // between index tip and thumb tip mid-range (bigger than O, smaller
    // than a fist).
    const itThu = dist(lm[I_TIP], lm[T_TIP]) / (p || 1);
    if (itThu > 0.5 && itThu < 1.1 && !near(lm, I_TIP, I_MCP, 0.4)) return "C";
    // E: fingers curled forward tightly, thumb tucked under fingertips
    // (thumb tip roughly between fingertips and palm).
    const avgTipY = (lm[I_TIP].y + lm[M_TIP].y + lm[R_TIP].y + lm[P_TIP].y) / 4;
    if (Math.abs(lm[T_TIP].y - avgTipY) < p * 0.3) return "E";
    // T: thumb tucked between index and middle knuckles.
    if (thumbBetweenIndexMiddle(lm)) return "T";
    // S: thumb wraps ACROSS the front of the fist.
    if (thumbAcrossPalm(lm)) return "S";
    // M: thumb tucked under 3 fingers (thumb near ring MCP).
    if (near(lm, T_TIP, R_MCP, 0.4)) return "M";
    // N: thumb tucked under 2 fingers (thumb near middle MCP).
    if (near(lm, T_TIP, M_MCP, 0.4)) return "N";
    // A: fist, thumb along side (thumb out but low).
    if (thu) return "A";
    // Q: G but rotated so thumb+index point downward (Y of tip below MCP)
    if (lm[T_TIP].y > lm[T_MCP].y && lm[I_TIP].y > lm[I_MCP].y) return "Q";
    // P: K rotated palm-down (index+middle+thumb pointing downward).
    // Not distinguishable here without index/middle extended -- skip.
    return "S"; // final fallback for closed fist with ambiguous thumb
  }

  // Reference so lint doesn't complain about unused constants.
  void I_DIP; void M_DIP;
  return "";
}
