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
  chain_id?: number;
  period: BudgetPeriod;
  used_amount: string;
  remaining_amount: string;
  period_start: Date;
  period_end?: Date;
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
  return {
    ...budget,
    used_amount: '0',
    remaining_amount: budget.amount,
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
    const budgetData = {
      agent_id: input.agent_id,
      owner_address: input.owner_address.toLowerCase(),
      amount: input.amount,
      token: input.token.toUpperCase(),
      chain_id: input.chain_id,
      period: input.period,
      used_amount: '0',
      remaining_amount: input.amount,
      period_start: now.toISOString(),
      period_end: calculatePeriodEnd(input.period, now)?.toISOString(),
    };

    if (useDatabaseStorage) {
      try {
        const data = await prisma.agentBudget.create({
          data: budgetData
        });

        return {
          ...data,
          period: data.period as BudgetPeriod,
          period_start: data.period_start,
          period_end: data.period_end ? data.period_end : undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
      } catch (error) {
        console.error('[Budget Service] Failed to create budget:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const budget: AgentBudget = {
        id: randomUUID(),
        ...budgetData,
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
          let budget: AgentBudget = {
            ...b,
            period: b.period as BudgetPeriod,
            period_start: b.period_start,
            period_end: b.period_end ? b.period_end : undefined,
            created_at: b.created_at,
            updated_at: b.updated_at,
          };

          // Check if period needs reset
          if (isPeriodExpired(budget)) {
            const resetBudget = resetBudgetPeriod(budget);

            // Update in database
            await prisma.agentBudget.update({
              where: { id: budget.id },
              data: {
                used_amount: resetBudget.used_amount,
                remaining_amount: resetBudget.remaining_amount,
                period_start: resetBudget.period_start,
                period_end: resetBudget.period_end,
                updated_at: resetBudget.updated_at,
              }
            });

            budgets.push(resetBudget);
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

        let budget: AgentBudget = {
          ...data,
          period: data.period as BudgetPeriod,
          period_start: data.period_start,
          period_end: data.period_end ? data.period_end : undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        // Check if period needs reset
        if (isPeriodExpired(budget)) {
          const resetBudget = resetBudgetPeriod(budget);

          // Update in database
          await prisma.agentBudget.update({
            where: { id: budgetId },
            data: {
              used_amount: resetBudget.used_amount,
              remaining_amount: resetBudget.remaining_amount,
              period_start: resetBudget.period_start,
              period_end: resetBudget.period_end,
              updated_at: resetBudget.updated_at,
            }
          });

          return resetBudget;
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

          // Recalculate remaining amount
          const newAmount = BigInt(Math.floor(parseFloat(input.amount) * 1e18));
          const usedAmount = BigInt(Math.floor(parseFloat(currentBudget.used_amount) * 1e18));
          const remaining = newAmount - usedAmount;
          updates.remaining_amount = (Number(remaining) / 1e18).toString();
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

        return {
          ...data,
          period: data.period as BudgetPeriod,
          period_start: data.period_start,
          period_end: data.period_end ? data.period_end : undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
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
        const newAmount = BigInt(Math.floor(parseFloat(input.amount) * 1e18));
        const usedAmount = BigInt(Math.floor(parseFloat(budget.used_amount) * 1e18));
        const remaining = newAmount - usedAmount;
        updatedBudget.remaining_amount = (Number(remaining) / 1e18).toString();
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
    
    // Find matching budget
    const matchingBudget = budgets.find(b => {
      const tokenMatch = b.token.toUpperCase() === token.toUpperCase();
      const chainMatch = chainId === undefined || b.chain_id === undefined || b.chain_id === chainId;
      return tokenMatch && chainMatch;
    });

    if (!matchingBudget) {
      return {
        available: false,
        reason: `No budget found for token ${token}`,
      };
    }

    const requestedAmount = parseFloat(amount);
    const remainingAmount = parseFloat(matchingBudget.remaining_amount);

    if (requestedAmount > remainingAmount) {
      return {
        available: false,
        budget: matchingBudget,
        reason: `Insufficient budget. Requested: ${amount}, Remaining: ${matchingBudget.remaining_amount}`,
      };
    }

    return {
      available: true,
      budget: matchingBudget,
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

    if (useDatabaseStorage) {
      try {
        // Get current budget
        const budget = await prisma.agentBudget.findUnique({
          where: { id: budgetId }
        });

        if (!budget) {
          throw new Error('Budget not found');
        }

        const currentUsed = parseFloat(budget.used_amount);
        const currentRemaining = parseFloat(budget.remaining_amount);

        if (deductAmount > currentRemaining) {
          throw new Error('Insufficient budget');
        }

        const newUsed = currentUsed + deductAmount;
        const newRemaining = currentRemaining - deductAmount;

        // Update budget
        const data = await prisma.agentBudget.update({
          where: { id: budgetId },
          data: {
            used_amount: newUsed.toString(),
            remaining_amount: newRemaining.toString(),
            updated_at: new Date(),
          }
        });

        return {
          ...data,
          period: data.period as BudgetPeriod,
          period_start: data.period_start,
          period_end: data.period_end ? data.period_end : undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
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

      const currentUsed = parseFloat(budget.used_amount);
      const currentRemaining = parseFloat(budget.remaining_amount);

      if (deductAmount > currentRemaining) {
        throw new Error('Insufficient budget');
      }

      const newUsed = currentUsed + deductAmount;
      const newRemaining = currentRemaining - deductAmount;

      const updatedBudget: AgentBudget = {
        ...budget,
        used_amount: newUsed.toString(),
        remaining_amount: newRemaining.toString(),
        updated_at: new Date(),
      };

      budgetStore.set(budgetId, updatedBudget);
      return updatedBudget;
    }
  }

  /**
   * Reset all expired periodic budgets
   * Returns count of reset budgets
   */
  async resetPeriodBudgets(): Promise<number> {
    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        // Get all budgets with period_end in the past
        const { data: expiredBudgets, error } = await supabase
          .from('agent_budgets')
          .select('*')
          .not('period_end', 'is', null)
          .lt('period_end', new Date().toISOString());

        if (error) {
          console.error('[Budget Service] Reset period budgets error:', error);
          throw new Error(`Failed to reset period budgets: ${error.message}`);
        }

        let resetCount = 0;

        for (const b of expiredBudgets || []) {
          const budget: AgentBudget = {
            ...b,
            period_start: new Date(b.period_start),
            period_end: b.period_end ? new Date(b.period_end) : undefined,
            created_at: new Date(b.created_at),
            updated_at: new Date(b.updated_at),
          };

          const resetBudget = resetBudgetPeriod(budget);

          // Update in database
          await supabase
            .from('agent_budgets')
            .update({
              used_amount: resetBudget.used_amount,
              remaining_amount: resetBudget.remaining_amount,
              period_start: resetBudget.period_start.toISOString(),
              period_end: resetBudget.period_end?.toISOString(),
              updated_at: resetBudget.updated_at.toISOString(),
            })
            .eq('id', budget.id);

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
