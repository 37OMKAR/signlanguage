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

  it("filters signs by chosen sign language and fingerspells cross-language misses", async () => {
    // HELLO exists as a signmatic-asl entry (commercial_safe, ASL).
    // RESTAURANT only exists as a kaggle-include-isl entry (ISL).
    expect(hasSign("HELLO", "ASL")).toBe(true);
    expect(hasSign("HELLO", "ISL")).toBe(false);   // ASL-only, no ISL variant
    expect(hasSign("RESTAURANT", "ISL")).toBe(true);
    expect(hasSign("RESTAURANT", "ASL")).toBe(false); // ISL-only, no ASL variant
    expect(hasSign("HELLO", "any")).toBe(true);

    // loadSign should return the native frames when language matches, and
    // fall through to fingerspelling when it doesn't.
    const helloAsl = await loadSign("HELLO", "ASL");
    const helloIsl = await loadSign("HELLO", "ISL"); // fingerspelled H-E-L-L-O
    expect(helloAsl.length).toBeGreaterThan(0);
    expect(helloIsl.length).toBeGreaterThan(0);
    // Fingerspelled version stitches per-letter frames -- always has more
    // than a single-word sign for a 5-letter word.
    expect(helloIsl.length).toBeGreaterThan(helloAsl.length);
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
