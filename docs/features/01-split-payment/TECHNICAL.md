# 百分比分账功能 - 技术设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 功能名称 | 百分比分账 (Split Payment) |
| 版本 | v1.0 |
| 创建日期 | 2025-01-30 |
| 技术负责人 | _待定_ |

---

## 1. 系统架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ SplitPayment │  │ SplitRule    │  │ Template     │          │
│  │ Page         │  │ Editor       │  │ Manager      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
│                  ┌──────────────────┐                           │
│                  │ useSplitPayment  │  (React Hook)             │
│                  │ Hook             │                           │
│                  └────────┬─────────┘                           │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│                         API Layer (Next.js API Routes)            │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  /api/split-payment/*                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ calculate   │  │ execute     │  │ templates   │              │
│  │ route.ts    │  │ route.ts    │  │ route.ts    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│                 ┌──────────────────┐                             │
│                 │ SplitPayment     │                             │
│                 │ Service          │                             │
│                 └────────┬─────────┘                             │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ Supabase   │  │ Payment    │  │ Blockchain │
    │ Database   │  │ Service    │  │ (EVM)      │
    └────────────┘  └────────────┘  └────────────┘
```

### 1.2 模块依赖

```
split-payment-service
    ├── payment-service (现有)
    ├── supabase-client (现有)
    ├── web3 (现有)
    └── big.js (新增 - 精度计算)
```

---

## 2. 核心数据结构

### 2.1 TypeScript 类型定义

```typescript
// types/split-payment.ts

/**
 * 分账模式
 */
export type SplitMode = 'percentage' | 'fixed' | 'hybrid';

/**
 * 分账规则项
 */
export interface SplitRuleItem {
  id: string;                    // 唯一标识
  address: string;               // 收款地址
  name?: string;                 // 收款人名称（可选）
  percentage?: number;           // 百分比 (0-100)，百分比模式必填
  fixedAmount?: number;          // 固定金额，固定模式必填
  calculatedAmount?: number;     // 计算后的实际金额
}

/**
 * 分账规则
 */
export interface SplitRule {
  mode: SplitMode;
  totalAmount: number;           // 总金额（百分比模式必填）
  token: string;                 // 代币
  chainId: number;               // 链 ID
  items: SplitRuleItem[];
}

/**
 * 分账计算结果
 */
export interface SplitCalculation {
  success: boolean;
  items: Array<{
    address: string;
    name?: string;
    percentage?: number;
    amount: number;              // 精确计算后的金额
  }>;
  totalAmount: number;
  remainderAddress?: string;     // 接收余数的地址
  warnings?: string[];           // 警告信息
}

/**
 * 分账任务
 */
export interface SplitPayment {
  id: string;
  creatorAddress: string;
  rule: SplitRule;
  calculation: SplitCalculation;
  status: 'pending' | 'executing' | 'completed' | 'partial' | 'failed';
  results?: PaymentResult[];
  createdAt: string;
  executedAt?: string;
}

/**
 * 分账模板
 */
export interface SplitTemplate {
  id: string;
  ownerAddress: string;
  name: string;
  description?: string;
  rule: Omit<SplitRule, 'totalAmount'>;  // 模板不存总金额
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}
```

### 2.2 数据库 Schema

```sql
-- 分账记录表
CREATE TABLE split_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_address VARCHAR(42) NOT NULL,
  total_amount DECIMAL(36, 18) NOT NULL,
  token VARCHAR(20) NOT NULL DEFAULT 'USDC',
  chain_id INTEGER NOT NULL DEFAULT 8453,
  split_mode VARCHAR(20) NOT NULL DEFAULT 'percentage',
  rule JSONB NOT NULL,
  calculation JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  results JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE,

  -- 索引
  CONSTRAINT valid_status CHECK (status IN ('pending', 'executing', 'completed', 'partial', 'failed'))
);

