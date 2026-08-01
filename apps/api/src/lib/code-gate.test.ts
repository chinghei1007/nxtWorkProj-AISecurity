import { describe, expect, it } from "vitest";
import { detectLanguage, looksLikeCode } from "./code-gate.js";

describe("looksLikeCode", () => {
  it.each([
    ["JavaScript", "const answer = () => { return 42; };"],
    ["TypeScript", "interface User { id: string; active: boolean }"],
    ["Python", "def greet(name):\n    return f'Hello {name}'"],
    ["JSON", '{"enabled": true, "count": 2}'],
    ["CSS", ".button { color: red; padding: 1rem; }"],
    ["Shell", "#!/bin/bash\nfor file in *.txt; do echo $file; done"],
  ])("accepts %s", (_language, source) => {
    expect(looksLikeCode(source)).toBe(true);
  });

  it.each(["Hello, how are you today?", "Please review my application for problems.", "", "short"])(
    "rejects prose: %s",
    (source) => expect(looksLikeCode(source)).toBe(false),
  );

  it("rejects input beyond the maximum", () => {
    expect(looksLikeCode("const value = 1;" + " ".repeat(50_000))).toBe(false);
  });
});

describe("detectLanguage", () => {
  it("detects Python", () => {
    expect(detectLanguage("def greet(name):\n    return name")).toBe("Python");
  });
});
