import * as ort from "onnxruntime-web-migan/webgpu";
import { fetchFirstAvailableModel, mirroredModelFileUrls } from "../lib/modelSources.js";

const MODEL_REVISION = "d551be137b16ecdf12637387f2fb4776565e763f";
const MODEL_PATH = "migan-webgpu/migan-generator-256.onnx";
const MODEL_CACHE_KEY =
  `/__model-cache__/haixin/timeline-studio-onnx-models/${MODEL_REVISION}/${MODEL_PATH}`;
const MODEL_BYTES = 24_743_604;
const MODEL_SIZE = 256;
const CACHE_NAME = "timeline-studio-migan-generator-256-webgpu-v1";

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = "/vendor/migan-ort/";

let sessionPromise = null;

function report(requestId, stage, value, extra = {}) {
  self.postMessage({ type: "progress", requestId, stage, value, ...extra });
}

async function readResponse(response, requestId, source) {
  const total = Number(response.headers.get("content-length")) || MODEL_BYTES;
  if (!response.body) {
    const bytes = await response.arrayBuffer();
    report(requestId, "download", 1, { loaded: bytes.byteLength, total, source });
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    report(requestId, "download", Math.min(1, loaded / total), { loaded, total, source });
  }
  const merged = new Uint8Array(loaded);
  let offset = 0;
  chunks.forEach((chunk) => { merged.set(chunk, offset); offset += chunk.byteLength; });
  return merged.buffer;
}

async function createSession(requestId, modelSourcePreference) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(MODEL_CACHE_KEY);
  let model;
  if (cached) model = await readResponse(cached, requestId, "cache");
  else {
    const { response } = await fetchFirstAvailableModel(mirroredModelFileUrls({
      repository: "timeline-studio-onnx-models",
      revision: MODEL_REVISION,
      path: MODEL_PATH,
      preference: modelSourcePreference,
    }));
    model = await readResponse(response, requestId, "network");
    await cache.put(MODEL_CACHE_KEY, new Response(model, {
      headers: { "Content-Type": "application/octet-stream", "Content-Length": String(model.byteLength) },
    }));
  }
  report(requestId, "compile", 0);
  const started = performance.now();
  const session = await ort.InferenceSession.create(model, { executionProviders: ["webgpu"] });
  return { session, backend: "webgpu", initMs: performance.now() - started };
}

function getSession(requestId, modelSourcePreference) {
  if (!sessionPromise) {
    sessionPromise = createSession(requestId, modelSourcePreference).catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function findMaskBounds(mask, width, height) {
  let minX = width; let minY = height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function getInferenceCrop(bounds, width, height) {
  let cropWidth = Math.min(width, Math.max(512, bounds.width + 192));
  let cropHeight = Math.min(height, Math.max(512, bounds.height + 192));
  cropWidth = Math.min(width, Math.ceil(cropWidth / 256) * 256);
  cropHeight = Math.min(height, Math.ceil(cropHeight / 256) * 256);
  return {
    x: clamp(Math.round(bounds.x + bounds.width / 2 - cropWidth / 2), 0, width - cropWidth),
    y: clamp(Math.round(bounds.y + bounds.height / 2 - cropHeight / 2), 0, height - cropHeight),
    width: cropWidth,
    height: cropHeight,
  };
}

async function inpaint({ requestId, rgbaBuffer, maskBuffer, width, height, modelSourcePreference }) {
  const rgba = new Uint8ClampedArray(rgbaBuffer);
  const mask = new Uint8Array(maskBuffer);
  const bounds = findMaskBounds(mask, width, height);
  if (!bounds) throw new Error("Select a watermark region first");
  const crop = getInferenceCrop(bounds, width, height);
  const plane = crop.width * crop.height;
  const modelPlane = MODEL_SIZE * MODEL_SIZE;
  const input = new Float32Array(modelPlane * 4);
  for (let y = 0; y < MODEL_SIZE; y += 1) {
    const sy = crop.y + Math.min(crop.height - 1, Math.floor((y + 0.5) * crop.height / MODEL_SIZE));
    for (let x = 0; x < MODEL_SIZE; x += 1) {
      const sx = crop.x + Math.min(crop.width - 1, Math.floor((x + 0.5) * crop.width / MODEL_SIZE));
      const sourceIndex = sy * width + sx;
      const targetIndex = y * MODEL_SIZE + x;
      const pixelIndex = sourceIndex * 4;
      const known = mask[sourceIndex] ? 0 : 1;
      input[targetIndex] = known - 0.5;
      input[modelPlane + targetIndex] = (rgba[pixelIndex] / 127.5 - 1) * known;
      input[modelPlane * 2 + targetIndex] = (rgba[pixelIndex + 1] / 127.5 - 1) * known;
      input[modelPlane * 3 + targetIndex] = (rgba[pixelIndex + 2] / 127.5 - 1) * known;
    }
  }
  const runtime = await getSession(requestId, modelSourcePreference);
  report(requestId, "inference", 0, { backend: runtime.backend });
  const started = performance.now();
  const output = await runtime.session.run({
    [runtime.session.inputNames[0]]: new ort.Tensor("float32", input, [1, 4, MODEL_SIZE, MODEL_SIZE]),
  });
  const data = output[runtime.session.outputNames[0]].data;
  const result = new Uint8ClampedArray(plane * 4);
  for (let y = 0; y < crop.height; y += 1) {
    const my = Math.min(MODEL_SIZE - 1, Math.floor((y + 0.5) * MODEL_SIZE / crop.height));
    for (let x = 0; x < crop.width; x += 1) {
      const mx = Math.min(MODEL_SIZE - 1, Math.floor((x + 0.5) * MODEL_SIZE / crop.width));
      const modelIndex = my * MODEL_SIZE + mx;
      const targetIndex = (y * crop.width + x) * 4;
      result[targetIndex] = (data[modelIndex] * 0.5 + 0.5) * 255;
      result[targetIndex + 1] = (data[modelPlane + modelIndex] * 0.5 + 0.5) * 255;
      result[targetIndex + 2] = (data[modelPlane * 2 + modelIndex] * 0.5 + 0.5) * 255;
      result[targetIndex + 3] = 255;
    }
  }
  self.postMessage({
    type: "result",
    requestId,
    resultBuffer: result.buffer,
    crop,
    backend: runtime.backend,
    initMs: runtime.initMs,
    inferenceMs: performance.now() - started,
  }, [result.buffer]);
}

self.onmessage = async (event) => {
  if (event.data?.type !== "inpaint") return;
  try {
    await inpaint(event.data);
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: event.data.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
