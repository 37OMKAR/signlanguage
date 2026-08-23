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

  it("keeps each sentence's wh-word/question marker with its own sentence in a paragraph", () => {
    const g = ruleBasedGloss("How are you today? What is your name? I am not happy.");
    // "HOW" must land right after sentence 1's content, not at the very end
    // of the whole paragraph alongside every other sentence's wh-word.
    const howIdx = g.indexOf("HOW");
    const todayIdx = g.indexOf("TODAY");
    const whatIdx = g.indexOf("WHAT");
    const nameIdx = g.indexOf("NAME");
    const noIdx = g.indexOf("NO");
    expect(howIdx).toBeGreaterThan(todayIdx);
    expect(howIdx).toBeLessThan(whatIdx);
    expect(whatIdx).toBeGreaterThan(nameIdx);
    expect(noIdx).toBeGreaterThan(whatIdx);
  });

  it("lemmatizes inflected words toward a base gloss the dictionary has", () => {
    // 'children' should collapse to CHILD, 'meetings' to MEETING (if it
    // exists, otherwise stays as-is), and past-tense verbs stay recognisable.
    // Pattern derived from scanning AslgPc12 English<->gloss pairs.
    const g = ruleBasedGloss("mothers and fathers");
    expect(g).toContain("MOTHER");
    expect(g).toContain("FATHER");
  });

  it("collapses 'I love you' into the single ILY idiom sign", () => {
    expect(ruleBasedGloss("I love you")).toEqual(["I-LOVE-YOU"]);
    expect(ruleBasedGloss("I loved you")).toEqual(["I-LOVE-YOU"]);
    expect(ruleBasedGloss("I do love you")).toEqual(["I-LOVE-YOU"]);
  });

  it("does not collapse unrelated sentences containing love/you separately", () => {
    const g = ruleBasedGloss("You love me");
    expect(g).not.toContain("I-LOVE-YOU");
  });

  it("processes a long multi-sentence paragraph without throwing and preserves sentence count worth of content", () => {
    const paragraph =
      "Hello, how are you today? My name is Godette. Thank you for learning " +
      "sign language with me. Please help me practice. What is your name? " +
      "I am not happy. Sorry for the mistake. Can you help me?";
    const g = ruleBasedGloss(paragraph);
    expect(g.length).toBeGreaterThan(10);
    expect(g).toContain("HELLO");
    expect(g).toContain("THANK-YOU");
    expect(g).toContain("SORRY");
    expect(g).toContain("NO");
  });
});
