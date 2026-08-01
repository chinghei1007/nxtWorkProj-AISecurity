import { describe, expect, it, vi } from "vitest";
import { parseProviderResultWithRepair } from "./providers.js";

const valid = JSON.stringify({
  summary: "One issue was found.",
  findings: [
    {
      severity: "high",
      title: "SQL injection",
      lineStart: 4,
      explanation: "Untrusted input is concatenated into a query.",
      remediation: "Use a parameterized query.",
    },
  ],
});

describe("provider result validation", () => {
  it("accepts a valid structured result without repair", async () => {
    const generate = vi.fn().mockResolvedValue(valid);
    const result = await parseProviderResultWithRepair(generate, "const value = 1;");
    expect(result.findings).toHaveLength(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("repairs one malformed response", async () => {
    const generate = vi.fn()
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce(valid);
    const result = await parseProviderResultWithRepair(generate, "const value = 1;");
    expect(result.summary).toBe("One issue was found.");
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("returns a sanitized error after one failed repair", async () => {
    const generate = vi.fn().mockResolvedValue("not json");
    await expect(parseProviderResultWithRepair(generate, "const value = 1;"))
      .rejects.toMatchObject({ code: "INVALID_PROVIDER_RESPONSE", statusCode: 502 });
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