CREATE INDEX idx_split_payments_creator ON split_payments(creator_address);
CREATE INDEX idx_split_payments_status ON split_payments(status);
CREATE INDEX idx_split_payments_created ON split_payments(created_at DESC);

-- 分账模板表
CREATE TABLE split_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address VARCHAR(42) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  rule JSONB NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 约束
  CONSTRAINT unique_template_name UNIQUE (owner_address, name)
);

CREATE INDEX idx_split_templates_owner ON split_templates(owner_address);

-- RLS 策略
ALTER TABLE split_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own split payments"
  ON split_payments FOR SELECT
  USING (creator_address = current_setting('app.user_address', true));

CREATE POLICY "Users can create split payments"
  ON split_payments FOR INSERT
  WITH CHECK (creator_address = current_setting('app.user_address', true));

CREATE POLICY "Users can view own templates"
  ON split_templates FOR ALL
  USING (owner_address = current_setting('app.user_address', true));
```

---

## 3. 核心服务实现

### 3.1 分账服务 (SplitPaymentService)

```typescript
// lib/services/split-payment-service.ts

import Big from 'big.js';
import { ethers } from 'ethers';
import type {
  SplitRule,
  SplitRuleItem,
  SplitCalculation,
  SplitPayment
} from '@/types/split-payment';

// 配置精度
Big.DP = 18;  // 小数位数
Big.RM = Big.roundDown;  // 向下取整

/**
 * 分账计算服务
 */
export class SplitPaymentService {

  /**
   * 验证分账规则
   */
  static validateRule(rule: SplitRule): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 基础验证
    if (!rule.items || rule.items.length === 0) {
      errors.push('至少需要一个收款人');
    }

    if (rule.items.length > 100) {
      errors.push('收款人数量不能超过 100');
    }

    // 地址验证
    for (const item of rule.items) {
      if (!ethers.isAddress(item.address)) {
        errors.push(`无效地址: ${item.address}`);
      }
    }

    // 模式特定验证
    if (rule.mode === 'percentage') {
      const totalPercentage = rule.items.reduce(
        (sum, item) => sum + (item.percentage || 0),
        0
      );

      if (Math.abs(totalPercentage - 100) > 0.01) {
        errors.push(`百分比总和必须为 100%，当前: ${totalPercentage}%`);
      }

      if (!rule.totalAmount || rule.totalAmount <= 0) {
        errors.push('百分比模式需要指定总金额');
      }
    }

