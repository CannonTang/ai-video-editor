import { GemmaTokenizer, env } from "@huggingface/transformers";
import * as ort from "onnxruntime-web/webgpu";
import ortWasmMjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import { buildPingPongSchedule, pingPongStep } from "../lib/aiMusicSampling.js";
import { fetchFirstAvailableModel, mirroredModelFileUrls } from "../lib/modelSources.js";

const MODEL_REVISION = "0b8a05e0bc3511e674b4cb3413d3ef6c48880cdb";
const LEGACY_BASE = "https://huggingface.co/lsb/stable-audio-3-small-music-onnx/resolve/main";
const SAMPLE_RATE = 44100;
const MODEL_CACHE_NAME = "timeline-studio-model-cache-v4";

env.allowLocalModels = false;
env.allowRemoteModels = true;
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 4) : 1;
ort.env.wasm.simd = true;
ort.env.wasm.wasmPaths = { mjs: ortWasmMjsUrl, wasm: ortWasmUrl };
ort.env.webgpu.powerPreference = "high-performance";
ort.env.webgpu.forceFallbackAdapter = false;

function progress(phase, value) {
  self.postMessage({ type: "progress", phase, progress: value });
}

const GRAPH_SPECS = [
  ["text_encoder_q4", "text_encoder_q4.onnx"],
  ["number_conditioner", "number_conditioner.onnx"],
  ["dit_q4", "dit_q4.onnx"],
  ["decoder_q4", "decoder_q4.onnx"],
];

async function fetchModelFile(path, modelSourcePreference) {
  const urls = mirroredModelFileUrls({
    repository: "stable-audio-3-small-music-onnx",
    revision: MODEL_REVISION,
    path,
    preference: modelSourcePreference,
  });
  const cache = await caches.open(MODEL_CACHE_NAME);
  let cached = null;
  for (const url of [...urls, `${LEGACY_BASE}/${path}`]) {
    cached = await cache.match(url);
    if (cached) break;
  }
  if (cached) {
    return { response: cached, fromCache: true };
  }

  // The service worker is the single cache writer. Writing the same large
  // response here as well can temporarily require twice the storage and cause
  // QuotaExceededError on otherwise capable devices.
  const { response } = await fetchFirstAvailableModel(urls);
  return {
    response,
    fromCache: response.headers.get("X-Timeline-Model-Cache") === "hit",
  };
}

async function downloadAllResources(modelSourcePreference) {
  const manifestResults = await Promise.all(GRAPH_SPECS.map(async ([name]) => {
    const resource = await fetchModelFile(`onnx/${name}_chunks.json`, modelSourcePreference);
    const { response } = resource;
    if (!response.ok) throw new Error(`Model manifest download failed (${response.status}): ${name}`);
    return { manifest: await response.json(), resource };
  }));
  const manifests = manifestResults.map(({ manifest }) => manifest);
  const paths = [
    ...GRAPH_SPECS.flatMap(([, graph], index) => [
      `onnx/${graph}`,
      ...(manifests[index].chunks || manifests[index].files || []).map((item) => `onnx/${item.name || item.path}`),
    ]),
    "tokenizer/tokenizer.json",
    "tokenizer/tokenizer_config.json",
  ];

  // Start every request before consuming any response body. This lets Chrome
  // multiplex the model shards while keeping WebGPU session creation separate.
  const responses = await Promise.all(paths.map(async (path) => {
    const { response, fromCache } = await fetchModelFile(path, modelSourcePreference);
    if (!response.ok) throw new Error(`Model download failed (${response.status}): ${path}`);
    return { path, response, fromCache };
  }));
  const allResources = [
    ...manifestResults.map(({ resource }) => resource),
    ...responses,
  ];
  const phase = allResources.every(({ fromCache }) => fromCache) ? "cache" : "download";
  const expectedBytes = responses.reduce((sum, { response }) => sum + (Number(response.headers.get("content-length")) || 0), 0);
  const loadedByPath = new Map(paths.map((path) => [path, 0]));
  const report = (path, bytes) => {
    loadedByPath.set(path, bytes);
    const loaded = [...loadedByPath.values()].reduce((sum, value) => sum + value, 0);
    progress(phase, 0.02 + 0.55 * Math.min(1, expectedBytes ? loaded / expectedBytes : loadedByPath.size / paths.length));
  };
  const artifacts = new Map(await Promise.all(responses.map(async ({ path, response }) => {
    const reader = response.body?.getReader();
    if (!reader) {
      const data = new Uint8Array(await response.arrayBuffer());
      report(path, data.byteLength);
      return [path, data];
    }
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      report(path, loaded);
    }
    const data = new Uint8Array(loaded);
    let cursor = 0;
    for (const chunk of chunks) {
      data.set(chunk, cursor);
      cursor += chunk.byteLength;
    }
    return [path, data];
  })));
  progress(phase, 0.57);
  return { artifacts, manifests };
}

async function createSession(index, resources) {
  const [, graph] = GRAPH_SPECS[index];
  const manifest = resources.manifests[index];
  const graphPath = `onnx/${graph}`;
  const graphBytes = resources.artifacts.get(graphPath);
  const pieces = manifest.chunks || manifest.files || [];
  const externalData = pieces.map((item) => {
    const path = item.name || item.path;
    return { path, data: resources.artifacts.get(`onnx/${path}`) };
  });
  if (!navigator.gpu) {
    throw new Error("This Q4 music model requires WebGPU. Enable WebGPU in a current Chrome or Edge browser.");
  }
  const session = await ort.InferenceSession.create(graphBytes, {
    executionProviders: ["webgpu"],
    externalData,
  });
  resources.artifacts.delete(graphPath);
  for (const item of pieces) resources.artifacts.delete(`onnx/${item.name || item.path}`);
  return session;
}

