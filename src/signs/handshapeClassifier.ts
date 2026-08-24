// Rule-based ASL alphabet classifier over MediaPipe hand landmarks.
//
// Input: 21 landmarks in MediaPipe order:
//   0    = wrist
//   1-4  = thumb (CMC, MCP, IP, TIP)
//   5-8  = index (MCP, PIP, DIP, TIP)
//   9-12 = middle
//   13-16= ring
//   17-20= pinky
//
// Output: a single uppercase A-Z string, or "" if we can't confidently
// classify the pose. This is deliberately a first-pass heuristic
// classifier (extended/curled per finger + thumb position + tip pairs);
// it doesn't attempt to distinguish every ambiguous pair (M/N, U/V/R,
// K/P) or the two dynamic letters (J, Z). Users who need higher fidelity
// would want a proper trained model -- planned follow-up.

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

const WRIST = 0;
const T_TIP = 4, T_MCP = 2;
const I_TIP = 8, I_PIP = 6, I_MCP = 5;
const M_TIP = 12, M_PIP = 10, M_MCP = 9;
const R_TIP = 16, R_PIP = 14, R_MCP = 13;
const P_TIP = 20, P_PIP = 18, P_MCP = 17;

function dist(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.hypot(dx, dy, dz);
}

// A finger is "extended" when its tip is farther from the wrist than its
// PIP joint is. Robust to hand rotation because it's a distance ratio,
// not a Y coordinate.
function isExtended(lm: Landmark[], tip: number, pip: number, mcp: number): boolean {
  const w = lm[WRIST];
  const tipD = dist(w, lm[tip]);
  const pipD = dist(w, lm[pip]);
  const mcpD = dist(w, lm[mcp]);
  // Tip further from wrist than PIP AND MCP -> extended.
  return tipD > pipD && tipD > mcpD * 1.15;
}

// Thumb "up" is when its tip is roughly opposite to the palm plane (not
// tucked under the palm). Cheap check: thumb tip further from wrist than
// thumb MCP by a comfortable margin.
function thumbExtended(lm: Landmark[]): boolean {
  const w = lm[WRIST];
  return dist(w, lm[T_TIP]) > dist(w, lm[T_MCP]) * 1.25;
}

// True if two tip landmarks are touching (or near-touching), normalized
// by the palm size (wrist -> middle MCP distance) so the check works at
// any camera distance.
function tipsTouch(lm: Landmark[], a: number, b: number, thresh = 0.35): boolean {
  const palm = dist(lm[WRIST], lm[M_MCP]);
  if (palm < 1e-6) return false;
  return dist(lm[a], lm[b]) / palm < thresh;
}

export function classifyLetter(lm: Landmark[]): string {
  if (!lm || lm.length < 21) return "";

  const idx = isExtended(lm, I_TIP, I_PIP, I_MCP);
  const mid = isExtended(lm, M_TIP, M_PIP, M_MCP);
  const rin = isExtended(lm, R_TIP, R_PIP, R_MCP);
  const pin = isExtended(lm, P_TIP, P_PIP, P_MCP);
  const thu = thumbExtended(lm);

  // ---- 4 fingers extended ----
  // B: flat hand, all four fingers up, thumb tucked across palm.
  if (idx && mid && rin && pin && !thu) return "B";
  // 5-hand / B variant with thumb out isn't a distinct letter; treat as B.
  if (idx && mid && rin && pin && thu) return "B";

  // ---- 3 fingers extended (index+middle+ring) ----
  // W: index + middle + ring up, pinky down.
  if (idx && mid && rin && !pin) return "W";
  // F: thumb + index touching, other 3 up.  (thumb+index+middle+ring+pinky check)
  //   Handled below when idx/mid/rin/pin bit patterns suggest it.

  // ---- 2 fingers extended ----
  if (idx && mid && !rin && !pin) {
    // Distance between index tip and middle tip: touching -> U, apart -> V.
    if (tipsTouch(lm, I_TIP, M_TIP, 0.3)) return "U";
    return "V";
  }
  // K: index + middle up in a V but thumb between them (crotch).
  //   (would need thumb-between check -- rough heuristic uses V for now.)
  // H: index + middle out horizontally + touching -- also collapses to U in our simple model.

  // R: index + middle crossed. Detect by checking if middle tip is to the
  // "left" of index PIP relative to their MCPs -- landmark X of middle
  // tip crosses over index. Only a rough check.
  if (idx && mid && !rin && !pin) {
    if (Math.sign(lm[I_TIP].x - lm[I_MCP].x) !== Math.sign(lm[M_TIP].x - lm[M_MCP].x)) return "R";
  }

  // L: thumb + index only, thumb roughly perpendicular to index.
  if (idx && !mid && !rin && !pin && thu) return "L";
  // D: index up, thumb touches curled middle/ring/pinky fingertips.
  if (idx && !mid && !rin && !pin && !thu) return "D";

  // Y: thumb + pinky only.
  if (!idx && !mid && !rin && pin && thu) return "Y";
  // I: pinky only.
  if (!idx && !mid && !rin && pin && !thu) return "I";

  // ---- No fingers extended ----
  if (!idx && !mid && !rin && !pin) {
    // A: fist, thumb along the side (thumb NOT crossing palm).
    if (thu) {
      // Distinguish A from a numeric "0" / O.
      // O: fingertips touch thumb tip to form a circle.
      if (tipsTouch(lm, T_TIP, I_TIP, 0.3) && tipsTouch(lm, T_TIP, M_TIP, 0.4)) return "O";
      // S: fist, thumb WRAPPED across front (thumb tip near middle finger MCP).
      if (dist(lm[T_TIP], lm[M_MCP]) < dist(lm[WRIST], lm[M_MCP]) * 0.5) return "S";
      return "A";
    }
    return "E";  // fist, thumb bent in front (looks similar to S at low fidelity)
  }

  // C: partially curled fingers, thumb curved to meet them from the side.
  if (!idx && !mid && !rin && !pin && !thu) return "C";  // (secondary fallback)

  // G: index pointing sideways from a fist.
  //   Approximated as: only index extended, thumb extended.
  if (idx && !mid && !rin && !pin && thu) return "L"; // same as L in our model

  // 3-fingers with thumb: no clean ASL letter without dynamic motion.

  return "";  // unclear -- classifier declines to guess
}
