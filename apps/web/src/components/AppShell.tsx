import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  History,
  LogOut,
  Menu,
  ScanLine,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { ModelsPayload } from "../types";
import { useSession } from "../hooks/use-session";

const baseNavigation = [
  { to: "/scan", label: "New scan", icon: ScanLine },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const session = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const models = useQuery({
    queryKey: ["models"],
    queryFn: () => api<ModelsPayload>("/api/models"),
  });
  const logout = useMutation({
    mutationFn: () => api<void>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });

  const user = session.data!.user;
  const navigation = user.role === "ADMIN"
    ? [...baseNavigation, { to: "/users", label: "Users", icon: Users }]
    : baseNavigation;
  const activeModel = models.data?.models.find((model) => model.selected);

  const nav = (
    <>
      <div className="flex h-20 items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500 text-white">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold tracking-tight text-white">Sentinel</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              Secure scan
            </p>
          </div>
        </div>
        <button
          className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Primary navigation">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition " +
                (isActive
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-950/20"
                  : "text-slate-300 hover:bg-white/10 hover:text-white")
              }
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        {activeModel && (
          <div className="mb-4 rounded-xl bg-white/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Active model
            </p>
            <p className="mt-1 truncate text-xs font-medium text-slate-200">{activeModel.label}</p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-700 text-xs font-bold text-white">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.username}</p>
            <p className="text-xs capitalize text-slate-400">{user.role.toLowerCase()}</p>
          </div>
          <button
            onClick={() => logout.mutate()}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy lg:flex">
        {nav}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation overlay"
          />
          <aside className="relative flex h-full w-72 flex-col bg-navy">{nav}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-slate-200 p-2 text-slate-700"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Shield className="h-4 w-4 text-blue-600" />
            Sentinel
          </span>
          <span className="w-9" />
        </div>
        <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
