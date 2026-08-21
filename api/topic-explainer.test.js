import { describe, expect, it } from "vitest";
import { extractText } from "./topic-explainer.js";

describe("extractText", () => {
  it("reads a plain JSON reply", () => {
    expect(extractText('{"text": "A sliding window keeps a moving range over the input."}')).toBe(
      "A sliding window keeps a moving range over the input.",
    );
  });

  it("reads JSON wrapped in a fenced code block", () => {
    expect(extractText('```json\n{"text": "Explanation here."}\n```')).toBe("Explanation here.");
  });

  it("reads JSON the model wrapped in prose", () => {
    expect(extractText('Sure, here you go: {"text": "Explanation here."} Hope that helps!')).toBe(
      "Explanation here.",
    );
  });

  it("is null for content with no JSON object at all", () => {
    expect(extractText("Sorry, I cannot help with that.")).toBeNull();
  });

  it("is null for null content", () => {
    expect(extractText(null)).toBeNull();
  });

  it("is null when the text field is missing or empty", () => {
    expect(extractText('{"text": ""}')).toBeNull();
    expect(extractText("{}")).toBeNull();
  });

  it("truncates an unreasonably long explanation rather than storing it whole", () => {
    const long = "a".repeat(1000);
    const result = extractText(`{"text": "${long}"}`);
    expect(result).toHaveLength(700);
  });
});
