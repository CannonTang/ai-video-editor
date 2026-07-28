import { describe, expect, it } from "vitest";
import {
  getMobileClipActionIds,
  getMobileClipPanel,
  getMobileClipPanelOrigin,
  resolveInspectorPanelContext,
  resolveMobileClipActionTrack,
  shouldActivateToolRailForClip,
} from "./mobileClipActions.js";

describe("mobile clip actions", () => {
  it("shows audio-specific actions for voiceover and music clips", () => {
    expect(getMobileClipActionIds("audio")).toEqual(["dismiss", "audio-properties", "audio-fade", "split", "captions", "separate", "caption-link", "delete"]);
    expect(getMobileClipActionIds("music")).toEqual(["dismiss", "audio-properties", "audio-fade", "split", "captions", "separate", "delete"]);
  });

  it("adds caption link controls for caption and linked voiceover clips", () => {
    expect(getMobileClipActionIds("caption", { hasLinkedCaption: true })).toEqual([
      "dismiss", "caption-properties", "caption-font", "caption-voice", "split", "copy", "caption-link", "caption-align", "delete",
    ]);
    expect(getMobileClipActionIds("audio", { hasLinkedCaption: true })).toEqual([
      "dismiss", "audio-properties", "audio-fade", "split", "captions", "separate", "caption-link", "caption-align", "delete",
    ]);
  });

  it("does not offer vocal separation for linked source-audio pieces", () => {
    expect(getMobileClipActionIds("source")).toEqual(["dismiss", "audio-properties", "split", "captions", "delete"]);
  });

  it("keeps visual clip actions free of audio-only commands", () => {
    expect(getMobileClipActionIds("image")).toEqual([
      "dismiss", "visual-transform", "visual-mask", "visual-filter", "visual-animation", "visual-repair", "split", "copy", "delete",
    ]);
  });

  it("shows a compact direct-property menu for sticker clips", () => {
    expect(getMobileClipActionIds("sticker")).toEqual(["dismiss", "sticker-properties", "copy", "delete"]);
    expect(getMobileClipPanelOrigin("sticker")).toBe("sticker-clip");
  });

  it("offers source-audio extraction only for an eligible mobile visual clip", () => {
    expect(getMobileClipActionIds("image", { canExtractSourceAudio: true })).toEqual([
      "dismiss", "visual-transform", "visual-mask", "visual-filter", "visual-animation", "visual-repair", "split", "copy", "extract-source-audio", "delete",
    ]);
    expect(getMobileClipActionIds("caption", { canExtractSourceAudio: true })).not.toContain("extract-source-audio");
  });

  it("lists direct visual property categories for videos and vector overlays", () => {
    expect(getMobileClipActionIds("image", { isVideo: true })).toEqual([
      "dismiss", "visual-transform", "visual-mask", "visual-filter", "visual-animation", "visual-speed", "visual-repair", "split", "copy", "delete",
    ]);
    expect(getMobileClipActionIds("overlay", { isVector: true })).toEqual([
      "dismiss", "visual-transform", "visual-vector", "visual-animation", "overlay-timing", "split", "copy", "delete",
    ]);
    expect(getMobileClipActionIds("image", { isVector: true })).toEqual([
      "dismiss", "visual-transform", "visual-vector", "visual-animation", "split", "copy", "delete",
    ]);
  });

  it("routes every mobile audio clip directly to its property inspector", () => {
    expect(getMobileClipPanel("audio")).toBe("inspector");
    expect(getMobileClipPanel("source")).toBe("inspector");
    expect(getMobileClipPanel("music")).toBe("inspector");
    expect(getMobileClipPanel("image")).toBe("inspector");
  });

  it("marks all audio clips as a dedicated property-sheet session", () => {
    expect(getMobileClipPanelOrigin("audio")).toBe("audio-clip");
    expect(getMobileClipPanelOrigin("source")).toBe("audio-clip");
    expect(getMobileClipPanelOrigin("music")).toBe("audio-clip");
  });

  it("keeps each visual editor clip in its own property-sheet context", () => {
    expect(getMobileClipPanelOrigin("image")).toBe("visual-clip");
    expect(getMobileClipPanelOrigin("overlay")).toBe("overlay-clip");
    expect(getMobileClipPanelOrigin("caption")).toBe("caption-clip");
  });

  it("lets the opened clip inspector override stale tool and track state", () => {
    expect(resolveInspectorPanelContext({
      origin: "visual-clip",
      activeTool: "caption",
      selectedTrack: "image",
    })).toBe("visual");
    expect(resolveInspectorPanelContext({
      origin: "caption-clip",
      activeTool: "media",
      selectedTrack: "image",
    })).toBe("caption");
  });

  it("keeps the persistent tool rail unchanged for mobile clip selection", () => {
    expect(shouldActivateToolRailForClip(true)).toBe(false);
    expect(shouldActivateToolRailForClip(false)).toBe(true);
  });

  it("uses the pressed audio clip instead of a stale visual selection", () => {
    expect(resolveMobileClipActionTrack("audio", { visual: true, audio: true })).toBe("audio");
    expect(resolveMobileClipActionTrack("", { visual: true })).toBe("image");
  });
});
