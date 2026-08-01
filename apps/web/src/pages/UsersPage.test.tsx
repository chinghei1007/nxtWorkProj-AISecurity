import type { User } from "@secure-scan/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/api", () => ({ api: apiMock, messageFrom: (error: unknown) => String(error) }));
vi.mock("../hooks/use-session", () => ({ useSession: () => ({ data: { user: { id: "admin-self" } } }) }));
vi.mock("../components/UserRegistrationPanel", () => ({ UserRegistrationPanel: () => <aside>Registration</aside> }));

import { UsersPage } from "./UsersPage";

function user(id: string, username: string): User {
  return {
    id,
    username,
    role: "USER",
    status: "ACTIVE",
    accessTier: "LIMITED",
    expiresAt: null,
    effectiveStatus: "ACTIVE",
    mustChangePassword: false,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

describe("UsersPage", () => {
  it("keeps explicit selections across pages and sends one batch action", async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/api/admin/users/batch-actions") {
        return { results: [{ userId: "a", status: "updated", user: user("a", "alice") }, { userId: "b", status: "updated", user: user("b", "bob") }], summary: { requested: 2, succeeded: 2, failed: 0 } };
      }
      const secondPage = path.includes("page=2");
      return { users: [secondPage ? user("b", "bob") : user("a", "alice")], pagination: { page: secondPage ? 2 : 1, pageSize: 50, total: 2, totalPages: 2 } };
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><UsersPage /></QueryClientProvider>);
    await screen.findByText("alice");
    fireEvent.click(screen.getByLabelText("Select alice"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("bob");
    fireEvent.click(screen.getByLabelText("Select bob"));
    expect(screen.getByText("2 accounts selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disable" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith(
      "/api/admin/users/batch-actions",
      expect.objectContaining({ body: expect.stringContaining('"userIds":["a","b"]') }),
    ));
  });
});
