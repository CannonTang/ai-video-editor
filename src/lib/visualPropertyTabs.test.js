import { describe, expect, it } from "vitest";
import { getVisualPropertyTabIds } from "./visualPropertyTabs.js";

describe("visual property tabs", () => {
  it("keeps image, video, and vector inspectors distinct", () => {
    expect(getVisualPropertyTabIds()).toEqual([
      "transform", "mask", "filters", "animation", "repair",
    ]);
    expect(getVisualPropertyTabIds({ isVideo: true })).toEqual([
      "transform", "mask", "filters", "animation", "speed", "repair",
    ]);
    expect(getVisualPropertyTabIds({ isVector: true, hasVectorEditor: true })).toEqual([
      "transform", "vector", "animation",
    ]);
  });

  it("adds timing only for overlays", () => {
    expect(getVisualPropertyTabIds({ isOverlay: true })).toEqual([
      "transform", "mask", "filters", "animation", "timing",
    ]);
    expect(getVisualPropertyTabIds({
      isVector: true,
      isOverlay: true,
      hasVectorEditor: true,
    })).toEqual(["transform", "vector", "animation", "timing"]);
  });
});
