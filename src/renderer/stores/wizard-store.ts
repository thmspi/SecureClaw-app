import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type WizardStep = 'welcome' | 'prerequisites' | 'install' | 'complete';
export type PrerequisiteStatus = 'passed' | 'failed' | 'warning' | 'pending';

export interface PrerequisiteCheck {
  id: string;
  name: string;
  description: string;
  status: PrerequisiteStatus;
  result: { value?: string; required?: string; message: string };
}

export interface InstallProgressState {
  status: 'idle' | 'running' | 'paused' | 'failed' | 'completed';
  currentStep: number;
  totalSteps: number;
  stepName: string;
  progress: number;
  estimatedTimeRemaining?: number;
  error?: { message: string; details?: string };
  logs: string[];
}

interface WizardState {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  prerequisites: Record<string, PrerequisiteCheck>;
  prerequisitesLoading: boolean;
  allPrerequisitesPassed: boolean;
  install: InstallProgressState;
  selectedTarget: 'openclaw' | 'nemoclaw' | null;

  // Actions
  setStep: (step: WizardStep) => void;
  canNavigateTo: (step: WizardStep) => boolean;
  setPrerequisitesLoading: (loading: boolean) => void;
  updatePrerequisite: (id: string, check: PrerequisiteCheck) => void;
  setAllPrerequisitesPassed: (passed: boolean) => void;
  updateInstallProgress: (progress: Partial<InstallProgressState>) => void;
  appendLog: (line: string) => void;
  setSelectedTarget: (target: 'openclaw' | 'nemoclaw') => void;
  reset: () => void;
}

const initialInstallState: InstallProgressState = {
  status: 'idle',
  currentStep: 0,
  totalSteps: 5,
  stepName: '',
  progress: 0,
  logs: [],
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      currentStep: 'welcome',
      completedSteps: [],
      prerequisites: {},
      prerequisitesLoading: false,
      allPrerequisitesPassed: false,
      install: initialInstallState,
      selectedTarget: null,

      setStep: (step) => {
        const { currentStep, completedSteps } = get();
        set({
          currentStep: step,
          completedSteps: completedSteps.includes(currentStep)
            ? completedSteps
            : [...completedSteps, currentStep],
        });
      },

      canNavigateTo: (step) => {
        const { completedSteps, currentStep } = get();
        return step === currentStep || completedSteps.includes(step);
      },

      setPrerequisitesLoading: (loading) => set({ prerequisitesLoading: loading }),

      updatePrerequisite: (id, check) =>
        set((s) => ({
          prerequisites: { ...s.prerequisites, [id]: check },
        })),

      setAllPrerequisitesPassed: (passed) => set({ allPrerequisitesPassed: passed }),

      updateInstallProgress: (progress) =>
        set((s) => ({
          install: { ...s.install, ...progress },
        })),

      appendLog: (line) =>
        set((s) => ({
          install: { ...s.install, logs: [...s.install.logs, line] },
        })),

      setSelectedTarget: (target) => set({ selectedTarget: target }),

      reset: () =>
        set({
          currentStep: 'welcome',
          completedSteps: [],
          prerequisites: {},
          prerequisitesLoading: false,
          allPrerequisitesPassed: false,
          install: initialInstallState,
          selectedTarget: null,
        }),
    }),
    {
      name: 'secureclaw-wizard',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        prerequisites: state.prerequisites,
        selectedTarget: state.selectedTarget,
        // Don't persist: logs, running state, loading state
      }),
    }
  )
);
