import { describe, expect, it } from "vitest";

import { buildEnglishMusicPrompt } from "./aiMusicPrompt.js";

describe("buildEnglishMusicPrompt", () => {
  it("maps localized UI choices to a stable English-only model prompt", () => {
    const prompt = buildEnglishMusicPrompt({
      style: "cinematic",
      mood: "dreamy",
      instrument: "piano",
      bpm: 92,
    });

    expect(prompt).toBe("cinematic soundtrack, dreamy, piano, 92 BPM, instrumental music, clean production, no vocals");
    expect(prompt).toMatch(/^[\x20-\x7E]+$/);
  });

  it("clamps tempo to the supported range", () => {
    expect(buildEnglishMusicPrompt({ style: "ambient", bpm: 999 })).toContain("180 BPM");
  });
});
