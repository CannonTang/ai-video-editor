import { describe, expect, it } from "vitest";

import {
  buildVectorDesignPatch,
  getVectorDesignAppearance,
  getVectorRenderDimension,
  getVectorRenderSource,
  normalizeVectorDesign,
  recolorVectorBody,
} from "./vectorDesign.js";
import { VECTOR_ASSETS } from "./vectorAssets.js";

describe("vector design", () => {
  it("recolors semantic SVG slots including neutral and short hex colors", () => {
    const body = '<path fill="#35ead9"/><path fill="#6c7cff"/><path fill="#fff"/>';
    const recolored = recolorVectorBody(body, {
      paletteEnabled: true,
      primary: "#ff0000",
      secondary: "#00ff00",
      accent: "#0000ff",
    });
    expect(recolored).toContain('fill="#ff0000"');
    expect(recolored).toContain('fill="#00ff00"');
    expect(recolored).toContain('fill="#0000ff"');
  });

  it("lets all three palette controls visibly change every built-in SVG", () => {
    const base = {
      paletteEnabled: true,
      primary: "#123456",
      secondary: "#654321",
      accent: "#abcdef",
    };
    for (const asset of VECTOR_ASSETS) {
      expect(asset.vectorColorSlots.primary.length, asset.id).toBeGreaterThan(0);
      expect(asset.vectorColorSlots.secondary.length, asset.id).toBeGreaterThan(0);
      expect(asset.vectorColorSlots.accent.length, asset.id).toBeGreaterThan(0);
      const rendered = recolorVectorBody(asset.vectorBody, base, asset.vectorColorSlots);
      expect(rendered, asset.id).toContain(base.primary);
      expect(rendered, asset.id).toContain(base.secondary);
      expect(rendered, asset.id).toContain(base.accent);
      expect(recolorVectorBody(asset.vectorBody, { ...base, primary: "#aa0000" }, asset.vectorColorSlots), `${asset.id} primary`).not.toBe(rendered);
      expect(recolorVectorBody(asset.vectorBody, { ...base, secondary: "#00aa00" }, asset.vectorColorSlots), `${asset.id} secondary`).not.toBe(rendered);
      expect(recolorVectorBody(asset.vectorBody, { ...base, accent: "#0000aa" }, asset.vectorColorSlots), `${asset.id} accent`).not.toBe(rendered);
    }
  });

  it("normalizes advanced appearance settings and builds preview/export filters", () => {
    const appearance = getVectorDesignAppearance({
      opacity: 0.65,
      saturation: 140,
      outlineWidth: 3,
      outlineColor: "#ffffff",
      shadowEnabled: true,
      shadowColor: "#000000",
      shadowBlur: 12,
      shadowY: 8,
      blendMode: "screen",
    });
    expect(appearance.opacity).toBe(0.65);
    expect(appearance.cssBlendMode).toBe("screen");
    expect(appearance.compositeOperation).toBe("screen");
    expect(appearance.filter).toContain("saturate(140%)");
    expect(appearance.filter).toContain("drop-shadow(3px 0 0 #ffffff)");
    expect(appearance.filter).toContain("drop-shadow(0px 8px 12px #000000)");
  });

  it("regenerates an editable SVG source when its palette changes", () => {
    const segment = {
      src: "original",
      vectorBody: '<circle fill="#35ead9"/>',
      vectorBackground: "transparent",
    };
    const patch = buildVectorDesignPatch(segment, {
      ...normalizeVectorDesign(),
      paletteEnabled: true,
      primary: "#ff0000",
    });
    expect(patch.vectorDesign.primary).toBe("#ff0000");
    expect(decodeURIComponent(patch.src)).toContain('fill="#ff0000"');
  });

  it("hydrates legacy built-in vector clips that only retained an asset id", () => {
    const segment = {
      assetId: "vector-orbit-frame",
      kind: "vector",
      src: "legacy-original",
    };
    const patch = buildVectorDesignPatch(segment, {
      paletteEnabled: true,
      primary: "#123456",
      secondary: "#654321",
      accent: "#abcdef",
    });
    const source = decodeURIComponent(patch.src);
    expect(patch.vectorBody).toContain("<ellipse");
    expect(patch.vectorColorSlots.primary.length).toBeGreaterThan(0);
    expect(source).toContain("#123456");
    expect(source).toContain("#654321");
    expect(source).toContain("#abcdef");
    expect(source).not.toBe("legacy-original");
  });

  it("regenerates vectors at a display/export-sized intrinsic resolution", () => {
    const segment = {
      kind: "vector",
      src: "original",
      vectorBody: '<circle cx="600" cy="600" r="500" fill="#35ead9"/>',
      baseTransform: { scale: 2 },
    };
    const source = decodeURIComponent(getVectorRenderSource(segment, {
      targetWidth: 1920,
      targetHeight: 1080,
    }));
    expect(getVectorRenderDimension(3840)).toBe(4096);
    expect(source).toContain('width="4096" height="4096"');
    expect(source).toContain('viewBox="0 0 1200 1200"');
  });

  it("leaves bitmap sources untouched", () => {
    expect(getVectorRenderSource({ kind: "image", src: "photo.jpg" }, {
      targetWidth: 3840,
      targetHeight: 2160,
    })).toBe("photo.jpg");
  });
});
