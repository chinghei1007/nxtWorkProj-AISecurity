import type { Finding } from "@secure-scan/contracts";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FindingsViewer } from "./FindingsViewer";

const findings: Finding[] = [
  {
    severity: "low",
    title: "Low finding",
    lineStart: 2,
    explanation: "Low explanation.",
    remediation: "Low fix.",
    storyPoints: 1,
    instructionsMarkdown: "Low instructions.",
    priority: 2,
    originalIndex: 0,
  },
  {
    severity: "high",
    title: "High finding",
    lineStart: 10,
    explanation: "High explanation.",
    remediation: "High fix.",
    storyPoints: 5,
    instructionsMarkdown: "High instructions.",
    priority: 1,
    originalIndex: 1,
  },
];

describe("FindingsViewer", () => {
  it("sorts deterministically and supports multi-select filters", () => {
    render(<FindingsViewer findings={findings} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent))
      .toEqual(["High finding", "Low finding"]);

    fireEvent.click(screen.getByLabelText("high"));
    expect(screen.queryByText("High finding")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2 findings. Story points are model estimates, not guaranteed completion times.")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("high"));
    fireEvent.click(screen.getByRole("button", { name: "Sort descending" }));
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent))
      .toEqual(["Low finding", "High finding"]);
  });

  it("filters by story points", () => {
    render(<FindingsViewer findings={findings} />);
    fireEvent.click(screen.getByLabelText("5 pts"));
    expect(screen.queryByText("High finding")).not.toBeInTheDocument();
    expect(screen.getByText("Low finding")).toBeInTheDocument();
  });
});
