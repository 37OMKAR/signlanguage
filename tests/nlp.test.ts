import { describe, it, expect } from "vitest";
import { ruleBasedGloss } from "../src/nlp/glossRules";

describe("ruleBasedGloss", () => {
  it("drops articles and copulas", () => {
    const g = ruleBasedGloss("The cat is happy");
    expect(g).toEqual(["CAT", "HAPPY"]);
  });

  it("maps first-person pronouns", () => {
    expect(ruleBasedGloss("I am tired")).toEqual(["ME", "TIRED"]);
  });

  it("moves time expressions to the front", () => {
    expect(ruleBasedGloss("I went to the store yesterday")).toEqual([
      "YESTERDAY", "ME", "went", "STORE",
    ].map((s) => s.toUpperCase()));
  });

  it("appends QUESTION for yes/no questions", () => {
    const g = ruleBasedGloss("Are you happy?");
    expect(g).toContain("QUESTION");
    expect(g).toContain("YOU");
    expect(g).toContain("HAPPY");
  });

  it("places wh-words at the end", () => {
    const g = ruleBasedGloss("What is your name?");
    expect(g[g.length - 1]).toBe("WHAT");
  });

  it("converts negation to NO", () => {
    const g = ruleBasedGloss("I do not like it");
    expect(g).toContain("NO");
    expect(g).toContain("ME");
  });

  it("maps thanks to THANK-YOU", () => {
    expect(ruleBasedGloss("thanks")).toEqual(["THANK-YOU"]);
  });

  it("returns empty array for empty input", () => {
    expect(ruleBasedGloss("")).toEqual([]);
    expect(ruleBasedGloss("   ")).toEqual([]);
  });
});
