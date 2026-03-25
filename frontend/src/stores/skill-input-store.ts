import { create } from "zustand";
import type { SkillInputField } from "#/utils/parse-skill-inputs";

interface PendingSkillInput {
  skillName: string;
  trigger: string | undefined;
  inputs: SkillInputField[];
}

interface SkillInputStore {
  pending: PendingSkillInput | null;
  visible: boolean;
  setPending: (pending: PendingSkillInput) => void;
  show: () => void;
  clear: () => void;
}

export const useSkillInputStore = create<SkillInputStore>((set) => ({
  pending: null,
  visible: false,
  setPending: (pending) => set({ pending, visible: false }),
  show: () => set({ visible: true }),
  clear: () => set({ pending: null, visible: false }),
}));
