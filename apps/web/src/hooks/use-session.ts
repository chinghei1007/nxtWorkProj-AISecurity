import { useQuery } from "@tanstack/react-query";
import { ApiError, api } from "../lib/api";
import type { SessionPayload } from "../types";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        return await api<SessionPayload>("/api/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
}
