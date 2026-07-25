import { describe, expect, it } from "vitest";
import { buildPingPongSchedule, pingPongStep } from "./aiMusicSampling.js";

describe("AI music ping-pong sampler", () => {
  it("uses exact 1-to-0 endpoints", () => {
    const schedule = buildPingPongSchedule(8);
    expect(schedule).toHaveLength(9);
    expect(schedule[0]).toBe(1);
    expect(schedule.at(-1)).toBe(0);
    expect(schedule.every((value, index) => index === 0 || value < schedule[index - 1])).toBe(true);
  });

  it("does not add fresh noise to the final denoised sample", () => {
    const output = pingPongStep(
      Float32Array.of(1, 2),
      Float32Array.of(0.25, 0.5),
      0.5,
      0,
      Float32Array.of(100, 100),
    );
    expect(Array.from(output)).toEqual([0.875, 1.75]);
  });
});