    if (rule.mode === 'fixed') {
      const totalFixed = rule.items.reduce(
        (sum, item) => sum + (item.fixedAmount || 0),
        0
      );

      for (const item of rule.items) {
        if (!item.fixedAmount || item.fixedAmount <= 0) {
          errors.push(`收款人 ${item.address} 未指定金额`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 计算分账金额
   * 使用 Big.js 处理精度问题
   */
  static calculate(rule: SplitRule): SplitCalculation {
    const validation = this.validateRule(rule);
    if (!validation.valid) {
      return {
        success: false,
        items: [],
        totalAmount: 0,
        warnings: validation.errors
      };
    }

    const warnings: string[] = [];
    const totalAmount = new Big(rule.totalAmount);
    const items: SplitCalculation['items'] = [];

    if (rule.mode === 'percentage') {
      // 百分比模式计算
      let allocatedAmount = new Big(0);

      for (let i = 0; i < rule.items.length; i++) {
        const item = rule.items[i];
        const percentage = new Big(item.percentage || 0);

        let amount: Big;

        if (i === rule.items.length - 1) {
          // 最后一人获得剩余金额（处理四舍五入误差）
          amount = totalAmount.minus(allocatedAmount);
        } else {
          // 计算金额：总额 * 百分比 / 100
          amount = totalAmount.times(percentage).div(100);
          // 截断到 6 位小数（USDC 精度）
          amount = new Big(amount.toFixed(6));
        }

        allocatedAmount = allocatedAmount.plus(amount);

        items.push({
          address: item.address,
          name: item.name,
          percentage: item.percentage,
          amount: Number(amount.toFixed(6))
        });
      }

      // 验证分配完整性
      if (!allocatedAmount.eq(totalAmount)) {
        warnings.push(
          `精度调整: 最后一人获得 ${items[items.length - 1].amount}` +
          ` (原计算值有微小差异)`
        );
      }

    } else if (rule.mode === 'fixed') {
      // 固定金额模式
      for (const item of rule.items) {
        items.push({
          address: item.address,
          name: item.name,
          amount: item.fixedAmount || 0
        });
      }

    } else if (rule.mode === 'hybrid') {
      // 混合模式：先分配固定金额，剩余按百分比分配
      let remainingAmount = new Big(totalAmount);
      const percentageItems: SplitRuleItem[] = [];

      // 第一轮：分配固定金额
      for (const item of rule.items) {
        if (item.fixedAmount && item.fixedAmount > 0) {
          const amount = new Big(item.fixedAmount);
          remainingAmount = remainingAmount.minus(amount);
          items.push({
            address: item.address,
            name: item.name,
            amount: Number(amount.toFixed(6))
          });
        } else if (item.percentage && item.percentage > 0) {
          percentageItems.push(item);
        }
      }

      // 第二轮：剩余金额按百分比分配
      if (percentageItems.length > 0 && remainingAmount.gt(0)) {
        const totalPercentage = percentageItems.reduce(
          (sum, item) => sum + (item.percentage || 0),
          0
        );

        let allocatedFromRemaining = new Big(0);

        for (let i = 0; i < percentageItems.length; i++) {
          const item = percentageItems[i];
          let amount: Big;

          if (i === percentageItems.length - 1) {
            amount = remainingAmount.minus(allocatedFromRemaining);
          } else {
            amount = remainingAmount
              .times(item.percentage || 0)
              .div(totalPercentage);
            amount = new Big(amount.toFixed(6));
          }

          allocatedFromRemaining = allocatedFromRemaining.plus(amount);

          items.push({
            address: item.address,
            name: item.name,
            percentage: item.percentage,
            amount: Number(amount.toFixed(6))
          });
        }
      }
    }

    return {
      success: true,
      items,
      totalAmount: Number(totalAmount.toFixed(6)),
      remainderAddress: items[items.length - 1]?.address,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * 执行分账支付
   */
  static async execute(
    splitPayment: SplitPayment,
    wallet: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<SplitPayment> {
    const { processBatchPayments } = await import('./payment-service');

    // 转换为批量支付格式
    const recipients = splitPayment.calculation.items.map(item => ({
      address: item.address,
      amount: item.amount,
      token: splitPayment.rule.token
    }));

    // 调用现有批量支付服务
    const results = await processBatchPayments(
      recipients,
      wallet,
      'EVM',
      onProgress
    );

    // 更新状态
    const successCount = results.filter(r => r.success).length;
    let status: SplitPayment['status'];

    if (successCount === results.length) {
      status = 'completed';
    } else if (successCount > 0) {
      status = 'partial';
    } else {
      status = 'failed';
    }

    return {
      ...splitPayment,
      status,
      results,
      executedAt: new Date().toISOString()
    };
  }
}

// 导出便捷函数
export const validateSplitRule = SplitPaymentService.validateRule;
export const calculateSplit = SplitPaymentService.calculate;
export const executeSplitPayment = SplitPaymentService.execute;
```

### 3.2 CSV 解析扩展

```typescript
// lib/excel-parser.ts - 扩展部分

// 新增字段别名
const FIELD_ALIASES: Record<string, string[]> = {
  // ... 现有字段 ...

  // 新增分账相关字段
  percentage: [
    'percentage', 'percent', 'pct', 'ratio', 'share',
    '百分比', '比例', '占比'
  ],
  splitMode: [
    'splitmode', 'split_mode', 'mode', 'type',
    '分配模式', '模式'
  ],
};

// 新增解析结果类型
export interface ParsedSplitRecipient extends ParsedRecipient {
  percentage?: number;
  splitMode?: 'percentage' | 'fixed';
}

/**
 * 解析分账 CSV
 */
export async function parseSplitPaymentFile(file: File): Promise<{
  success: boolean;
  recipients: ParsedSplitRecipient[];
  errors: string[];
  warnings: string[];
  detectedMode: 'percentage' | 'fixed' | 'hybrid';
}> {
  const baseResult = await parsePaymentFile(file);

  if (!baseResult.success) {
    return {
      ...baseResult,
      recipients: [],
      detectedMode: 'fixed'
    };
  }

  // 检测模式
  const hasPercentage = baseResult.recipients.some(r =>
    (r as any).percentage !== undefined
  );
  const hasAmount = baseResult.recipients.some(r =>
    r.amount !== undefined && r.amount !== ''
  );

  let detectedMode: 'percentage' | 'fixed' | 'hybrid';
  if (hasPercentage && hasAmount) {
    detectedMode = 'hybrid';
  } else if (hasPercentage) {
    detectedMode = 'percentage';
  } else {
    detectedMode = 'fixed';
  }

  return {
    success: true,
    recipients: baseResult.recipients as ParsedSplitRecipient[],
    errors: baseResult.errors,
    warnings: baseResult.warnings,
    detectedMode
  };
}
```

---

## 4. API 设计

### 4.1 计算分账金额

```typescript
// app/api/split-payment/calculate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { calculateSplit, validateSplitRule } from '@/lib/services/split-payment-service';
import type { SplitRule } from '@/types/split-payment';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rule: SplitRule = body.rule;

    // 验证
    const validation = validateSplitRule(rule);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        errors: validation.errors
      }, { status: 400 });
    }

    // 计算
    const calculation = calculateSplit(rule);

    return NextResponse.json({
      success: true,
      calculation
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
```

### 4.2 创建分账任务

```typescript
// app/api/split-payment/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { calculateSplit, validateSplitRule } from '@/lib/services/split-payment-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rule, creatorAddress } = body;

    if (!creatorAddress) {
      return NextResponse.json({ error: 'creatorAddress required' }, { status: 400 });
    }

    // 验证并计算
    const validation = validateSplitRule(rule);
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Invalid rule',
        details: validation.errors
      }, { status: 400 });
    }

    const calculation = calculateSplit(rule);
    if (!calculation.success) {
      return NextResponse.json({
        error: 'Calculation failed',
        details: calculation.warnings
      }, { status: 400 });
    }

    // 保存到数据库
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('split_payments')
      .insert({
        creator_address: creatorAddress.toLowerCase(),
        total_amount: rule.totalAmount,
        token: rule.token,
        chain_id: rule.chainId,
        split_mode: rule.mode,
        rule: rule,
        calculation: calculation,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('[SplitPayment] DB error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      splitPayment: data
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorAddress = searchParams.get('creatorAddress');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!creatorAddress) {
      return NextResponse.json({ error: 'creatorAddress required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error, count } = await supabase
      .from('split_payments')
      .select('*', { count: 'exact' })
      .eq('creator_address', creatorAddress.toLowerCase())
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    return NextResponse.json({
      splitPayments: data || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 4.3 执行分账

```typescript
// app/api/split-payment/execute/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { executeSplitPayment } from '@/lib/services/split-payment-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { splitPaymentId, wallet } = body;

    if (!splitPaymentId || !wallet) {
      return NextResponse.json({
        error: 'splitPaymentId and wallet required'
      }, { status: 400 });
    }

    const supabase = getSupabase();

    // 获取分账任务
    const { data: splitPayment, error: fetchError } = await supabase
      .from('split_payments')
      .select('*')
      .eq('id', splitPaymentId)
      .single();

    if (fetchError || !splitPayment) {
      return NextResponse.json({ error: 'Split payment not found' }, { status: 404 });
    }

    if (splitPayment.status !== 'pending') {
      return NextResponse.json({
        error: `Cannot execute: status is ${splitPayment.status}`
      }, { status: 400 });
    }

    // 更新状态为执行中
    await supabase
      .from('split_payments')
      .update({ status: 'executing' })
      .eq('id', splitPaymentId);

    // 执行支付
    const result = await executeSplitPayment(splitPayment, wallet);

    // 更新结果
    await supabase
      .from('split_payments')
      .update({
        status: result.status,
        results: result.results,
        executed_at: result.executedAt
      })
      .eq('id', splitPaymentId);

    return NextResponse.json({
      success: result.status === 'completed',
      splitPayment: result
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 5. 前端组件设计

### 5.1 组件结构

```
components/
├── split-payment/
│   ├── SplitPaymentForm.tsx      # 主表单组件
│   ├── SplitRuleEditor.tsx       # 规则编辑器
│   ├── SplitRecipientList.tsx    # 收款人列表
│   ├── SplitCalculationPreview.tsx # 计算预览
│   ├── SplitTemplateSelector.tsx # 模板选择器
│   └── hooks/
│       └── useSplitPayment.ts    # 状态管理 Hook
```

### 5.2 主要 Hook

```typescript
// components/split-payment/hooks/useSplitPayment.ts

import { useState, useCallback, useMemo } from 'react';
import type { SplitRule, SplitRuleItem, SplitCalculation } from '@/types/split-payment';

export function useSplitPayment() {
  // 分账模式
  const [mode, setMode] = useState<SplitRule['mode']>('percentage');

  // 总金额
  const [totalAmount, setTotalAmount] = useState<number>(0);

  // 代币
  const [token, setToken] = useState<string>('USDC');

  // 收款人列表
  const [items, setItems] = useState<SplitRuleItem[]>([]);

  // 计算结果
  const [calculation, setCalculation] = useState<SplitCalculation | null>(null);

  // 加载状态
  const [calculating, setCalculating] = useState(false);
  const [executing, setExecuting] = useState(false);

  // 构建规则
  const rule = useMemo<SplitRule>(() => ({
    mode,
    totalAmount,
    token,
    chainId: 8453, // Base
    items
  }), [mode, totalAmount, token, items]);

  // 添加收款人
  const addItem = useCallback((item: Partial<SplitRuleItem>) => {
    setItems(prev => [...prev, {
      id: `item_${Date.now()}`,
      address: '',
      percentage: mode === 'percentage' ? 0 : undefined,
      fixedAmount: mode === 'fixed' ? 0 : undefined,
      ...item
    }]);
  }, [mode]);

  // 更新收款人
  const updateItem = useCallback((id: string, updates: Partial<SplitRuleItem>) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  // 删除收款人
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // 计算分账
  const calculate = useCallback(async () => {
    setCalculating(true);
    try {
      const response = await fetch('/api/split-payment/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule })
      });

      const data = await response.json();
      if (data.success) {
        setCalculation(data.calculation);
      } else {
        throw new Error(data.errors?.join(', ') || 'Calculation failed');
      }

      return data.calculation;
    } finally {
      setCalculating(false);
    }
  }, [rule]);

  // 验证状态
  const validation = useMemo(() => {
    const errors: string[] = [];

    if (items.length === 0) {
      errors.push('请添加至少一个收款人');
    }

    if (mode === 'percentage') {
      const total = items.reduce((sum, item) => sum + (item.percentage || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        errors.push(`百分比总和为 ${total}%，需要为 100%`);
      }
      if (!totalAmount || totalAmount <= 0) {
        errors.push('请输入总金额');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }, [items, mode, totalAmount]);

  return {
    // 状态
    mode,
    totalAmount,
    token,
    items,
    rule,
    calculation,
    validation,
    calculating,
    executing,

    // 操作
    setMode,
    setTotalAmount,
    setToken,
    addItem,
    updateItem,
    removeItem,
    calculate,
    setCalculation
  };
}
```

---

## 6. 测试计划

### 6.1 单元测试

```typescript
// __tests__/split-payment-service.test.ts

import { calculateSplit, validateSplitRule } from '@/lib/services/split-payment-service';

describe('SplitPaymentService', () => {
  describe('validateRule', () => {
    it('should fail when percentage sum is not 100', () => {
      const rule = {
        mode: 'percentage' as const,
        totalAmount: 1000,
        token: 'USDC',
        chainId: 8453,
        items: [
          { id: '1', address: '0x123...', percentage: 50 },
          { id: '2', address: '0x456...', percentage: 40 },
        ]
      };

      const result = validateSplitRule(rule);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringMatching(/百分比/));
    });
  });

  describe('calculate', () => {
    it('should calculate percentage split correctly', () => {
      const rule = {
        mode: 'percentage' as const,
        totalAmount: 10000,
        token: 'USDC',
        chainId: 8453,
        items: [
          { id: '1', address: '0x123...', percentage: 40 },
          { id: '2', address: '0x456...', percentage: 35 },
          { id: '3', address: '0x789...', percentage: 25 },
        ]
      };

      const result = calculateSplit(rule);

      expect(result.success).toBe(true);
      expect(result.items[0].amount).toBe(4000);
      expect(result.items[1].amount).toBe(3500);
      expect(result.items[2].amount).toBe(2500);
    });

    it('should handle precision correctly for 33.33% split', () => {
      const rule = {
        mode: 'percentage' as const,
        totalAmount: 10000,
        token: 'USDC',
        chainId: 8453,
        items: [
          { id: '1', address: '0x123...', percentage: 33.33 },
          { id: '2', address: '0x456...', percentage: 33.33 },
          { id: '3', address: '0x789...', percentage: 33.34 },
        ]
      };

      const result = calculateSplit(rule);

      expect(result.success).toBe(true);
      const total = result.items.reduce((sum, item) => sum + item.amount, 0);
      expect(total).toBe(10000);
    });
  });
});
```

### 6.2 集成测试

- 完整分账流程测试
- 大批量（100人）分账测试
- 并发分账测试
- 错误恢复测试

---

## 7. 性能考虑

### 7.1 前端性能

- 收款人列表虚拟化（超过 20 人时）
- 防抖计算（输入变化后 300ms 才触发）
- 分批渲染大批量结果

### 7.2 后端性能

- 分账计算在内存中完成（无 DB 操作）
- 批量支付使用现有并发控制
- 数据库查询使用索引

### 7.3 区块链性能

- 继承现有批量支付的优化
- 未来可升级为 Multicall 合约

---

## 8. 安全考虑

### 8.1 输入验证

- 地址格式验证
- 金额范围验证
- 百分比总和验证

### 8.2 权限控制

- 只能查看/执行自己创建的分账
- RLS 策略保护数据隔离

### 8.3 资金安全

- 不托管用户资金
- 执行前显示详细预览
- 支持取消待执行任务

---

## 9. 文件清单

### 9.1 新增文件

```
types/
└── split-payment.ts              # 类型定义

lib/services/
└── split-payment-service.ts      # 核心服务

app/api/split-payment/
├── route.ts                      # 创建/查询
├── calculate/route.ts            # 计算
├── execute/route.ts              # 执行
└── templates/route.ts            # 模板

components/split-payment/
├── SplitPaymentForm.tsx
├── SplitRuleEditor.tsx
├── SplitRecipientList.tsx
├── SplitCalculationPreview.tsx
└── hooks/useSplitPayment.ts
```

### 9.2 修改文件

```
lib/excel-parser.ts               # 扩展解析能力
app/batch-payment/page.tsx        # 添加分账 Tab
types/index.ts                    # 导出新类型
```

---

## 10. 依赖新增

```json
{
  "dependencies": {
    "big.js": "^6.2.1"
  },
  "devDependencies": {
    "@types/big.js": "^6.2.2"
  }
}
```

---

**审核人**: _待定_
**批准日期**: _待定_
