import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScanResults } from "./ScanResults";

describe("ScanResults", () => {
  it("renders structured findings and remediation", () => {
    render(
      <ScanResults
        scan={{
          id: "scan-1",
          title: "Authentication review",
          language: "TypeScript",
          codePreview: "const token = request.query.token",
          provider: "groq",
          model: "security-model",
          summary: "One issue was found.",
          findings: [
            {
              severity: "high",
              title: "Untrusted token input",
              lineStart: 3,
              explanation: "The token is accepted from an untrusted query parameter.",
              remediation: "Read the token from an authenticated, validated session.",
            },
          ],
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        }}
      />,
    );

    expect(screen.getByText("Untrusted token input")).toBeInTheDocument();
    expect(screen.getByText("Recommended fix")).toBeInTheDocument();
    expect(screen.getByText(/authenticated, validated session/)).toBeInTheDocument();
  });
});
