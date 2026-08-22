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
    const e = getEntry("HELLO");
    expect(e?.provenance).toBe("hand-authored");
    expect(e?.commercial_safe).toBe(true);
  });

  it("no shipped sign is commercially unsafe", () => {
    const r = auditCommercialSafety();
    expect(r.unsafe).toEqual([]);
    expect(r.unsafeCount).toBe(0);
  });
});
