import * as ort from "onnxruntime-web/webgpu";
import ortWasmMjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import { voiceModelFileUrls } from "../config/voiceModels.js";
import { fetchFirstAvailableModel } from "../lib/modelSources.js";

ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1)) : 1;
ort.env.wasm.simd = true;
ort.env.wasm.wasmPaths = { mjs: ortWasmMjsUrl, wasm: ortWasmUrl };
ort.env.webgpu.powerPreference = "high-performance";

const MODEL_ROOT = "openvoice-v2-converter-fp16";
const SAMPLE_RATE = 22050;
const FFT_SIZE = 1024;
const HOP_SIZE = 256;
const BINS = FFT_SIZE / 2 + 1;
let sessionsPromise;

function progress(requestId, value, phase) {
  self.postMessage({ type: "progress", requestId, progress: value, phase });
}

async function cachedModel(path, requestId) {
  const urls = voiceModelFileUrls(`${MODEL_ROOT}/${path}`);
  const { response } = await fetchFirstAvailableModel(urls);
  if (response.headers.get("X-Timeline-Model-Cache") === "hit") {
    progress(requestId, 28, "从本地模型缓存加载");
  }
  return response.arrayBuffer();
}

async function getSessions(requestId) {
  if (!sessionsPromise) {
    sessionsPromise = (async () => {
      progress(requestId, 8, "下载 OpenVoice 模型");
      // Remove the short-lived pre-release cache. The service worker owns the
      // canonical, provider-independent model cache and avoids duplicate model
      // copies competing for the browser quota.
      await caches.delete("timeline-studio-voice-models-v2").catch(() => false);
      const [referenceBytes, converterBytes] = await Promise.all([
        cachedModel("reference-encoder.onnx", requestId),
        cachedModel("converter.onnx", requestId),
      ]);
      progress(requestId, 42, "初始化音色编码器");
      const reference = await ort.InferenceSession.create(referenceBytes, {
        executionProviders: ["wasm"], graphOptimizationLevel: "all",
      });
      progress(requestId, 56, "初始化变声模型");
      let converter;
      try {
        converter = await ort.InferenceSession.create(converterBytes, {
          executionProviders: ["webgpu", "wasm"], graphOptimizationLevel: "all",
        });
      } catch {
        converter = await ort.InferenceSession.create(converterBytes, {
          executionProviders: ["wasm"], graphOptimizationLevel: "all",
        });
      }
      return { reference, converter };
    })().catch((error) => { sessionsPromise = null; throw error; });
  }
  return sessionsPromise;
}

function fft(real, imag) {
  const length = real.length;
  for (let index = 1, reversed = 0; index < length; index += 1) {
    let bit = length >> 1;
    for (; reversed & bit; bit >>= 1) reversed ^= bit;
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imag[index], imag[reversed]] = [imag[reversed], imag[index]];
    }
  }
  for (let size = 2; size <= length; size <<= 1) {
    const angle = -2 * Math.PI / size;
    const wlenReal = Math.cos(angle);
    const wlenImag = Math.sin(angle);
    for (let start = 0; start < length; start += size) {
      let wr = 1; let wi = 0;
      for (let offset = 0; offset < size / 2; offset += 1) {
        const even = start + offset; const odd = even + size / 2;
        const vr = real[odd] * wr - imag[odd] * wi;
        const vi = real[odd] * wi + imag[odd] * wr;
        real[odd] = real[even] - vr; imag[odd] = imag[even] - vi;
        real[even] += vr; imag[even] += vi;
        const nextWr = wr * wlenReal - wi * wlenImag;
        wi = wr * wlenImag + wi * wlenReal; wr = nextWr;
      }
    }
  }
}

function spectrogram(samples) {
  const frameCount = Math.max(1, Math.floor((samples.length - FFT_SIZE) / HOP_SIZE) + 1);
  const data = new Float32Array(frameCount * BINS);
  const window = Float32Array.from({ length: FFT_SIZE }, (_, index) => 0.5 - 0.5 * Math.cos(2 * Math.PI * index / FFT_SIZE));
  const real = new Float32Array(FFT_SIZE); const imag = new Float32Array(FFT_SIZE);
  for (let frame = 0; frame < frameCount; frame += 1) {
    real.fill(0); imag.fill(0);
    const sampleOffset = frame * HOP_SIZE;
    for (let index = 0; index < FFT_SIZE; index += 1) real[index] = (samples[sampleOffset + index] || 0) * window[index];
    fft(real, imag);
    for (let bin = 0; bin < BINS; bin += 1) data[frame * BINS + bin] = Math.hypot(real[bin], imag[bin]);
  }
  return { data, frameCount };
}

