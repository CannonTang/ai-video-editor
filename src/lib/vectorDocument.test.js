import { describe, expect, it } from "vitest";

import { createEditableVectorDocument, inferVectorPartKind, updateVectorPart } from "./vectorDocument.js";

describe("structured vector documents", () => {
  it("infers beginner-friendly part kinds from each element's actual structure", () => {
    expect(inferVectorPartKind({ tag: "g", childTags: ["rect", "rect", "rect"] })).toBe("rectangleGroup");
    expect(inferVectorPartKind({ tag: "g", childTags: ["circle", "circle"] })).toBe("pointGroup");
    expect(inferVectorPartKind({ tag: "path", strokeOnly: true })).toBe("line");
    expect(inferVectorPartKind({ tag: "text" })).toBe("text");
  });

  it("fails safely when an SVG parser is unavailable", () => {
    const body = '<path d="M0 0L10 10" stroke="#fff"/>';
    expect(createEditableVectorDocument(body, {})).toEqual({
      body,
      parts: [],
      supported: false,
    });
    expect(updateVectorPart(body, "vector-part-1", { color: "#ff0000" }, {})).toEqual({
      body,
      parts: [],
      supported: false,
    });
  });
});
