import { describe, it, expect } from "vitest";
import { compileEntry } from "../src/signs/compile";
import type { AuthoredEntry } from "../src/types";

describe("compileEntry", () => {
  it("compiles curl degrees into quaternion bones", () => {
    const auth: AuthoredEntry = {
      gloss: "TEST",
      duration_ms: 100,
      provenance: "hand-authored",
      commercial_safe: true,
      frames: [
        { t_ms: 0, curls: { R_index: [0, 0, 0] } },
        { t_ms: 100, curls: { R_index: [90, 90, 90] } },
      ],
    };
    const c = compileEntry(auth);
    expect(c.frames).toHaveLength(2);
    const zero = c.frames[0].bones["R_index0"];
    expect(zero[0]).toBeCloseTo(0, 5);
    expect(zero[1]).toBeCloseTo(0, 5);
    expect(zero[2]).toBeCloseTo(0, 5);
    expect(zero[3]).toBeCloseTo(1, 5);
    // 90 deg curl around -X: q = (sin(-45)=-0.707, 0, 0, cos(-45)=0.707)
    const q = c.frames[1].bones["R_index0"];
    expect(q[0]).toBeCloseTo(-0.7071, 3);
    expect(q[3]).toBeCloseTo(0.7071, 3);
  });

  it("emits palm Euler rotation as a quaternion", () => {
    const auth: AuthoredEntry = {
      gloss: "T2", duration_ms: 100,
      provenance: "hand-authored", commercial_safe: true,
      frames: [{ t_ms: 0, R_palm_deg: [0, 0, 90] }],
    };
    const c = compileEntry(auth);
    const q = c.frames[0].bones["R_palm"];
    expect(q[2]).toBeCloseTo(0.7071, 3);
    expect(q[3]).toBeCloseTo(0.7071, 3);
  });
});
