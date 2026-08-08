import { voiceModelBaseUrls } from "../config/voiceModels.js";
import { orderModelUrlsForNetwork } from "./modelSources.js";
import { prepareVoiceModelStorage } from "./voiceModelStorage.js";

const MODEL_PATH = "kokoro-multi-lang-v1_1-fp16-4voices";
const SPEAKER_IDS = Object.freeze({
  zh_f_qinglan: 0,
  zh_f_ruoxi: 1,
  zh_m_yunzhou: 2,
  zh_m_jingche: 3,
  // Imported projects and history created before the catalog refresh.
  zh_m_yansheng: 3,
});

let worker;
let readyPromise;
let requestCounter = 0;
const pending = new Map();
const progressListeners = new Set();

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, Number.isFinite(samples[index]) ? samples[index] : 0));
    view.setInt16(44 + index * 2, Math.round(value * 32767), true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function broadcastProgress(event) {
  for (const listener of progressListeners) listener(event);
}

function resetWorker(error) {
  worker?.terminate();
  worker = undefined;
  readyPromise = undefined;
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}

async function ensureWorker(onProgress) {
  if (onProgress) progressListeners.add(onProgress);
  if (!readyPromise) {
    readyPromise = (async () => {
      await prepareVoiceModelStorage({
        preserveModelPath: MODEL_PATH,
        requiredBytes: 260 * 1024 * 1024,
        clearPiper: true,
        keepKokoroStyles: false,
      });
      const baseUrls = await orderModelUrlsForNetwork(voiceModelBaseUrls(MODEL_PATH));
      return new Promise((resolve, reject) => {
        worker = new Worker("/kokoro-multilang.worker.js");
        worker.onmessage = (event) => {
          const message = event.data || {};
          if (message.type === "setup-progress") {
            broadcastProgress({ phase: "initializing", progress: Math.max(0, Math.min(96, message.progress || 0)) });
          } else if (message.type === "ready") {
            broadcastProgress({ phase: "ready", backend: "wasm", progress: 100, source: message.source });
            resolve(message);
          } else if (message.type === "result") {
            const request = pending.get(message.requestId);
            if (!request) return;
            pending.delete(message.requestId);
            request.resolve({ samples: message.samples, sampleRate: message.sampleRate });
          } else if (message.type === "error") {
            const error = new Error(message.message || "KOKORO_MULTILANG_FAILED");
            if (message.scope === "generate" && pending.has(message.requestId)) {
              pending.get(message.requestId).reject(error);
              pending.delete(message.requestId);
            } else {
              reject(error);
              resetWorker(error);
            }
          }
        };
        worker.onerror = (event) => {
          const error = new Error(event.message || "KOKORO_MULTILANG_WORKER_FAILED");
          reject(error);
          resetWorker(error);
        };
        worker.postMessage({ type: "init", baseUrls });
      });
    })().catch((error) => {
      readyPromise = undefined;
      throw error;
    });
  }
  try {
    return await readyPromise;
  } finally {
    if (onProgress) progressListeners.delete(onProgress);
  }
}

export async function predictKokoroMultilangVoice(input, onProgress) {
  await ensureWorker(onProgress);
  const sid = SPEAKER_IDS[input.voiceId];
  if (!Number.isInteger(sid)) throw new Error(`UNKNOWN_KOKORO_MULTILANG_VOICE:${input.voiceId}`);
  onProgress?.({ phase: "generating", backend: "wasm", progress: 96 });
  const requestId = `kokoro-multilang-${Date.now()}-${requestCounter += 1}`;
  const audio = await new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    worker.postMessage({ type: "generate", requestId, text: input.text, sid, speed: input.speed });
  });
  onProgress?.({ phase: "complete", backend: "wasm", progress: 100 });
  return encodeWav(audio.samples, audio.sampleRate);
}
