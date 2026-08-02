import type { ScanExport } from "@secure-scan/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JsonReportViewer } from "./JsonReportViewer";

const report: ScanExport = {
  schemaVersion: "1.0",
  exportedAt: new Date(0).toISOString(),
  scan: {
    id: "scan-1",
    title: "Report",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    language: "TypeScript",
    sourceHash: "hash",
    codePreview: "const value = true",
    provider: "groq",
    model: "model",
    summary: "Safe.",
  },
  fixQueue: [],
};

describe("JsonReportViewer", () => {
  it("formats, copies, and links to the download export", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const onDownload = vi.fn();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<JsonReportViewer report={report} onDownload={onDownload} />);
    expect(screen.getByText(/"schemaVersion": "1.0"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(JSON.stringify(report, null, 2)));
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(onDownload).toHaveBeenCalledOnce();
  });
});
