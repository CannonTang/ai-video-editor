import { describe, expect, it } from "vitest";

import { VECTOR_ASSETS, VECTOR_CATEGORIES } from "./vectorAssets.js";

describe("built-in vector assets", () => {
  it("replaces decorative stickers with practical creator graphics", () => {
    expect(VECTOR_ASSETS).toHaveLength(18);
    expect(VECTOR_ASSETS.map((asset) => asset.id)).not.toContain("vector-gradient-orb");
    expect(VECTOR_ASSETS.map((asset) => asset.id)).toEqual(expect.arrayContaining([
      "vector-focus-arrow",
      "vector-data-chart",
      "vector-subtitle-bar",
      "vector-motion-lines",
      "vector-circle-mask",
      "vector-organic-mask",
    ]));
  });

  it("keeps every category populated with transparent scalable SVGs", () => {
    const categoryIds = VECTOR_CATEGORIES.filter((category) => category.id !== "all").map((category) => category.id);
    for (const category of categoryIds) {
      expect(VECTOR_ASSETS.some((asset) => asset.category === category)).toBe(true);
    }
    for (const asset of VECTOR_ASSETS) {
      expect(asset.kind).toBe("vector");
      expect(asset.src).toMatch(/^data:image\/svg\+xml/);
      expect(decodeURIComponent(asset.src)).toContain('fill="transparent"');
      expect(asset.tags.length).toBeGreaterThan(3);
      expect(asset.vectorColorSlots.primary.length).toBeGreaterThan(0);
      expect(asset.vectorColorSlots.secondary.length).toBeGreaterThan(0);
      expect(asset.vectorColorSlots.accent.length).toBeGreaterThan(0);
    }
  });

  it("marks mask-ready shapes for future direct mask placement", () => {
    const masks = VECTOR_ASSETS.filter((asset) => asset.category === "mask");
    expect(masks).toHaveLength(4);
    expect(masks.every((asset) => asset.maskShape)).toBe(true);
  });
});
