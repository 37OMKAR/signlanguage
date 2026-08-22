import { describe, it, expect } from "vitest";
import { loadSign, getEntry, hasSign, auditCommercialSafety } from "../src/signs/loader";

describe("sign loader", () => {
  it("finds known letters", () => {
    expect(hasSign("A")).toBe(true);
    expect(hasSign("Z")).toBe(true);
  });

  it("returns frames for a known sign", async () => {
    const frames = await loadSign("HELLO");
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0]).toHaveProperty("t_ms");
    expect(frames[0]).toHaveProperty("bones");
  });

  it("falls back to fingerspelling for unknown words", async () => {
    const frames = await loadSign("XYZW");
    expect(frames.length).toBeGreaterThan(0);
    // fingerspelling four letters -> at least 4 keyframes total (each letter
    // has 2, so >= 8).
    expect(frames.length).toBeGreaterThanOrEqual(8);
  });

  it("dictionary entry exposes provenance", () => {
    const e = getEntry("YES");
    expect(e?.provenance).toBe("hand-authored");
    expect(e?.commercial_safe).toBe(true);
  });

  it("correctly flags real-motion-capture-derived signs as commercially unsafe until license-verified", () => {
    // HELLO's finger curls were retargeted from the AI4Bharat INCLUDE
    // dataset (repackaged as MediaPipe landmarks on Kaggle). The
    // repackaging is tagged MIT, but that may not clear the underlying
    // original dataset's own terms -- deliberately marked unsafe until a
    // human verifies the license chain. This test is a regression check
    // that the audit mechanism actually catches this, not that zero
    // unsafe signs exist (which stopped being true the moment we started
    // using real third-party motion data instead of only hand-authoring).
    const e = getEntry("HELLO");
    expect(e?.provenance).toBe("kaggle-include-isl");
    expect(e?.commercial_safe).toBe(false);

    const r = auditCommercialSafety();
    expect(r.unsafe).toContain("HELLO");
  });
});
