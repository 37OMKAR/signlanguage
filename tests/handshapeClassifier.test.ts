import { describe, it, expect } from "vitest";
import { classifyLetter, type Landmark } from "../src/signs/handshapeClassifier";

// Build a synthetic 21-landmark hand pose. The classifier only looks at
// relative distances from the wrist, so any consistent coordinate frame
// works.
function makeHand(fingers: {
  thumb?: "up" | "tuck";
  index?: "up" | "curl";
  middle?: "up" | "curl";
  ring?: "up" | "curl";
  pinky?: "up" | "curl";
  indexApart?: boolean;   // for U vs V: index/middle tip separation
}): Landmark[] {
  // 21 landmarks initialized at wrist origin.
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  // A curled fingertip sits close to the wrist; an extended one sits far away.
  const yExtended = 0.45;
  const yCurl = 0.10;
  const setFinger = (mcp: number, pip: number, tip: number, xOffset: number, state: "up" | "curl") => {
    // MCP always at knuckle height.
    lm[mcp] = { x: xOffset, y: 0.15, z: 0 };
    if (state === "up") {
      lm[pip] = { x: xOffset, y: 0.28, z: 0 };
      lm[tip] = { x: xOffset, y: yExtended, z: 0 };
    } else {
      lm[pip] = { x: xOffset, y: 0.20, z: 0 };
      lm[tip] = { x: xOffset, y: yCurl, z: 0 };
    }
  };
  setFinger(5, 6, 8,   0.05, fingers.index  ?? "curl");
  setFinger(9, 10, 12, 0.10, fingers.middle ?? "curl");
  setFinger(13, 14, 16,0.15, fingers.ring   ?? "curl");
  setFinger(17, 18, 20,0.20, fingers.pinky  ?? "curl");

  // Thumb: extended sits sideways, tucked sits close to palm.
  if (fingers.thumb === "up") {
    lm[2] = { x: -0.03, y: 0.15, z: 0 };
    lm[3] = { x: -0.10, y: 0.20, z: 0 };
    lm[4] = { x: -0.20, y: 0.25, z: 0 };
  } else {
    lm[2] = { x:  0.02, y: 0.15, z: 0 };
    lm[3] = { x:  0.03, y: 0.16, z: 0 };
    lm[4] = { x:  0.04, y: 0.17, z: 0 };
  }

  // For V pose, push index and middle tips apart on X so tipsTouch is
  // false; for U keep them close.
  if (fingers.index === "up" && fingers.middle === "up" && fingers.indexApart) {
    lm[8]  = { x: -0.05, y: yExtended, z: 0 };
    lm[12] = { x:  0.20, y: yExtended, z: 0 };
  }

  return lm;
}

describe("classifyLetter", () => {
  it("recognises B (flat 4-finger hand)", () => {
    expect(classifyLetter(makeHand({
      thumb: "tuck", index: "up", middle: "up", ring: "up", pinky: "up",
    }))).toBe("B");
  });

  it("recognises W (index+middle+ring up, pinky down)", () => {
    expect(classifyLetter(makeHand({
      thumb: "tuck", index: "up", middle: "up", ring: "up", pinky: "curl",
    }))).toBe("W");
  });

  it("recognises V (index+middle up and apart)", () => {
    expect(classifyLetter(makeHand({
      thumb: "tuck", index: "up", middle: "up", indexApart: true,
    }))).toBe("V");
  });

  it("recognises U (index+middle up and touching)", () => {
    expect(classifyLetter(makeHand({
      thumb: "tuck", index: "up", middle: "up",
    }))).toBe("U");
  });

  it("recognises Y (thumb+pinky, others curled)", () => {
    expect(classifyLetter(makeHand({
      thumb: "up", pinky: "up",
    }))).toBe("Y");
  });

  it("recognises I (only pinky extended)", () => {
    expect(classifyLetter(makeHand({
      thumb: "tuck", pinky: "up",
    }))).toBe("I");
  });

  it("recognises L (thumb+index perpendicular)", () => {
    expect(classifyLetter(makeHand({
      thumb: "up", index: "up",
    }))).toBe("L");
  });

  it("recognises D (index only, thumb tucked)", () => {
    expect(classifyLetter(makeHand({
      thumb: "tuck", index: "up",
    }))).toBe("D");
  });

  it("returns empty for a completely undefined pose (short landmark list)", () => {
    expect(classifyLetter([])).toBe("");
  });
});
