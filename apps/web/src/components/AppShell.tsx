import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../lib/api";
import { useModelStore } from "../store/model";
import type { ModelsPayload } from "../types";

const navigation = [
  { to: "/scan", label: "New scan" },
  { to: "/history", label: "History & archive" },
  { to: "/settings", label: "Models" },
];

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const selection = useModelStore((state) => state.selection);
  const models = useQuery({ queryKey: ["models"], queryFn: () => api<ModelsPayload>("/api/models") });
  const activeModel = selection.source === "SERVER"
    ? models.data?.models.find((model) => model.id === selection.profileId)?.label
    : `Personal Gemini · ${selection.model}`;

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to main content</a>
      <header className="border-b border-orange-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <NavLink to="/scan" className="mr-auto text-lg font-bold text-stone-900">AI Security Check</NavLink>
          <button type="button" className="rounded-md border border-orange-800 px-3 py-2 text-orange-900 md:hidden" aria-expanded={mobileOpen} aria-controls="primary-navigation" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? "Close menu" : "Menu"}</button>
          <nav id="primary-navigation" aria-label="Primary navigation" className={`${mobileOpen ? "flex" : "hidden"} w-full flex-col gap-1 md:flex md:w-auto md:flex-row md:items-center`}>
            {navigation.map((item) => <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-800 ${isActive ? "bg-orange-800 text-white" : "text-stone-700 hover:bg-orange-50"}`}>{item.label}</NavLink>)}
          </nav>
          {activeModel && <span className="hidden max-w-48 truncate text-xs text-stone-600 lg:block" title={activeModel}>Active: {activeModel}</span>}
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 lg:px-8 lg:py-9"><Outlet /></main>
      <footer className="border-t border-orange-100 px-4 py-5 text-sm text-stone-600"><div className="mx-auto max-w-7xl">AI Security Check · Server reports expire after 24 hours. Save JSON locally to keep one.</div></footer>
    </div>
  );
}
