import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownInstructions } from "./MarkdownInstructions";

describe("MarkdownInstructions", () => {
  it("renders GFM while dropping raw HTML and unsafe links", () => {
    const { container } = render(
      <MarkdownInstructions>
        {"## Safe steps\n- Use `validate()`\n<script>alert('x')</script>\n[unsafe](javascript:alert(1))\n[safe](https://example.com)"}
      </MarkdownInstructions>,
    );
    expect(screen.getByText("Safe steps")).toBeInTheDocument();
    expect(screen.getByText("validate()")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("unsafe").closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "safe" })).toHaveAttribute("href", "https://example.com");
  });
});
