import { describe, expect, it } from "vitest";

import {
  buildVectorDesignPrompt,
  detectGeminiNanoVectorSupport,
  detectVectorRequestLanguage,
  extractVectorXml,
  translateVectorRequestToEnglish,
} from "./geminiNanoVector.js";

describe("Gemini Nano vector generation", () => {
  it("detects the current Prompt API without starting a download", async () => {
    const scope = {
      LanguageModel: {
        availability: async () => "downloadable",
        create: () => {
          throw new Error("should not create a model during detection");
        },
      },
      LanguageDetector: {
        availability: async () => "available",
        create: async () => ({}),
      },
      Translator: {
        availability: async () => "available",
        create: async () => ({}),
      },
    };
    await expect(detectGeminiNanoVectorSupport(scope)).resolves.toMatchObject({
      supported: true,
      availability: "downloadable",
      apiKind: "current",
    });
  });

  it("requires a local English translation path for non-English requests", async () => {
    const scope = {
      LanguageModel: {
        availability: async () => "available",
        create: async () => ({}),
      },
      LanguageDetector: {
        availability: async () => "available",
        create: async () => ({}),
      },
    };
    await expect(detectGeminiNanoVectorSupport(scope, "zh")).resolves.toMatchObject({
      supported: false,
      availability: "available",
      translationAvailability: "unavailable",
    });
  });

  it("extracts only the vector XML envelope", () => {
    expect(extractVectorXml("```xml\n<vector><svg viewBox=\"0 0 10 10\"><path d=\"M0 0\"/></svg></vector>\n```"))
      .toContain("<svg");
    expect(() => extractVectorXml("No vector was generated.")).toThrow("SVG_ROOT_MISSING");
  });

  it("accepts a complete bare SVG without a vector wrapper", () => {
    expect(extractVectorXml(`Some extra prose
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200"><path d="M0 0"/></svg>
More extra prose`)).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200"><path d="M0 0"/></svg>`,
    );
  });

  it("recovers a complete SVG when Gemini omits the closing vector tag", () => {
    const raw = `Here is the result:
\`\`\`xml
<vector name="five-pointed star"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200">
  <polygon points="600,20 800,100 900,300 600,400 300,300 100,100 20,20" fill="#FFD700"/>
</svg>
\`\`\`
This trailing explanation must be ignored.`;
    expect(extractVectorXml(raw)).toBe(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200">
  <polygon points="600,20 800,100 900,300 600,400 300,300 100,100 20,20" fill="#FFD700"/>
</svg>`);
  });

  it("translates every non-English request before prompt construction", async () => {
    let translatedInput = "";
    const scope = {
      Translator: {
        availability: async () => "available",
        create: async () => ({
          translate: async (value) => {
            translatedInput = value;
            return "A clean teal paper plane";
          },
        }),
      },
      LanguageDetector: {
        availability: async () => "available",
        create: async () => ({
          detect: async () => [{ detectedLanguage: "zh", confidence: 0.99 }],
        }),
      },
    };
    await expect(detectVectorRequestLanguage({
      request: "一个简洁的青色纸飞机",
      fallbackLanguage: "en",
      scope,
    })).resolves.toBe("zh");
    await expect(translateVectorRequestToEnglish({
      request: "一个简洁的青色纸飞机",
      sourceLanguage: "zh",
      scope,
    })).resolves.toBe("A clean teal paper plane");
    expect(translatedInput).toBe("一个简洁的青色纸飞机");
  });

  it("constrains the model to a transparent vector envelope", () => {
    const prompt = buildVectorDesignPrompt("A teal paper plane");
    expect(prompt).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(prompt).toContain('viewBox="0 0 1200 1200"');
    expect(prompt).toContain("Transparent background");
    expect(prompt).not.toContain("<vector");
  });
});
