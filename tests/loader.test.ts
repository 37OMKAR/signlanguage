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
    // The commercial-safety audit mechanism is a hard requirement: we
    // must never ship any entry that traces back to a license-restricted
    // source. Regression-check that (a) the audit actually returns a
    // non-empty unsafe list once at least one such entry exists in the
    // dictionary (INCLUDE-derived entries, which we correctly flag as
    // commercial_safe: false because the Kaggle repackaging's MIT tag
    // doesn't clear the underlying AI4Bharat original), and (b) every
    // entry the audit returns actually IS commercial_safe: false in the
    // dictionary (not a false positive).
    const r = auditCommercialSafety();
    expect(r.unsafe.length).toBeGreaterThan(0);
    for (const gloss of r.unsafe) {
      const e = getEntry(gloss);
      expect(e?.commercial_safe).toBe(false);
    }
  });
});
