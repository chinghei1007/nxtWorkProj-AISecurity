import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BrowserModelSelection =
  | { source: "SERVER"; profileId: string }
  | { source: "USER"; provider: "gemini"; model: string };

type ModelState = {
  selection: BrowserModelSelection;
  setSelection: (selection: BrowserModelSelection) => void;
};

export const useModelStore = create<ModelState>()(persist(
  (set) => ({
    selection: { source: "SERVER", profileId: "groq-default" },
    setSelection: (selection) => set({ selection }),
  }),
  { name: "sentinel.model.preference.v1" },
));

const GEMINI_SESSION_KEY = "sentinel.gemini.key.v1";

export function readSessionGeminiKey() {
  try {
    return sessionStorage.getItem(GEMINI_SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeSessionGeminiKey(value: string) {
  if (value) sessionStorage.setItem(GEMINI_SESSION_KEY, value);
  else sessionStorage.removeItem(GEMINI_SESSION_KEY);
}
