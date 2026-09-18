import { type Conversation, type CasePriority } from './inbox-data';

export interface SalesOutcome {
  conversationId: string;
  salesAmount: number;
  salesSuccessful: boolean;
  resolution: string;
  issueType: string;
  closedBy: string;
  closedAt: string;
}

/**
 * Checks if a closed conversation can be automatically reopened based on the 24-hour window rule.
 */
export function isWithinReopenWindow(closedAt?: string, windowHours = 24): boolean {
  if (!closedAt) return true;
  const closedTime = new Date(closedAt).getTime();
  const now = Date.now();
  const diffHours = (now - closedTime) / (1000 * 60 * 60);
  return diffHours <= windowHours;
}

/**
 * Evaluates whether a conversation has been inactive longer than the threshold.
 */
export function isConversationInactive(updatedAt: string, daysThreshold = 7): boolean {
  const updatedTime = new Date(updatedAt).getTime();
  const now = Date.now();
  const diffDays = (now - updatedTime) / (1000 * 60 * 60 * 24);
  return diffDays >= daysThreshold;
}

/**
 * Formats a currency number into Thai Baht representation.
 */
export function formatCurrencyTHB(amount?: number): string {
  if (amount === undefined || amount === null) return '฿0';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Summarizes sales and case metrics from a list of conversations.
 */
export function calculateCaseMetrics(conversations: Conversation[]) {
  const total = conversations.length;
  const closed = conversations.filter((c) => c.status === 'closed');
  const open = conversations.filter((c) => c.status === 'open');

  const successfulSales = closed.filter((c) => Boolean(c.sales_successful));
  const totalSalesRevenue = successfulSales.reduce((acc, c) => acc + (c.sales_amount || 0), 0);
  const conversionRate = closed.length > 0 ? (successfulSales.length / closed.length) * 100 : 0;

  const urgentCount = open.filter((c) => c.priority === 'urgent').length;
  const highCount = open.filter((c) => c.priority === 'high').length;

  return {
    total,
    openCount: open.length,
    closedCount: closed.length,
    successfulSalesCount: successfulSales.length,
    totalSalesRevenue,
    conversionRate: Math.round(conversionRate * 10) / 10,
    urgentCount,
    highCount,
  };
}
