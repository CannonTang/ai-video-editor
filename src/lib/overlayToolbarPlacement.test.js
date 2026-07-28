import { describe, expect, it } from "vitest";
import { getOverlayToolbarPosition } from "./overlayToolbarPlacement.js";

describe("getOverlayToolbarPosition", () => {
  it("places the toolbar below an overlay when space is available", () => {
    expect(getOverlayToolbarPosition({
      frameWidth: 640,
      frameHeight: 360,
      centerX: 320,
      centerY: 150,
      width: 160,
      height: 100,
    })).toEqual({ left: 320, top: 208, placement: "below" });
  });

  it("flips the toolbar above an overlay near the bottom edge", () => {
    expect(getOverlayToolbarPosition({
      frameWidth: 640,
      frameHeight: 360,
      centerX: 320,
      centerY: 320,
      width: 160,
      height: 60,
    })).toEqual({ left: 372, top: 250, placement: "above" });
  });

  it("clamps the toolbar into the frame and accounts for rotation", () => {
    expect(getOverlayToolbarPosition({
      frameWidth: 320,
      frameHeight: 180,
      centerX: 10,
      centerY: 130,
      width: 120,
      height: 40,
      rotation: 90,
    })).toEqual({ left: 62, top: 30, placement: "above" });
  });
});
