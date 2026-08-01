import { create } from "zustand";

type EditorState = {
  title: string;
  source: string;
  setTitle: (title: string) => void;
  setSource: (source: string) => void;
  clear: () => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  title: "",
  source: "",
  setTitle: (title) => set({ title }),
  setSource: (source) => set({ source }),
  clear: () => set({ title: "", source: "" }),
}));
