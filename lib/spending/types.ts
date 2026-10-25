export interface SpendingTransaction {
  id: string;
  accountId: string;
  date: string;
  descriptionRaw: string;
  merchant: string;
  amountGbp: number;
  direction: "in" | "out";
  type: string;
  balanceAfterGbp: number;
  category: string | null;
  categorySource: "rule" | "manual" | "import" | "builtin" | null;
  isTransfer: boolean;
  subscriptionId: string | null;
  statementMonth: string;
  notes: string | null;
  createdAt: string;
}

export interface CategorySpend {
  category: string;
  spend: number;
  previousSpend: number;
  change: number;
}

export interface MerchantSpend {
  merchant: string;
  spend: number;
  count: number;
}

export interface MonthTrend {
  month: string;
  spend: number;
  income: number;
}

export interface SpendingTotals {
  spend: number;
  income: number;
  savings: number;
  savingsRate: number | null;
  transferOut: number;
}

export interface RecurringCandidate {
  merchant: string;
  amountGbp: number;
  count: number;
  months: string[];
  reason: "monthly" | "matching_amount";
  spendingCategory: string | null;
  possibleDuplicate: {
    id: string;
    name: string;
    costGbp: number;
  } | null;
}

export interface DuplicateSubscription {
  ids: [string, string];
  names: [string, string];
  reason: string;
}

export interface SpendingReport {
  month: string;
  months: string[];
  totals: SpendingTotals;
  previous: { month: string; spend: number; income: number } | null;
  byCategory: CategorySpend[];
  trend: MonthTrend[];
  topMerchants: MerchantSpend[];
  transactions: SpendingTransaction[];
  categories: string[];
  recurring: RecurringCandidate[];
  duplicateSubscriptions: DuplicateSubscription[];
}
