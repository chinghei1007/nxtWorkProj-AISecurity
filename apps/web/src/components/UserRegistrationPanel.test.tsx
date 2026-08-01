import type { User } from "@secure-scan/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/api", () => ({ api: apiMock, messageFrom: (error: unknown) => String(error) }));

import { UserRegistrationPanel } from "./UserRegistrationPanel";

const createdUser: User = {
  id: "user-1",
  username: "demo-user",
  role: "USER",
  status: "ACTIVE",
  accessTier: "LIMITED",
  expiresAt: null,
  effectiveStatus: "ACTIVE",
  mustChangePassword: true,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

describe("UserRegistrationPanel", () => {
  it("previews pasted CSV and exposes one-time credentials after registration", async () => {
    apiMock.mockResolvedValue({
      results: [{ clientRowId: "row-1", status: "created", user: createdUser, temporaryPassword: "GeneratedPassword123!" }],
      summary: { requested: 1, created: 1, failed: 0 },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><UserRegistrationPanel onChanged={vi.fn()} /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Batch" }));
    fireEvent.change(screen.getByLabelText("CSV data"), {
      target: { value: "username,temporaryPassword,role,accessTier,expiresAt\ndemo-user,,USER,LIMITED," },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse and preview" }));
    expect(screen.getByLabelText("Username row 1")).toHaveValue("demo-user");
    fireEvent.click(screen.getByRole("button", { name: "Register 1 accounts" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/api/admin/users/batch", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByText("1 created · 0 failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download one-time credentials" })).toBeInTheDocument();
  });
});