function createTokenizer(artifacts) {
  const decoder = new TextDecoder();
  const tokenizerJSON = JSON.parse(decoder.decode(artifacts.get("tokenizer/tokenizer.json")));
  const tokenizerConfig = JSON.parse(decoder.decode(artifacts.get("tokenizer/tokenizer_config.json")));
  artifacts.delete("tokenizer/tokenizer.json");
  artifacts.delete("tokenizer/tokenizer_config.json");
  return new GemmaTokenizer(tokenizerJSON, tokenizerConfig);
}

function randomNormal(length, seed) {
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return (state + 1) / 4294967297;
  };
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 2) {
    const radius = Math.sqrt(-2 * Math.log(random()));
    const angle = 2 * Math.PI * random();
    output[index] = radius * Math.cos(angle);
    if (index + 1 < length) output[index + 1] = radius * Math.sin(angle);
  }
  return output;
}

function wavFromAudio(audio, seconds) {
  const frames = Math.min(Math.floor(seconds * SAMPLE_RATE), audio.dims.at(-1));
  const bytes = new ArrayBuffer(44 + frames * 4);
  const view = new DataView(bytes);
  const text = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + frames * 4, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 2, true); view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 4, true);
  view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, frames * 4, true);
  const channelLength = audio.dims.at(-1);
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < 2; channel += 1) {
      const sample = Math.max(-1, Math.min(1, audio.data[channel * channelLength + frame] || 0));
      view.setInt16(44 + (frame * 2 + channel) * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
    }
  }
  return bytes;
}

let runtimePromise = null;

async function initializeRuntime(modelSourcePreference) {
  progress("download", 0.02);
  const resources = await downloadAllResources(modelSourcePreference);
  const tokenizer = createTokenizer(resources.artifacts);
  // WebGPU permits only one EP session to be initialized at a time. Keeping
  // these sequential also avoids holding every graph's temporary upload
  // buffers at once on integrated-memory Macs.
  progress("initializing", 0.58);
  const textSession = await createSession(0, resources);
  progress("initializing", 0.595);
  const numberSession = await createSession(1, resources);
  progress("initializing", 0.61);
  const ditSession = await createSession(2, resources);
  progress("initializing", 0.625);
  const decoderSession = await createSession(3, resources);
  return { tokenizer, textSession, numberSession, ditSession, decoderSession };
}

async function generate({ prompt, seconds, steps, seed, modelSourcePreference }) {
  runtimePromise ??= initializeRuntime(modelSourcePreference).catch((error) => {
    runtimePromise = null;
    throw error;
  });
  const { tokenizer, textSession, numberSession, ditSession, decoderSession } = await runtimePromise;
  progress("conditioning", 0.64);
  const tokens = await tokenizer(prompt, { padding: "max_length", truncation: true, max_length: 256 });
  const ids = BigInt64Array.from(tokens.input_ids.data, BigInt);
  const mask = BigInt64Array.from(tokens.attention_mask.data, BigInt);
  const text = (await textSession.run({
    [textSession.inputNames[0]]: new ort.Tensor("int64", ids, [1, 256]),
    [textSession.inputNames[1]]: new ort.Tensor("int64", mask, [1, 256]),
  }))[textSession.outputNames[0]];
  const duration = (await numberSession.run({
    seconds: new ort.Tensor("float32", Float32Array.of(seconds), [1]),
  }))[numberSession.outputNames[0]];
  const cross = new Float32Array(257 * 768);
  cross.set(text.data.subarray(0, 256 * 768));
  cross.set(duration.data.subarray(0, 768), 256 * 768);
  const latentLength = Math.ceil((seconds + 6) * SAMPLE_RATE / 8192) * 2;
  let latent = randomNormal(256 * latentLength, seed);
  const times = buildPingPongSchedule(steps);
  for (let step = 0; step < steps; step += 1) {
    progress("generating", 0.65 + step / steps * 0.27);
    const current = times[step];
    const next = times[step + 1];
    const result = await ditSession.run({
      x: new ort.Tensor("float32", latent, [1, 256, latentLength]),
      t: new ort.Tensor("float32", Float32Array.of(current), [1]),
      cross_attn_cond: new ort.Tensor("float32", cross, [1, 257, 768]),
      global_embed: new ort.Tensor("float32", duration.data, [1, 768]),
      local_add_cond: new ort.Tensor("float32", new Float32Array(257 * latentLength), [1, 257, latentLength]),
      padding_mask: new ort.Tensor("bool", new Uint8Array(latentLength).fill(1), [1, latentLength]),
    });
    const velocity = result[ditSession.outputNames[0]].data;
    const noise = next > 0 ? randomNormal(latent.length, seed + step + 1) : null;
    latent = pingPongStep(latent, velocity, current, next, noise);
  }
  progress("decoding", 0.94);
  const decoded = await decoderSession.run({
    [decoderSession.inputNames[0]]: new ort.Tensor("float32", latent, [1, 256, latentLength]),
  });
  const wav = wavFromAudio(decoded[decoderSession.outputNames[0]], seconds);
  progress("complete", 1);
  self.postMessage({ type: "complete", wav }, [wav]);
}

self.onmessage = ({ data }) => {
  if (data.type !== "generate") return;
  generate(data).catch((error) => self.postMessage({ type: "error", message: error?.message || String(error) }));
};
