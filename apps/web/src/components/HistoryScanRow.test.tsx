import type { Scan } from "@secure-scan/contracts";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { HistoryScanRow } from "./HistoryScanRow";

const scan: Scan = {
  id: "scan-1",
  title: "History report",
  language: "TypeScript",
  codePreview: "const value = true",
  provider: "groq",
  model: "model",
  summary: "A saved report.",
  findings: [],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

describe("HistoryScanRow", () => {
  it("exposes accessible accordion state and expanded report actions", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <MemoryRouter><HistoryScanRow scan={scan} expanded={false} onToggle={onToggle} onDelete={vi.fn()} /></MemoryRouter>,
    );
    const trigger = screen.getByRole("button", { name: "Expand History report" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(<MemoryRouter><HistoryScanRow scan={scan} expanded onToggle={onToggle} onDelete={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Collapse History report" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /View full report/ })).toHaveAttribute("href", "/history/scan-1");
    expect(screen.getByRole("link", { name: "JSON" })).toHaveAttribute("href", "/api/scans/scan-1/export?download=1");
  });
});
