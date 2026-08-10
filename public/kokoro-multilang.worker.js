let tts = null;
let initializing = false;

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

async function readResponse(response, expectedBytes, onChunk) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onChunk(bytes.byteLength);
    return bytes;
  }
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    onChunk(value.byteLength);
  }
  if (Number.isFinite(expectedBytes) && size !== expectedBytes) {
    throw new Error(`SIZE_MISMATCH:${size}:${expectedBytes}`);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchAndVerify(baseUrl, entry, onChunk) {
  const response = await fetch(new URL(entry.file, baseUrl), { cache: "default" });
  const bytes = await readResponse(response, entry.bytes, onChunk);
  if (entry.sha256 && await sha256(bytes) !== entry.sha256) {
    throw new Error(`SHA256_MISMATCH:${entry.file}`);
  }
  return bytes;
}

async function downloadBundle(baseUrl) {
  const manifestResponse = await fetch(new URL("manifest.json", baseUrl), { cache: "default" });
  if (!manifestResponse.ok) throw new Error(`MANIFEST_HTTP_${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  if (manifest?.format !== "timeline-studio-kokoro-browser-runtime-v1") {
    throw new Error("INVALID_MANIFEST");
  }
  const entries = [...manifest.runtime.files, ...manifest.runtime.data.parts];
  const total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  let loaded = 0;
  const onChunk = (bytes) => {
    loaded += bytes;
    self.postMessage({ type: "setup-progress", loaded, total, progress: total ? (loaded / total) * 88 : 0 });
  };
  const resources = await Promise.all(entries.map((entry) => fetchAndVerify(baseUrl, entry, onChunk)));
  const byFile = new Map(entries.map((entry, index) => [entry.file, resources[index]]));
  const data = new Uint8Array(manifest.runtime.data.bytes);
  let offset = 0;
  for (const part of manifest.runtime.data.parts) {
    const bytes = byFile.get(part.file);
    data.set(bytes, offset);
    offset += bytes.byteLength;
  }
  self.postMessage({ type: "setup-progress", loaded: total, total, progress: 91 });
  if (offset !== data.byteLength || await sha256(data) !== manifest.runtime.data.sha256) {
    throw new Error("ASSEMBLED_SHA256_MISMATCH");
  }
  return { manifest, data, byFile, baseUrl };
}

async function loadFromMirrors(baseUrls) {
  const failures = [];
  for (const baseUrl of baseUrls) {
    try {
      return await downloadBundle(baseUrl);
    } catch (error) {
      failures.push(`${new URL(baseUrl).hostname}:${errorMessage(error)}`);
      self.postMessage({ type: "mirror-fallback", failures: [...failures] });
    }
  }
  throw new Error(`MODEL_MIRRORS_UNAVAILABLE:${failures.join(";")}`);
}

async function initialize(baseUrls) {
  if (initializing || tts) return;
  initializing = true;
  try {
    const bundle = await loadFromMirrors(baseUrls);
    const decoder = new TextDecoder();
    const runtimeJs = bundle.byFile.get("runtime/sherpa-onnx-wasm-main-tts.js");
    const wrapperJs = bundle.byFile.get("runtime/sherpa-onnx-tts.js");
    const wasm = bundle.byFile.get("runtime/sherpa-onnx-wasm-main-tts.wasm");
    const wrapperUrl = URL.createObjectURL(new Blob([decoder.decode(wrapperJs)], { type: "text/javascript" }));
    const runtimeUrl = URL.createObjectURL(new Blob([decoder.decode(runtimeJs)], { type: "text/javascript" }));
    self.Module = {
      wasmBinary: wasm,
      getPreloadedPackage() { return bundle.data.buffer; },
      locateFile(path) { return path; },
      print() {},
      printErr(message) { if (message) self.postMessage({ type: "runtime-log", message: String(message) }); },
      setStatus(status) {
        if (status === "Running...") self.postMessage({ type: "setup-progress", progress: 96 });
      },
      onRuntimeInitialized() {
        try {
          tts = self.createOfflineTts(self.Module);
          if (tts.numSpeakers !== 4) throw new Error(`EXPECTED_4_SPEAKERS_GOT_${tts.numSpeakers}`);
          self.postMessage({
            type: "ready",
            numSpeakers: tts.numSpeakers,
            sampleRate: tts.sampleRate,
            source: new URL(bundle.baseUrl).hostname,
          });
        } catch (error) {
          self.postMessage({ type: "error", scope: "init", message: errorMessage(error) });
        } finally {
          URL.revokeObjectURL(wrapperUrl);
          URL.revokeObjectURL(runtimeUrl);
        }
      },
    };
    importScripts(wrapperUrl);
    importScripts(runtimeUrl);
  } catch (error) {
    initializing = false;
    self.postMessage({ type: "error", scope: "init", message: errorMessage(error) });
  }
}

const PUNCTUATION_PAUSES = new Map([
  ["、", 0.15],
  ["，", 0.3], [",", 0.3],
  ["：", 0.4], [":", 0.4], ["—", 0.4],
  ["；", 0.5], [";", 0.5],
  ["。", 0.6], [".", 0.6],
  ["？", 0.6], ["?", 0.6],
  ["！", 0.6], ["!", 0.6],
  ["…", 0.8],
  ["\n", 0.6],
]);

function splitTextByPunctuation(text) {
  const segments = [];
  const parts = text.split(/([，。！？；：、,.!?;:…—\n]+)/);
  for (let i = 0; i < parts.length; i += 1) {
    const part = (parts[i] || "").trim();
    if (!part) continue;
    segments.push(part);
  }
  return segments;
}

function getPauseForPunct(punct) {
  let maxPause = 0;
  for (const char of punct) {
    const pause = PUNCTUATION_PAUSES.get(char) ?? 0;
    if (pause > maxPause) maxPause = pause;
  }
  return maxPause;
}

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === "init") {
    void initialize(message.baseUrls || []);
    return;
  }
  if (message.type !== "generate" || !tts) return;
  try {
    const sid = Math.max(0, Math.min(3, Number(message.sid) || 0));
    const speed = Math.max(0.5, Math.min(2, Number(message.speed) || 1));
    const text = String(message.text || "");
    const sampleRate = tts.sampleRate;
    const segments = splitTextByPunctuation(text);
    const chunks = [];
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      if (/^[，。！？；：、,.!?;:…—\n]+$/.test(seg)) continue;
      const audio = tts.generate({ text: seg, sid, speed });
      chunks.push(audio.samples);
      if (i < segments.length - 1) {
        let pause = 0;
        for (let j = i + 1; j < segments.length; j += 1) {
          if (/^[，。！？；：、,.!?;:…—\n]+$/.test(segments[j])) {
            const p = getPauseForPunct(segments[j]);
            if (p > pause) pause = p;
          } else break;
        }
        if (pause > 0) {
          chunks.push(new Float32Array(Math.round(sampleRate * pause)));
        }
      }
    }
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    self.postMessage({
      type: "result",
      requestId: message.requestId,
      samples: combined,
      sampleRate,
    }, [combined.buffer]);
  } catch (error) {
    self.postMessage({ type: "error", scope: "generate", requestId: message.requestId, message: errorMessage(error) });
  }
};
