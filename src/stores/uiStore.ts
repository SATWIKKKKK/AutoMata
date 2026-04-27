import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WorkflowFilter = 'all' | 'active' | 'paused' | 'draft';
type WorkflowSort = 'newest' | 'oldest' | 'most-runs' | 'highest-cost';
type BillingCycle = 'monthly' | 'yearly';

interface UIState {
  builderSearch: string;
  workflowFilter: WorkflowFilter;
  workflowSort: WorkflowSort;
  pricingBillingCycle: BillingCycle;
  setBuilderSearch: (q: string) => void;
  setWorkflowFilter: (f: WorkflowFilter) => void;
  setWorkflowSort: (s: WorkflowSort) => void;
  setPricingCycle: (c: BillingCycle) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      builderSearch: '',
      workflowFilter: 'all',
      workflowSort: 'newest',
      pricingBillingCycle: 'monthly',
      setBuilderSearch: (builderSearch) => set({ builderSearch }),
      setWorkflowFilter: (workflowFilter) => set({ workflowFilter }),
      setWorkflowSort: (workflowSort) => set({ workflowSort }),
      setPricingCycle: (pricingBillingCycle) => set({ pricingBillingCycle }),
    }),
    { name: 'orren-ui' },
  ),
);
