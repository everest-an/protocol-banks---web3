/**
 * Budget Service
 * 
 * Manages budget allocation and tracking for AI agents.
 * Supports daily, weekly, monthly, and total budget periods.
 * 
 * @module lib/services/budget-service
 */

import { randomUUID } from 'crypto';

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
    const budget: AgentBudget = {
      id: randomUUID(),
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
      created_at: now,
      updated_at: now,
    };

    budgetStore.set(budget.id, budget);
    return budget;
  }

  /**
   * List all budgets for an agent
   */
  async list(agentId: string): Promise<AgentBudget[]> {
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

  /**
   * Get a budget by ID
   */
  async get(budgetId: string): Promise<AgentBudget | null> {
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

  /**
   * Update a budget
   */
  async update(budgetId: string, input: UpdateBudgetInput): Promise<AgentBudget> {
    const budget = budgetStore.get(budgetId);
    if (!budget) {
      throw new Error('Budget not found');
    }

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

  /**
   * Delete a budget
   */
  async delete(budgetId: string): Promise<void> {
    if (!budgetStore.has(budgetId)) {
      throw new Error('Budget not found');
    }
    budgetStore.delete(budgetId);
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
    const budget = budgetStore.get(budgetId);
    if (!budget) {
      throw new Error('Budget not found');
    }

    const deductAmount = parseFloat(amount);
    if (isNaN(deductAmount) || deductAmount <= 0) {
      throw new Error('amount must be a positive number');
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

  /**
   * Reset all expired periodic budgets
   * Returns count of reset budgets
   */
  async resetPeriodBudgets(): Promise<number> {
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
