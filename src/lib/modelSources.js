export const MODEL_SOURCE_PREFERENCE_KEY = "timeline-studio-model-source";
export const MODEL_SCOPE_OWNER = "martindelophy";

const UI_LANGUAGE_STORAGE_KEY = "ai-voiceover-ui-language";
const VALID_PREFERENCES = new Set(["auto", "huggingface", "modelscope"]);
const MODEL_SOURCE_PROBE_TIMEOUT_MS = 2_500;

let runtimeModelSource = "";
let modelSourceProbePromise = null;
let modelSourceProbeCompleted = false;

function readLocalStorage(key) {
  try {
    return globalThis.localStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

export function getModelSourcePreference(language = "") {
  const storedPreference = readLocalStorage(MODEL_SOURCE_PREFERENCE_KEY);
  if (VALID_PREFERENCES.has(storedPreference) && storedPreference !== "auto") {
    return storedPreference;
  }
  const activeLanguage = language || readLocalStorage(UI_LANGUAGE_STORAGE_KEY)
    || globalThis.navigator?.language || "";
  return String(activeLanguage).toLowerCase().startsWith("zh") ? "modelscope" : "huggingface";
}

export function orderModelSourceUrls(huggingFaceUrl, modelScopeUrl, preference = getModelSourcePreference()) {
  const ordered = preference === "modelscope"
    ? [modelScopeUrl, huggingFaceUrl]
    : [huggingFaceUrl, modelScopeUrl];
  return [...new Set(ordered.filter(Boolean))];
}

function modelSourceFromUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === "huggingface.co" || hostname.endsWith(".huggingface.co")) return "huggingface";
    if (hostname === "modelscope.cn" || hostname.endsWith(".modelscope.cn")) return "modelscope";
  } catch {
    // Non-URL candidates retain their caller-provided order.
  }
  return "";
}

function prioritizeSource(urls, source) {
  if (!source) return urls;
  return [...urls].sort((left, right) => (
    Number(modelSourceFromUrl(right) === source) - Number(modelSourceFromUrl(left) === source)
  ));
}

async function probeFastestModelSource(urls) {
  const sourceCandidates = new Map();
  for (const url of urls) {
    const source = modelSourceFromUrl(url);
    if (source && !sourceCandidates.has(source)) sourceCandidates.set(source, url);
  }
  if (sourceCandidates.size < 2) return "";

  return new Promise((resolve) => {
    const controllers = [];
    let settled = false;
    let remaining = sourceCandidates.size;
    const finish = (source = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const controller of controllers) controller.abort();
      resolve(source);
    };
    const failed = () => {
      remaining -= 1;
      if (remaining === 0) finish();
    };
    const timer = setTimeout(() => finish(), MODEL_SOURCE_PROBE_TIMEOUT_MS);

    for (const [source, url] of sourceCandidates) {
      const controller = new AbortController();
      controllers.push(controller);
      fetch(url, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      }).then((response) => {
        if (response.ok) finish(source);
        else failed();
      }).catch(failed);
    }
  });
}

export async function orderModelUrlsForNetwork(urls) {
  const candidates = [...new Set((urls || []).filter(Boolean))];
  if (runtimeModelSource) return prioritizeSource(candidates, runtimeModelSource);

  if (!modelSourceProbeCompleted) {
    modelSourceProbePromise ??= probeFastestModelSource(candidates)
      .then((source) => {
        runtimeModelSource = source;
        modelSourceProbeCompleted = true;
        return source;
      })
      .finally(() => {
        modelSourceProbePromise = null;
      });
    await modelSourceProbePromise;
  }
  return prioritizeSource(candidates, runtimeModelSource);
}

export function mirroredModelFileUrls({
  repository,
  revision,
  path,
  preference,
  modelScopeOwner = MODEL_SCOPE_OWNER,
}) {
  const suffix = path ? `/${String(path).replace(/^\/+/, "")}` : "";
  const resolvedPreference = preference === "huggingface" || preference === "modelscope"
    ? preference
    : getModelSourcePreference(preference);
  return orderModelSourceUrls(
    `https://huggingface.co/haixin/${repository}/resolve/${revision}${suffix}`,
    `https://www.modelscope.cn/models/${modelScopeOwner}/${repository}/resolve/${revision}${suffix}`,
    resolvedPreference,
  );
}

export function mirroredModelBaseUrls(options) {
  return mirroredModelFileUrls(options).map((url) => `${url.replace(/\/+$/, "")}/`);
}

export function hubModelFileUrls({
  repository,
  revision = "main",
  path,
  preference,
}) {
  const suffix = path ? `/${String(path).replace(/^\/+/, "")}` : "";
  const resolvedPreference = preference === "huggingface" || preference === "modelscope"
    ? preference
    : getModelSourcePreference(preference);
  return orderModelSourceUrls(
    `https://huggingface.co/${repository}/resolve/${revision}${suffix}`,
    `https://www.modelscope.cn/models/${repository}/resolve/${revision}${suffix}`,
    resolvedPreference,
  );
}

export function hubModelBaseUrls(options) {
  return hubModelFileUrls(options).map((url) => `${url.replace(/\/+$/, "")}/`);
}

export function modelHubRemoteHosts(preference) {
  const resolvedPreference = preference === "huggingface" || preference === "modelscope"
    ? preference
    : getModelSourcePreference(preference);
  return orderModelSourceUrls(
    "https://huggingface.co/",
    "https://www.modelscope.cn/models/",
    resolvedPreference,
  );
}

export async function loadFromModelHubs(transformersEnv, loader, preference) {
  const candidates = await orderModelUrlsForNetwork(modelHubRemoteHosts(preference));
  const failures = [];
  for (const remoteHost of candidates) {
    transformersEnv.remoteHost = remoteHost;
    transformersEnv.remotePathTemplate = "{model}/resolve/{revision}/";
    try {
      const result = await loader(remoteHost);
      runtimeModelSource = modelSourceFromUrl(remoteHost) || runtimeModelSource;
      return result;
    } catch (error) {
      failures.push(`${new URL(remoteHost).hostname}: ${error?.message || String(error)}`);
      if (modelSourceFromUrl(remoteHost) === runtimeModelSource) runtimeModelSource = "";
    }
  }
  throw new Error(`MODEL_MIRRORS_UNAVAILABLE: ${failures.join("; ")}`);
}

export function isModelDownloadError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /MODEL_MIRRORS_UNAVAILABLE|failed to fetch|fetch failed|networkerror|load failed/i.test(message);
}

export async function fetchFirstAvailableModel(urls, init) {
  const failures = [];
  const candidates = await orderModelUrlsForNetwork(urls);
  for (const url of candidates) {
    try {
      const response = await fetch(url, init);
      if (response.ok) {
        runtimeModelSource = modelSourceFromUrl(url) || runtimeModelSource;
        return { response, url };
      }
      failures.push(`${new URL(url).hostname}: HTTP ${response.status}`);
    } catch (error) {
      failures.push(`${new URL(url).hostname}: ${error?.message || String(error)}`);
    }
    if (modelSourceFromUrl(url) === runtimeModelSource) runtimeModelSource = "";
  }
  throw new Error(`MODEL_MIRRORS_UNAVAILABLE: ${failures.join("; ")}`);
}

export function __resetModelSourceRoutingForTests() {
  runtimeModelSource = "";
  modelSourceProbePromise = null;
  modelSourceProbeCompleted = false;
}
