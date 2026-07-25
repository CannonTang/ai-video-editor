import { describe, expect, it } from "vitest";
import { findBestLoopBoundary, repeatPcm16WavAtBestBoundary, repeatPcm16WavWithFades } from "./aiMusicLoop.js";

function makeMonoWav(samples, sampleRate = 4) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
  return buffer;
}

describe("AI music long-duration looping", () => {
  it("duplicates the PCM duration and fades both sides of the join", () => {
    const output = repeatPcm16WavWithFades(makeMonoWav([1000, 1000, 1000, 1000]), 2, 0.5);
    const view = new DataView(output);
    expect(view.getUint32(40, true)).toBe(16);
    expect(view.getInt16(44 + 3 * 2, true)).toBeLessThan(1000);
    expect(view.getInt16(44 + 4 * 2, true)).toBe(0);
    expect(view.getInt16(44 + 5 * 2, true)).toBeGreaterThan(0);
  });

  it("selects a quiet boundary in the tail instead of blindly using the end", () => {
    const samples = [
      0, 1000, 1000, 1000,
      1000, 1000, 1000, 1000,
      1000, 1000, 1000, 1000,
      1000, 1000, 20, 0,
      20, 1000, 1000, 1000,
    ];
    const source = makeMonoWav(samples);
    const boundary = findBestLoopBoundary(source, 2);
    const output = repeatPcm16WavAtBestBoundary(source, 2, 2);
    expect(boundary.cutFrame).toBeGreaterThanOrEqual(14);
    expect(boundary.cutFrame).toBeLessThan(20);
    expect(new DataView(output).getUint32(40, true)).toBe(boundary.cutFrame * 4);
  });
});
