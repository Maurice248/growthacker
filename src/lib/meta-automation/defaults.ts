import { prisma } from '@/lib/prisma';
import { META_MIN_DAILY_BUDGET_CENTS } from './types';

export async function getAdAutomationDefaults(companyId: string) {
  const existing = await prisma.adAutomationDefaults.findUnique({
    where: { companyId },
  });

  if (existing) return existing;

  return prisma.adAutomationDefaults.create({
    data: {
      companyId,
      numVariants: 3,
      evalLengthDays: 7,
      dailyBudgetCents: META_MIN_DAILY_BUDGET_CENTS,
      winnerMetric: 'objective_aware',
    },
  });
}

export async function upsertAdAutomationDefaults(
  companyId: string,
  data: {
    numVariants?: number;
    evalLengthDays?: number;
    dailyBudgetCents?: number;
    winnerMetric?: string;
  }
) {
  return prisma.adAutomationDefaults.upsert({
    where: { companyId },
    create: {
      companyId,
      numVariants: data.numVariants ?? 3,
      evalLengthDays: data.evalLengthDays ?? 7,
      dailyBudgetCents: data.dailyBudgetCents ?? META_MIN_DAILY_BUDGET_CENTS,
      winnerMetric: data.winnerMetric ?? 'objective_aware',
    },
    update: {
      ...(data.numVariants !== undefined ? { numVariants: data.numVariants } : {}),
      ...(data.evalLengthDays !== undefined ? { evalLengthDays: data.evalLengthDays } : {}),
      ...(data.dailyBudgetCents !== undefined ? { dailyBudgetCents: data.dailyBudgetCents } : {}),
      ...(data.winnerMetric !== undefined ? { winnerMetric: data.winnerMetric } : {}),
    },
  });
}
