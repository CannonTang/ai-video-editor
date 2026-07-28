import { describe, expect, it } from "vitest";

import { EFFECT_OPTIONS, FILTER_OPTIONS, VISUAL_STYLE_OPTIONS } from "./editor.js";

describe("editor filter catalog", () => {
  it("exposes the complete filter catalog to visual panels and renderers", () => {
    expect(FILTER_OPTIONS).toHaveLength(13);
    expect(new Set(FILTER_OPTIONS.map((option) => option.id)).size).toBe(FILTER_OPTIONS.length);
    expect(FILTER_OPTIONS).toEqual(expect.arrayContaining(EFFECT_OPTIONS));
    expect(VISUAL_STYLE_OPTIONS).toBe(FILTER_OPTIONS);
  });
});
