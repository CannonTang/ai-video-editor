import { describe, expect, it } from "vitest";

import {
  DEFAULT_CAPTION_FONT_ID,
  getCaptionFont,
  getCaptionFontsForLanguage,
  resolveCaptionFontFamily,
  resolveCaptionStyleForSegment,
  resolveCaptionFontWeight,
} from "./captionFonts.js";

const SUPPORTED_LANGUAGES = ["zh", "en", "ja", "ko", "es", "fr", "de", "pt", "th", "vi", "ru"];

describe("caption font catalog", () => {
  it.each(SUPPORTED_LANGUAGES)("offers at least ten non-default fonts for %s", (language) => {
    const fonts = getCaptionFontsForLanguage(language);
    expect(fonts[0].id).toBe(DEFAULT_CAPTION_FONT_ID);
    expect(new Set(fonts.slice(1).map((item) => item.id)).size).toBeGreaterThanOrEqual(10);
  });

  it("falls back safely for unknown font ids", () => {
    expect(getCaptionFont("missing").id).toBe(DEFAULT_CAPTION_FONT_ID);
    expect(resolveCaptionFontFamily("missing")).toContain("system-ui");
    expect(resolveCaptionFontWeight("missing")).toBe(700);
  });

  it("uses the selected font's real family and supported weight", () => {
    expect(resolveCaptionFontFamily("ma-shan-zheng")).toContain('"Ma Shan Zheng"');
    expect(resolveCaptionFontWeight("ma-shan-zheng")).toBe(400);
  });

  it("lets each caption segment override the project fallback font", () => {
    expect(resolveCaptionStyleForSegment(
      { fontId: "default", textColor: "#fff" },
      { id: "caption-2", fontId: "noto-serif-sc" },
    )).toEqual({ fontId: "noto-serif-sc", textColor: "#fff" });
    expect(resolveCaptionStyleForSegment({ fontId: "long-cang" }, { id: "legacy" }).fontId)
      .toBe("long-cang");
  });
});
