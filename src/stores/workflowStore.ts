import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  prompt?: string;
  dag?: any;
  status: 'draft' | 'active' | 'paused' | 'archived';
  cronSchedule?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface WorkflowState {
  workflows: Workflow[];
  selectedWorkflowId: string | null;
  lastFetchedAt: number | null;
  setWorkflows: (workflows: Workflow[]) => void;
  addWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  removeWorkflow: (id: string) => void;
  setSelected: (id: string | null) => void;
  invalidateCache: () => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set) => ({
      workflows: [],
      selectedWorkflowId: null,
      lastFetchedAt: null,

      setWorkflows: (workflows) =>
        set({ workflows, lastFetchedAt: Date.now() }),

      addWorkflow: (workflow) =>
        set((s) => ({ workflows: [workflow, ...s.workflows] })),

      updateWorkflow: (id, updates) =>
        set((s) => ({
          workflows: s.workflows.map((w) =>
            w.id === id ? { ...w, ...updates } : w,
          ),
        })),

      removeWorkflow: (id) =>
        set((s) => ({
          workflows: s.workflows.filter((w) => w.id !== id),
          selectedWorkflowId:
            s.selectedWorkflowId === id ? null : s.selectedWorkflowId,
        })),

      setSelected: (id) => set({ selectedWorkflowId: id }),

      invalidateCache: () => set({ lastFetchedAt: null }),
    }),
    {
      name: 'orren-workflows',
      partialize: (s) => ({
        workflows: s.workflows,
        lastFetchedAt: s.lastFetchedAt,
        selectedWorkflowId: s.selectedWorkflowId,
      }),
    },
  ),
);
