import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetModelSourceRoutingForTests,
  fetchFirstAvailableModel,
  getModelSourcePreference,
  mirroredModelFileUrls,
  orderModelUrlsForNetwork,
  orderModelSourceUrls,
} from "./modelSources.js";

afterEach(() => {
  __resetModelSourceRoutingForTests();
  vi.unstubAllGlobals();
});

describe("model source mirrors", () => {
  it("uses language as the initial hint before network routing is learned", () => {
    expect(getModelSourcePreference("zh-CN")).toBe("modelscope");
    expect(getModelSourcePreference("en")).toBe("huggingface");
  });

  it("builds revision-pinned ModelScope and Hugging Face candidates", () => {
    const urls = mirroredModelFileUrls({
      repository: "timeline-studio-vocal-remover",
      revision: "abc123",
      path: "model.json",
      preference: "modelscope",
    });
    expect(urls).toEqual([
      "https://www.modelscope.cn/models/martindelophy/timeline-studio-vocal-remover/resolve/abc123/model.json",
      "https://huggingface.co/haixin/timeline-studio-vocal-remover/resolve/abc123/model.json",
    ]);
  });

  it("deduplicates identical source URLs", () => {
    expect(orderModelSourceUrls("https://example.com/model", "https://example.com/model")).toEqual([
      "https://example.com/model",
    ]);
  });

  it("falls back when the preferred source fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("model"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchFirstAvailableModel(["https://first.test/model", "https://second.test/model"]);
    expect(await result.response.text()).toBe("model");
    expect(result.url).toBe("https://second.test/model");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("selects the first reachable public mirror and remembers it for the session", async () => {
    const huggingFaceUrl = "https://huggingface.co/haixin/example/resolve/revision/model.onnx";
    const modelScopeUrl = "https://www.modelscope.cn/models/martindelophy/example/resolve/revision/model.onnx";
    const fetchMock = vi.fn((url, init) => {
      if (init?.method === "HEAD") {
        if (String(url).includes("modelscope.cn")) return Promise.resolve(new Response("", { status: 200 }));
        return new Promise((resolve) => setTimeout(() => resolve(new Response("", { status: 200 })), 20));
      }
      return Promise.resolve(new Response("model"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const ordered = await orderModelUrlsForNetwork([huggingFaceUrl, modelScopeUrl]);
    expect(ordered[0]).toBe(modelScopeUrl);

    const nextOrdered = await orderModelUrlsForNetwork([huggingFaceUrl, modelScopeUrl]);
    expect(nextOrdered[0]).toBe(modelScopeUrl);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "HEAD")).toHaveLength(2);
  });
});
