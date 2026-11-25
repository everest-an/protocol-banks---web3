/**
 * Budget Service
 *
 * Manages budget allocation and tracking for AI agents.
 * Supports daily, weekly, monthly, and total budget periods.
 *
 * @module lib/services/budget-service
 */

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

// ============================================
// Types
// ============================================

export type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'total';

export interface AgentBudget {
  id: string;
  agent_id: string;
  owner_address: string;
  amount: string;
  token: string;
  chain_id?: number | null;
  period: BudgetPeriod;
  used_amount: string;
  remaining_amount: string;
  amount_units?: string;
  used_units?: string;
  balance_units?: string;
  period_start: Date;
  period_end?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBudgetInput {
  agent_id: string;
  owner_address: string;
  amount: string;
  token: string;
  chain_id?: number;
  period: BudgetPeriod;
}

export interface UpdateBudgetInput {
  amount?: string;
  token?: string;
  chain_id?: number;
  period?: BudgetPeriod;
}

export interface BudgetUtilization {
  total_allocated: string;
  total_used: string;
  utilization_percent: number;
  budgets: AgentBudget[];
}

export interface BudgetAvailability {
  available: boolean;
  budget?: AgentBudget;
  reason?: string;
}

// ============================================
// Integer units
// ============================================

const UNIT_SCALE = 1_000_000n;

/** Convert a human decimal string (e.g. "12.34") to 6-decimal minor units. */
function toUnits(amount: string): bigint {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('amount must be a non-negative number');
  }
  return BigInt(Math.round(n * 1_000_000));
}

