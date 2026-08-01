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
              storyPoints: 2,
              instructionsMarkdown: "1. Read the token from the **session**.\n2. Validate it.",
              priority: 1,
              originalIndex: 0,
            },
          ],
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        }}
      />,
    );

    expect(screen.getByText("Untrusted token input")).toBeInTheDocument();
    expect(screen.getByText("Remediation summary")).toBeInTheDocument();
    expect(screen.getByText(/authenticated, validated session/)).toBeInTheDocument();
    expect(screen.getByText("session")).toBeInTheDocument();
    expect(screen.getByText("Source snippet unavailable")).toBeInTheDocument();
  });
});
