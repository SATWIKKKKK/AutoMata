export type BillingPlan = 'free' | 'pro' | 'team';
export type BillingInterval = 'monthly' | 'semiannual' | 'annual';

export type PlanLimits = {
  activeDomains: number | 'all';
  questionsPerDay: number | 'unlimited';
  practiceSessions: number | 'unlimited';
  mockInterviewsPerMonth: number | 'unlimited';
  codingRoundsPerMonth: number | 'unlimited';
  scenarioRounds: boolean | 'unlimited';
  githubRepos: number | 'unlimited';
  pdfExport: boolean;
  teamFeatures: boolean;
};

export type SubscriptionState = {
  plan: BillingPlan;
  status: string;
  provider: string;
  billingInterval: BillingInterval;
  seats: number;
  currentPeriodEnd: string | null;
  limits: PlanLimits;
};

export type BillingOrder = {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: 'INR';
  plan: BillingPlan;
  billingInterval: BillingInterval;
  seats: number;
  name: string;
  description: string;
  prefill: {
    name?: string;
    email?: string;
  };
};

export type BillingOrderResponse = BillingOrder | {
  success: boolean;
  subscription: SubscriptionState;
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requestJson<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    });
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) {
      return { ok: false, error: String(data.error ?? 'Request failed.') };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network request failed.' };
  }
}

export async function fetchSubscription(): Promise<ApiResult<SubscriptionState>> {
  const result = await requestJson<{ subscription: SubscriptionState }>('/api/billing/subscription');
  if (result.ok === false) return result;
  return { ok: true as const, data: result.data.subscription };
}

export async function createBillingOrder(payload: {
  plan: BillingPlan;
  billingInterval: BillingInterval;
  seats?: number;
}): Promise<ApiResult<BillingOrderResponse>> {
  return requestJson<BillingOrderResponse>('/api/billing/create-order', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyBillingPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<ApiResult<SubscriptionState>> {
  const result = await requestJson<{ success: boolean; subscription: SubscriptionState }>('/api/billing/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (result.ok === false) return result;
  return { ok: true as const, data: result.data.subscription };
}