/** Convert 6-decimal minor units back to a display string without floats. */
function fromUnits(units: bigint): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / UNIT_SCALE;
  const fraction = (abs % UNIT_SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

function unitString(value: unknown): string {
  if (typeof value === 'bigint') return value.toString();
  if (value === null || value === undefined) return '0';
  return String(value);
}

/** Normalize Prisma BigInt columns to strings so API JSON stays serializable. */
function normalizeBudget(row: any): AgentBudget {
  return {
    ...row,
    amount_units: unitString(row.amount_units),
    used_units: unitString(row.used_units),
    balance_units: unitString(row.balance_units),
  } as AgentBudget;
}

function usedUnitsOf(row: { used_units?: unknown; used_amount?: string }): bigint {
  const raw = unitString(row.used_units);
  if (raw !== '0') return BigInt(raw);
  return toUnits(row.used_amount || '0');
}

function balanceUnitsOf(row: { balance_units?: unknown; remaining_amount?: string }): bigint {
  const raw = unitString(row.balance_units);
  if (raw !== '0') return BigInt(raw);
  return toUnits(row.remaining_amount || '0');
}

// ============================================
// In-Memory Store (for testing/development)
// ============================================

const budgetStore = new Map<string, AgentBudget>();

// Flag to enable/disable database (for testing)
let useDatabaseStorage = true;

export function setUseDatabaseStorage(enabled: boolean) {
  useDatabaseStorage = enabled;
}

// ============================================
// Helper Functions
// ============================================

function calculatePeriodEnd(period: BudgetPeriod, periodStart: Date): Date | undefined {
  if (period === 'total') {
    return undefined;
  }

  const end = new Date(periodStart);
  
  switch (period) {
    case 'daily':
      end.setDate(end.getDate() + 1);
      break;
    case 'weekly':
      end.setDate(end.getDate() + 7);
      break;
    case 'monthly':
      end.setMonth(end.getMonth() + 1);
      break;
  }

  return end;
}

function isPeriodExpired(budget: AgentBudget): boolean {
  if (!budget.period_end) {
    return false;
  }
  return new Date() >= budget.period_end;
}

function resetBudgetPeriod(budget: AgentBudget): AgentBudget {
  const now = new Date();
  const amountUnits =
    budget.amount_units && budget.amount_units !== '0'
      ? BigInt(budget.amount_units)
      : toUnits(budget.amount);
  return {
    ...budget,
    used_amount: '0',
    remaining_amount: budget.amount,
    used_units: '0',
    balance_units: amountUnits.toString(),
    period_start: now,
    period_end: calculatePeriodEnd(budget.period, now),
    updated_at: now,
  };
}

// ============================================
// Budget Service
// ============================================

export class BudgetService {
  /**
   * Create a new budget for an agent
   */
  async create(input: CreateBudgetInput): Promise<AgentBudget> {
    // Validate required fields
    if (!input.agent_id) {
      throw new Error('agent_id is required');
    }
    if (!input.owner_address) {
      throw new Error('owner_address is required');
    }
    if (!input.amount) {
      throw new Error('amount is required');
    }
    if (!input.token) {
      throw new Error('token is required');
    }
    if (!input.period) {
      throw new Error('period is required');
    }

    // Validate amount is a valid number
    const amountNum = parseFloat(input.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('amount must be a positive number');
    }

    // Validate period
    const validPeriods: BudgetPeriod[] = ['daily', 'weekly', 'monthly', 'total'];
    if (!validPeriods.includes(input.period)) {
      throw new Error(`period must be one of: ${validPeriods.join(', ')}`);
    }

    const now = new Date();
    const amountUnits = toUnits(input.amount);
    const budgetData = {
      agent_id: input.agent_id,
      owner_address: input.owner_address.toLowerCase(),
      amount: input.amount,
      token: input.token.toUpperCase(),
      chain_id: input.chain_id,
      period: input.period,
      used_amount: '0',
      remaining_amount: input.amount,
      period_start: now,
      period_end: calculatePeriodEnd(input.period, now),
    };

    if (useDatabaseStorage) {
      try {
        const data = await prisma.$transaction(async (tx) => {
          const budget = await tx.agentBudget.create({
            data: {
              ...budgetData,
              amount_units: amountUnits,
              used_units: 0n,
              balance_units: amountUnits,
            },
          });
          await tx.agentBudgetLedger.create({
            data: {
              budget_id: budget.id,
              type: 'genesis',
              amount_units: amountUnits,
              balance_after_units: amountUnits,
              reference: 'create',
            },
          });
          return budget;
        });

        return normalizeBudget({
          ...data,
          period: data.period as BudgetPeriod,
          period_start: data.period_start,
          period_end: data.period_end ? data.period_end : undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
      } catch (error) {
        console.error('[Budget Service] Failed to create budget:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const budget: AgentBudget = {
        id: randomUUID(),
        ...budgetData,
        amount_units: amountUnits.toString(),
        used_units: '0',
        balance_units: amountUnits.toString(),
        period_start: now,
        period_end: calculatePeriodEnd(input.period, now),
        created_at: now,
        updated_at: now,
      };

      budgetStore.set(budget.id, budget);
      return budget;
    }
  }

  /**
   * List all budgets for an agent
   */
  async list(agentId: string): Promise<AgentBudget[]> {
    if (useDatabaseStorage) {
      try {
        const data = await prisma.agentBudget.findMany({
          where: { agent_id: agentId },
          orderBy: { created_at: 'desc' }
        });

        // Convert dates and check for expired periods
        const budgets: AgentBudget[] = [];
        for (const b of data || []) {
          const budget: AgentBudget = normalizeBudget({
            ...b,
            period: b.period as BudgetPeriod,
            period_start: b.period_start,
            period_end: b.period_end ? b.period_end : undefined,
            created_at: b.created_at,
            updated_at: b.updated_at,
          });

          // Check if period needs reset
          if (isPeriodExpired(budget)) {
            const resetBudget = resetBudgetPeriod(budget);

            // Update in database
            await prisma.agentBudget.update({
              where: { id: budget.id },
              data: {
                used_amount: resetBudget.used_amount,
                remaining_amount: resetBudget.remaining_amount,
                used_units: BigInt(resetBudget.used_units || '0'),
                balance_units: BigInt(resetBudget.balance_units || '0'),
                period_start: resetBudget.period_start,
                period_end: resetBudget.period_end,
                updated_at: resetBudget.updated_at,
              }
            });

            budgets.push(normalizeBudget(resetBudget));
          } else {
            budgets.push(budget);
          }
        }

        return budgets;
      } catch (error) {
        console.error('[Budget Service] Failed to list budgets:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const budgets: AgentBudget[] = [];

      for (const budget of budgetStore.values()) {
        if (budget.agent_id === agentId) {
          // Check if period needs reset
          if (isPeriodExpired(budget)) {
            const resetBudget = resetBudgetPeriod(budget);
            budgetStore.set(budget.id, resetBudget);
            budgets.push(resetBudget);
          } else {
            budgets.push(budget);
          }
        }
      }

      return budgets.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
  }

  /**
   * Get a budget by ID
   */
  async get(budgetId: string): Promise<AgentBudget | null> {
    if (useDatabaseStorage) {
      try {
        const data = await prisma.agentBudget.findUnique({
          where: { id: budgetId }
        });

        if (!data) return null;

        const budget: AgentBudget = normalizeBudget({
          ...data,
          period: data.period as BudgetPeriod,
          period_start: data.period_start,
          period_end: data.period_end ? data.period_end : undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
        });

        // Check if period needs reset
        if (isPeriodExpired(budget)) {
          const resetBudget = resetBudgetPeriod(budget);

          // Update in database
          await prisma.agentBudget.update({
            where: { id: budgetId },
            data: {
              used_amount: resetBudget.used_amount,
              remaining_amount: resetBudget.remaining_amount,
              used_units: BigInt(resetBudget.used_units || '0'),
              balance_units: BigInt(resetBudget.balance_units || '0'),
              period_start: resetBudget.period_start,
              period_end: resetBudget.period_end,
              updated_at: resetBudget.updated_at,
            }
          });

          return normalizeBudget(resetBudget);
        }

        return budget;
      } catch (error) {
        console.error('[Budget Service] Failed to get budget:', error);
        return null;
      }
    } else {
      // Fallback to in-memory storage
      const budget = budgetStore.get(budgetId);
      if (!budget) {
        return null;
      }

      // Check if period needs reset
      if (isPeriodExpired(budget)) {
        const resetBudget = resetBudgetPeriod(budget);
        budgetStore.set(budget.id, resetBudget);
        return resetBudget;
      }

      return budget;
    }
  }

  /**
   * Update a budget
   */
  async update(budgetId: string, input: UpdateBudgetInput): Promise<AgentBudget> {
    // Validate amount if provided
    if (input.amount !== undefined) {
      const amountNum = parseFloat(input.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('amount must be a positive number');
      }
    }

    // Validate period if provided
    if (input.period !== undefined) {
      const validPeriods: BudgetPeriod[] = ['daily', 'weekly', 'monthly', 'total'];
      if (!validPeriods.includes(input.period)) {
        throw new Error(`period must be one of: ${validPeriods.join(', ')}`);
      }
    }

    if (useDatabaseStorage) {
      try {
        // Get current budget
        const currentBudget = await prisma.agentBudget.findUnique({
          where: { id: budgetId }
        });

        if (!currentBudget) {
          throw new Error('Budget not found');
        }

        const now = new Date();
        const updates: any = {
          updated_at: now,
        };

        if (input.amount !== undefined) {
          updates.amount = input.amount;

          // Recalculate the integer balance from units; the string columns are
          // display caches. Refuse to shrink below what has already been used.
          const newAmountUnits = toUnits(input.amount);
          const usedUnits = usedUnitsOf(currentBudget);
          if (newAmountUnits < usedUnits) {
            throw new Error('amount cannot be less than the used amount');
          }
          updates.amount_units = newAmountUnits;
          updates.balance_units = newAmountUnits - usedUnits;
          updates.remaining_amount = fromUnits(newAmountUnits - usedUnits);
        }

        if (input.token !== undefined) updates.token = input.token.toUpperCase();
        if (input.chain_id !== undefined) updates.chain_id = input.chain_id;

        if (input.period !== undefined && input.period !== currentBudget.period) {
          updates.period = input.period;
          updates.period_end = calculatePeriodEnd(input.period, currentBudget.period_start);
        }

        const data = await prisma.agentBudget.update({
          where: { id: budgetId },
          data: updates
        });

        return normalizeBudget({
          ...data,
          period: data.period as BudgetPeriod,
          period_start: data.period_start,
          period_end: data.period_end ? data.period_end : undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
      } catch (error) {
        console.error('[Budget Service] Failed to update budget:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const budget = budgetStore.get(budgetId);
      if (!budget) {
        throw new Error('Budget not found');
      }

      const now = new Date();
      const updatedBudget: AgentBudget = {
        ...budget,
        amount: input.amount ?? budget.amount,
        token: input.token?.toUpperCase() ?? budget.token,
        chain_id: input.chain_id ?? budget.chain_id,
        period: input.period ?? budget.period,
        updated_at: now,
      };

      // Recalculate remaining amount if amount changed
      if (input.amount !== undefined) {
        const newAmountUnits = toUnits(input.amount);
        const usedUnits = usedUnitsOf(budget);
        if (newAmountUnits < usedUnits) {
          throw new Error('amount cannot be less than the used amount');
        }
        updatedBudget.amount_units = newAmountUnits.toString();
        updatedBudget.balance_units = (newAmountUnits - usedUnits).toString();
        updatedBudget.remaining_amount = fromUnits(newAmountUnits - usedUnits);
      }

      // Recalculate period_end if period changed
      if (input.period !== undefined && input.period !== budget.period) {
        updatedBudget.period_end = calculatePeriodEnd(input.period, budget.period_start);
      }

      budgetStore.set(budgetId, updatedBudget);
      return updatedBudget;
    }
  }

  /**
   * Delete a budget
   */
  async delete(budgetId: string): Promise<void> {
    if (useDatabaseStorage) {
      try {
        await prisma.agentBudget.delete({
          where: { id: budgetId }
        });
      } catch (error) {
        console.error('[Budget Service] Failed to delete budget:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      if (!budgetStore.has(budgetId)) {
        throw new Error('Budget not found');
      }
      budgetStore.delete(budgetId);
    }
  }

  /**
   * Check if agent has sufficient budget for a payment
   */
  async checkAvailability(
    agentId: string,
    amount: string,
    token: string,
    chainId?: number
  ): Promise<BudgetAvailability> {
    const budgets = await this.list(agentId);
    const requestedAmount = parseFloat(amount);
    const requestedUnits = toUnits(amount);

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return {
        available: false,
        reason: 'amount must be a positive number',
      };
    }

    const matching = budgets.filter(b => {
      const tokenMatch = b.token.toUpperCase() === token.toUpperCase();
      const chainMatch = chainId === undefined || b.chain_id === undefined || b.chain_id === chainId;
      return tokenMatch && chainMatch;
    });

    if (!matching.length) {
      return {
        available: false,
        reason: `No budget found for token ${token}`,
      };
    }

    const withRemaining = matching.map(b => ({
      budget: b,
      remainingUnits: balanceUnitsOf(b),
    }));

    const covering = withRemaining.filter(x => x.remainingUnits >= requestedUnits);
    if (!covering.length) {
      const best = withRemaining.sort((a, b) => (a.remainingUnits < b.remainingUnits ? 1 : -1))[0];
      return {
        available: false,
        budget: best?.budget,
        reason: `Insufficient budget. Requested: ${amount}, Remaining: ${best ? fromUnits(best.remainingUnits) : '0'}`,
      };
    }

    // Deterministic, conservative selection: consume the budget that expires
    // soonest first; among equal expiry, consume the lowest remaining balance
    // that still covers the request. Total budgets (no period_end) go last.
    covering.sort((a, b) => {
      const aEnd = a.budget.period_end ? new Date(a.budget.period_end).getTime() : Number.POSITIVE_INFINITY;
      const bEnd = b.budget.period_end ? new Date(b.budget.period_end).getTime() : Number.POSITIVE_INFINITY;
      if (aEnd !== bEnd) return aEnd - bEnd;
      return a.remainingUnits < b.remainingUnits ? -1 : a.remainingUnits > b.remainingUnits ? 1 : 0;
    });

    return {
      available: true,
      budget: covering[0].budget,
    };
  }

  /**
   * Deduct amount from budget after payment
   */
  async deductBudget(budgetId: string, amount: string): Promise<AgentBudget> {
    const deductAmount = parseFloat(amount);
    if (isNaN(deductAmount) || deductAmount <= 0) {
      throw new Error('amount must be a positive number');
    }
    const deductUnits = toUnits(amount);

    if (useDatabaseStorage) {
      try {
        // Atomic conditional debit on integer units, plus a ledger entry in the
        // same transaction. Two concurrent payments cannot both pass the
        // balance check; the string columns are display caches.
        const data = await prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw`
            UPDATE "agent_budgets"
            SET "balance_units" = "balance_units" - ${deductUnits.toString()}::bigint,
                "used_units" = "used_units" + ${deductUnits.toString()}::bigint,
                "remaining_amount" = ROUND(("balance_units" - ${deductUnits.toString()}::bigint)::numeric / 1000000, 6)::text,
                "used_amount" = ROUND(("used_units" + ${deductUnits.toString()}::bigint)::numeric / 1000000, 6)::text,
                "updated_at" = NOW()
            WHERE "id" = ${budgetId}
              AND "balance_units" >= ${deductUnits.toString()}::bigint
            RETURNING "id", "amount_units", "used_units", "balance_units", "amount",
                      "used_amount", "remaining_amount", "period", "period_start",
                      "period_end", "created_at", "updated_at", "agent_id",
                      "owner_address", "token", "chain_id"
          ` as any[];

          if (!rows.length) {
            const exists = await tx.agentBudget.findUnique({
              where: { id: budgetId },
              select: { id: true },
            });
            throw new Error(exists ? 'Insufficient budget' : 'Budget not found');
          }

          const row = rows[0];
          const balanceAfter = typeof row.balance_units === 'bigint'
            ? row.balance_units
            : BigInt(row.balance_units ?? 0);
          await tx.agentBudgetLedger.create({
            data: {
              budget_id: budgetId,
              type: 'debit',
              amount_units: deductUnits,
              balance_after_units: balanceAfter,
              reference: 'deduct',
            },
          });
          return row;
        });

        return normalizeBudget({
          ...data,
          period: data.period as BudgetPeriod,
          period_start: data.period_start,
          period_end: data.period_end ? data.period_end : undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
      } catch (error) {
        console.error('[Budget Service] Failed to deduct from budget:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const budget = budgetStore.get(budgetId);
      if (!budget) {
        throw new Error('Budget not found');
      }

      const currentBalance = balanceUnitsOf(budget);
      if (deductUnits > currentBalance) {
        throw new Error('Insufficient budget');
      }

      const newUsed = usedUnitsOf(budget) + deductUnits;
      const newBalance = currentBalance - deductUnits;

      const updatedBudget: AgentBudget = {
        ...budget,
        used_amount: fromUnits(newUsed),
        remaining_amount: fromUnits(newBalance),
        used_units: newUsed.toString(),
        balance_units: newBalance.toString(),
        updated_at: new Date(),
      };

      budgetStore.set(budgetId, updatedBudget);
      return updatedBudget;
    }
  }

  /**
   * Return a previously deducted amount (for example when a provider rejects
   * a paid call before the user receives the result).
   */
  async refundBudget(budgetId: string, amount: string): Promise<AgentBudget> {
    const refundAmount = parseFloat(amount)
    if (isNaN(refundAmount) || refundAmount <= 0) {
      throw new Error('amount must be a positive number')
    }
    const refundUnits = toUnits(amount)

    if (useDatabaseStorage) {
      const data = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw`
          UPDATE "agent_budgets"
          SET "balance_units" = "balance_units" + ${refundUnits.toString()}::bigint,
              "used_units" = GREATEST(0, "used_units" - ${refundUnits.toString()}::bigint),
              "remaining_amount" = ROUND(("balance_units" + ${refundUnits.toString()}::bigint)::numeric / 1000000, 6)::text,
              "used_amount" = ROUND(GREATEST(0, "used_units" - ${refundUnits.toString()}::bigint)::numeric / 1000000, 6)::text,
              "updated_at" = NOW()
          WHERE "id" = ${budgetId}
          RETURNING "id", "amount_units", "used_units", "balance_units", "amount",
                    "used_amount", "remaining_amount", "period", "period_start",
                    "period_end", "created_at", "updated_at", "agent_id",
                    "owner_address", "token", "chain_id"
        ` as any[]
        if (!rows.length) throw new Error('Budget not found')

        const row = rows[0]
        const balanceAfter = typeof row.balance_units === 'bigint'
          ? row.balance_units
          : BigInt(row.balance_units ?? 0)
        await tx.agentBudgetLedger.create({
          data: {
            budget_id: budgetId,
            type: 'refund',
            amount_units: refundUnits,
            balance_after_units: balanceAfter,
            reference: 'refund',
          },
        })
        return row
      })

      return normalizeBudget({
        ...data,
        period: data.period as BudgetPeriod,
        period_start: data.period_start,
        period_end: data.period_end ? data.period_end : undefined,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
    }

    const budget = budgetStore.get(budgetId)
    if (!budget) throw new Error('Budget not found')
    const currentBalance = balanceUnitsOf(budget)
    const currentUsed = usedUnitsOf(budget)
    const newUsed = currentUsed > refundUnits ? currentUsed - refundUnits : 0n
    const newBalance = currentBalance + refundUnits
    const updatedBudget: AgentBudget = {
      ...budget,
      used_amount: fromUnits(newUsed),
      remaining_amount: fromUnits(newBalance),
      used_units: newUsed.toString(),
      balance_units: newBalance.toString(),
      updated_at: new Date(),
    }
    budgetStore.set(budgetId, updatedBudget)
    return updatedBudget
  }

  /**
   * Reset all expired periodic budgets
   * Returns count of reset budgets
   */
  async resetPeriodBudgets(): Promise<number> {
    if (useDatabaseStorage) {
      try {
        // Get all budgets with period_end in the past
        const expiredBudgets = await prisma.agentBudget.findMany({
          where: {
            period_end: {
              not: null,
              lt: new Date()
            }
          }
        });

        let resetCount = 0;

        for (const b of expiredBudgets) {
          const budget: AgentBudget = normalizeBudget({
            ...b,
            amount: b.amount,
            period: b.period as BudgetPeriod,
            period_start: b.period_start,
            period_end: b.period_end || undefined,
            created_at: b.created_at,
            updated_at: b.updated_at,
          });

          const resetBudget = resetBudgetPeriod(budget);

          // Update in database
          await prisma.agentBudget.update({
            where: { id: budget.id },
            data: {
              used_amount: resetBudget.used_amount,
              remaining_amount: resetBudget.remaining_amount,
              used_units: BigInt(resetBudget.used_units || '0'),
              balance_units: BigInt(resetBudget.balance_units || '0'),
              period_start: resetBudget.period_start,
              period_end: resetBudget.period_end,
              updated_at: resetBudget.updated_at,
            }
          });

          resetCount++;
        }

        return resetCount;
      } catch (error) {
        console.error('[Budget Service] Failed to reset period budgets:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      let resetCount = 0;

      for (const [id, budget] of budgetStore.entries()) {
        if (isPeriodExpired(budget)) {
          const resetBudget = resetBudgetPeriod(budget);
          budgetStore.set(id, resetBudget);
          resetCount++;
        }
      }

      return resetCount;
    }
  }

  /**
   * Get budget utilization for an agent
   */
  async getUtilization(agentId: string): Promise<BudgetUtilization> {
    const budgets = await this.list(agentId);

    let totalAllocated = 0;
    let totalUsed = 0;

    for (const budget of budgets) {
      totalAllocated += parseFloat(budget.amount);
      totalUsed += parseFloat(budget.used_amount);
    }

    const utilizationPercent = totalAllocated > 0 
      ? (totalUsed / totalAllocated) * 100 
      : 0;

    return {
      total_allocated: totalAllocated.toString(),
      total_used: totalUsed.toString(),
      utilization_percent: Math.round(utilizationPercent * 100) / 100,
      budgets,
    };
  }

  /**
   * Clear all budgets (for testing)
   */
  _clearAll(): void {
    budgetStore.clear();
  }

  /**
   * Get budget count (for testing)
   */
  _getCount(): number {
    return budgetStore.size;
  }
}

// Export singleton instance
export const budgetService = new BudgetService();