function transposeFrames(data, frameCount) {
  const output = new Float32Array(data.length);
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let bin = 0; bin < BINS; bin += 1) output[bin * frameCount + frame] = data[frame * BINS + bin];
  }
  return output;
}

function seededNoise(length, seed) {
  const output = new Float32Array(length);
  let state = seed >>> 0 || 0x9e3779b9;
  for (let index = 0; index < length; index += 2) {
    state = (1664525 * state + 1013904223) >>> 0; const u1 = Math.max(1e-7, state / 4294967296);
    state = (1664525 * state + 1013904223) >>> 0; const u2 = state / 4294967296;
    const radius = Math.sqrt(-2 * Math.log(u1));
    output[index] = radius * Math.cos(2 * Math.PI * u2);
    if (index + 1 < length) output[index + 1] = radius * Math.sin(2 * Math.PI * u2);
  }
  return output;
}

function findLastActiveSample(samples) {
  const windowSize = Math.round(SAMPLE_RATE * 0.02);
  const hopSize = Math.round(SAMPLE_RATE * 0.01);
  let peakRms = 0;
  const levels = [];
  for (let start = 0; start < samples.length; start += hopSize) {
    const end = Math.min(samples.length, start + windowSize);
    let energy = 0;
    for (let index = start; index < end; index += 1) energy += samples[index] * samples[index];
    const rms = Math.sqrt(energy / Math.max(1, end - start));
    levels.push([start, end, rms]);
    peakRms = Math.max(peakRms, rms);
  }
  // Very quiet references do not provide a reliable activity boundary. Keep
  // their original duration instead of accidentally trimming real speech.
  if (peakRms < 0.0025) return samples.length;
  const threshold = Math.max(0.0015, peakRms * 0.035);
  let lastActive = 0;
  for (const [, end, rms] of levels) {
    if (rms >= threshold) lastActive = end;
  }
  return lastActive || samples.length;
}

function finishConvertedAudio(output, source) {
  // Voice conversion must preserve timing. Some decoder graphs expose padded
  // samples after the masked spectrogram; seeded noise turns that padding into
  // a faint, long breath/noise tail unless it is explicitly removed.
  const activeEnd = findLastActiveSample(source);
  const tailPadding = Math.round(SAMPLE_RATE * 0.16);
  const targetLength = Math.max(1, Math.min(
    output.length,
    source.length,
    activeEnd + tailPadding,
  ));
  const finished = Float32Array.from(output.subarray(0, targetLength));
  const fadeLength = Math.min(Math.round(SAMPLE_RATE * 0.04), finished.length);
  const fadeStart = finished.length - fadeLength;
  for (let index = 0; index < fadeLength; index += 1) {
    const gain = Math.cos((index / Math.max(1, fadeLength - 1)) * Math.PI * 0.5);
    finished[fadeStart + index] *= gain;
  }
  return finished;
}

async function encode(samples, requestId) {
  const { reference } = await getSessions(requestId);
  const spec = spectrogram(samples);
  progress(requestId, 78, "提取音色特征");
  const result = await reference.run({
    spectrogram_frames: new ort.Tensor("float32", spec.data, [1, spec.frameCount, BINS]),
  });
  return Float32Array.from(result.speaker_embedding.data);
}

async function convert(samples, targetEmbedding, seed, requestId) {
  const { converter } = await getSessions(requestId);
  const spec = spectrogram(samples);
  const sourceEmbedding = await encode(samples, requestId);
  const transposed = transposeFrames(spec.data, spec.frameCount);
  progress(requestId, 84, "转换为克隆音色");
  const result = await converter.run({
    spectrogram: new ort.Tensor("float32", transposed, [1, BINS, spec.frameCount]),
    frame_mask: new ort.Tensor("float32", new Float32Array(spec.frameCount).fill(1), [1, 1, spec.frameCount]),
    source_embedding: new ort.Tensor("float32", sourceEmbedding, [1, 256, 1]),
    target_embedding: new ort.Tensor("float32", targetEmbedding, [1, 256, 1]),
    noise: new ort.Tensor("float32", seededNoise(192 * spec.frameCount, seed), [1, 192, spec.frameCount]),
  });
  const tensor = result.audio || Object.values(result)[0];
  progress(requestId, 96, "清理尾部静音");
  return finishConvertedAudio(tensor.data, samples);
}

self.onmessage = async ({ data }) => {
  const { requestId, action, samples, embedding, seed = 2026 } = data;
  try {
    const result = action === "encode"
      ? await encode(samples, requestId)
      : await convert(samples, embedding, seed, requestId);
    self.postMessage({ type: "result", requestId, result }, [result.buffer]);
  } catch (error) {
    self.postMessage({ type: "error", requestId, message: error?.message || String(error) });
  }
};
