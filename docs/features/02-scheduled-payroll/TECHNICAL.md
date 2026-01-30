# 定时发薪功能 - 技术设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 功能名称 | 定时发薪 (Scheduled Payroll) |
| 版本 | v1.0 |
| 创建日期 | 2025-01-30 |
| 依赖 | 百分比分账功能 |

---

## 1. 系统架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      调度层 (Scheduler)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐                                           │
│  │ Vercel Cron      │ ─── 每小时触发 ───▶ /api/cron/payroll    │
│  │ (或 Upstash)     │                                           │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      应用层 (Application)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Payroll      │  │ Scheduler    │  │ Notification │          │
│  │ Service      │  │ Service      │  │ Service      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
│                  ┌──────────────────┐                           │
│                  │ Execution Engine │                           │
│                  │ (调用分账服务)    │                           │
│                  └────────┬─────────┘                           │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ Supabase   │  │ Split      │  │ Resend     │
    │ Database   │  │ Payment    │  │ (Email)    │
    └────────────┘  └────────────┘  └────────────┘
```

### 1.2 调度流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      Cron 任务执行流程                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Cron 触发 (每小时)                                          │
│     │                                                           │
│     ▼                                                           │
│  2. 查询到期计划                                                │
│     SELECT * FROM payroll_schedules                             │
│     WHERE status = 'active'                                     │
│       AND next_execution <= NOW()                               │
│       AND next_execution > NOW() - INTERVAL '1 hour'            │
│     │                                                           │
│     ▼                                                           │
│  3. 遍历执行                                                    │
│     FOR EACH schedule:                                          │
│       │                                                         │
│       ├─▶ 检查执行模式                                          │
│       │   ├─ auto: 直接执行                                     │
│       │   ├─ confirm: 创建待确认任务                            │
│       │   └─ approval: 创建待审批任务                           │
│       │                                                         │
│       ├─▶ 执行支付 (调用 SplitPaymentService)                   │
│       │                                                         │
│       ├─▶ 记录执行结果                                          │
│       │                                                         │
│       ├─▶ 发送通知                                              │
│       │                                                         │
│       └─▶ 计算下次执行时间                                      │
│                                                                  │
│  4. 更新统计数据                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 数据结构

### 2.1 TypeScript 类型定义

```typescript
// types/payroll.ts

/**
 * 发薪周期
 */
export type PayrollFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'custom';

/**
 * 执行模式
 */
export type ExecutionMode = 'auto' | 'confirm' | 'approval';

/**
 * 计划状态
 */
export type ScheduleStatus = 'active' | 'paused' | 'expired' | 'cancelled';

/**
 * 执行状态
 */
export type ExecutionStatus =
  | 'pending'      // 待执行
  | 'confirming'   // 待确认
  | 'approving'    // 待审批
  | 'executing'    // 执行中
  | 'completed'    // 已完成
  | 'partial'      // 部分成功
  | 'failed'       // 失败
  | 'cancelled'    // 已取消
  | 'missed';      // 错过窗口

/**
 * 周期配置
 */
export interface FrequencyConfig {
  type: PayrollFrequency;

  // daily
  time?: string;  // "09:00"

  // weekly
  dayOfWeek?: number;  // 0-6, 0=Sunday

  // biweekly
  startDate?: string;  // 起始日期

  // monthly
  dayOfMonth?: number;  // 1-31, -1=最后一天

  // custom
  cronExpression?: string;  // "0 9 1 * *"

  // 通用
  timezone?: string;  // "UTC" | "Asia/Shanghai"
}

/**
 * 发薪计划
 */
export interface PayrollSchedule {
  id: string;
  ownerAddress: string;
  name: string;
  description?: string;

  // 收款人（关联分账规则）
  splitRule: SplitRule;
  templateId?: string;  // 可选关联模板

  // 周期配置
  frequency: FrequencyConfig;

  // 执行配置
  executionMode: ExecutionMode;
  approverAddresses?: string[];  // 审批人列表
  maxAmountPerExecution?: number;  // 单次限额

  // 通知配置
  notifyEmail?: string;
  webhookUrl?: string;
  notifyBeforeHours?: number;  // 提前通知小时数

  // 状态
  status: ScheduleStatus;
  nextExecution?: string;  // ISO 8601
  lastExecution?: string;
  executionCount: number;
  totalPaid: number;

  // 有效期
  startDate?: string;
  endDate?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * 执行记录
 */
export interface PayrollExecution {
  id: string;
  scheduleId: string;
  scheduledTime: string;  // 计划执行时间
  actualTime?: string;    // 实际执行时间

  // 执行详情
  splitPaymentId?: string;  // 关联的分账任务
  totalAmount: number;
  token: string;
  recipientCount: number;

  // 状态
  status: ExecutionStatus;
  results?: PaymentResult[];
  successCount: number;
  failedCount: number;

  // 审批信息
  confirmedBy?: string;
  confirmedAt?: string;
  approvedBy?: string;
  approvedAt?: string;

  // 错误信息
  errorMessage?: string;

  createdAt: string;
}

/**
 * 待处理任务（确认/审批）
 */
export interface PendingAction {
  id: string;
  executionId: string;
  type: 'confirm' | 'approve';
  requesterAddress: string;
  targetAddress?: string;  // 审批人地址
  expiresAt: string;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  createdAt: string;
}
```

### 2.2 数据库 Schema

```sql
-- 发薪计划表
CREATE TABLE payroll_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address VARCHAR(42) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- 分账配置
  split_rule JSONB NOT NULL,
  template_id UUID REFERENCES split_templates(id),

  -- 周期配置
  frequency JSONB NOT NULL,

  -- 执行配置
  execution_mode VARCHAR(20) NOT NULL DEFAULT 'auto',
  approver_addresses TEXT[],
  max_amount_per_execution DECIMAL(36, 18),

  -- 通知配置
  notify_email VARCHAR(255),
  webhook_url TEXT,
  notify_before_hours INTEGER DEFAULT 24,

  -- 状态
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  next_execution TIMESTAMP WITH TIME ZONE,
  last_execution TIMESTAMP WITH TIME ZONE,
  execution_count INTEGER DEFAULT 0,
  total_paid DECIMAL(36, 18) DEFAULT 0,

  -- 有效期
  start_date DATE,
  end_date DATE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_schedule_status CHECK (
    status IN ('active', 'paused', 'expired', 'cancelled')
  ),
  CONSTRAINT valid_execution_mode CHECK (
    execution_mode IN ('auto', 'confirm', 'approval')
  )
);

-- 执行记录表
CREATE TABLE payroll_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES payroll_schedules(id),
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_time TIMESTAMP WITH TIME ZONE,

  -- 执行详情
  split_payment_id UUID REFERENCES split_payments(id),
  total_amount DECIMAL(36, 18) NOT NULL,
  token VARCHAR(20) NOT NULL,
  recipient_count INTEGER NOT NULL,

  -- 状态
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  results JSONB,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- 审批信息
  confirmed_by VARCHAR(42),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  approved_by VARCHAR(42),
  approved_at TIMESTAMP WITH TIME ZONE,

  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_execution_status CHECK (
    status IN ('pending', 'confirming', 'approving', 'executing',
               'completed', 'partial', 'failed', 'cancelled', 'missed')
  )
);

-- 待处理任务表
CREATE TABLE pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES payroll_executions(id),
  type VARCHAR(20) NOT NULL,
  requester_address VARCHAR(42) NOT NULL,
  target_address VARCHAR(42),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_action_type CHECK (type IN ('confirm', 'approve')),
  CONSTRAINT valid_action_status CHECK (
    status IN ('pending', 'completed', 'expired', 'cancelled')
  )
);

-- 索引
CREATE INDEX idx_payroll_schedules_owner ON payroll_schedules(owner_address);
CREATE INDEX idx_payroll_schedules_status ON payroll_schedules(status);
CREATE INDEX idx_payroll_schedules_next ON payroll_schedules(next_execution)
  WHERE status = 'active';

CREATE INDEX idx_payroll_executions_schedule ON payroll_executions(schedule_id);
CREATE INDEX idx_payroll_executions_status ON payroll_executions(status);
CREATE INDEX idx_payroll_executions_time ON payroll_executions(scheduled_time);

CREATE INDEX idx_pending_actions_execution ON pending_actions(execution_id);
CREATE INDEX idx_pending_actions_target ON pending_actions(target_address)
  WHERE status = 'pending';
```

---

## 3. 核心服务实现

### 3.1 调度服务 (SchedulerService)

```typescript
// lib/services/payroll-scheduler-service.ts

import { getSupabase } from '@/lib/supabase';
import { calculateSplit, executeSplitPayment } from './split-payment-service';
import { sendNotification } from './notification-service';
import type { PayrollSchedule, PayrollExecution, FrequencyConfig } from '@/types/payroll';

export class PayrollSchedulerService {

  /**
   * 计算下次执行时间
   */
  static calculateNextExecution(
    frequency: FrequencyConfig,
    fromDate: Date = new Date()
  ): Date {
    const tz = frequency.timezone || 'UTC';
    const time = frequency.time || '09:00';
    const [hours, minutes] = time.split(':').map(Number);

    let next = new Date(fromDate);

    switch (frequency.type) {
      case 'daily':
        next.setUTCHours(hours, minutes, 0, 0);
        if (next <= fromDate) {
          next.setDate(next.getDate() + 1);
        }
        break;

      case 'weekly':
        const targetDay = frequency.dayOfWeek || 1; // Monday
        const currentDay = next.getDay();
        const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntil);
        next.setUTCHours(hours, minutes, 0, 0);
        break;

      case 'biweekly':
        // 基于 startDate 计算
        const start = new Date(frequency.startDate || fromDate);
        const weeksSinceStart = Math.floor(
          (fromDate.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        const nextBiweek = Math.ceil((weeksSinceStart + 1) / 2) * 2;
        next = new Date(start);
        next.setDate(next.getDate() + nextBiweek * 7);
        next.setUTCHours(hours, minutes, 0, 0);
        break;

      case 'monthly':
        const day = frequency.dayOfMonth || 1;
        next.setDate(1); // 先设为1号避免跨月问题
        next.setMonth(next.getMonth() + 1);
        if (day === -1) {
          // 最后一天
          next.setDate(0);
        } else {
          next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
        }
        next.setUTCHours(hours, minutes, 0, 0);
        break;

      case 'custom':
        // 解析 cron 表达式
        const cronParser = require('cron-parser');
        const interval = cronParser.parseExpression(frequency.cronExpression!, {
          currentDate: fromDate,
          tz
        });
        next = interval.next().toDate();
        break;
    }

    return next;
  }

  /**
   * 查询到期的计划
   */
  static async getDueSchedules(): Promise<PayrollSchedule[]> {
    const supabase = getSupabase();
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // 1小时前

    const { data, error } = await supabase
      .from('payroll_schedules')
      .select('*')
      .eq('status', 'active')
      .lte('next_execution', now.toISOString())
      .gte('next_execution', windowStart.toISOString());

    if (error) {
      console.error('[Scheduler] Query due schedules error:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 处理单个计划
   */
  static async processSchedule(schedule: PayrollSchedule): Promise<PayrollExecution> {
    const supabase = getSupabase();

    // 创建执行记录
    const { data: execution, error: createError } = await supabase
      .from('payroll_executions')
      .insert({
        schedule_id: schedule.id,
        scheduled_time: schedule.nextExecution,
        total_amount: schedule.splitRule.totalAmount,
        token: schedule.splitRule.token,
        recipient_count: schedule.splitRule.items.length,
        status: 'pending'
      })
      .select()
      .single();

    if (createError || !execution) {
      throw new Error(`Failed to create execution: ${createError?.message}`);
    }

    try {
      // 根据执行模式处理
      switch (schedule.executionMode) {
        case 'auto':
          return await this.executePayroll(execution, schedule);

        case 'confirm':
          return await this.createConfirmRequest(execution, schedule);

        case 'approval':
          return await this.createApprovalRequest(execution, schedule);

        default:
          throw new Error(`Unknown execution mode: ${schedule.executionMode}`);
      }
    } catch (error) {
      // 更新执行状态为失败
      await supabase
        .from('payroll_executions')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', execution.id);

      throw error;
    }
  }

  /**
   * 执行发薪
   */
  static async executePayroll(
    execution: PayrollExecution,
    schedule: PayrollSchedule
  ): Promise<PayrollExecution> {
    const supabase = getSupabase();

    // 更新状态为执行中
    await supabase
      .from('payroll_executions')
      .update({ status: 'executing', actual_time: new Date().toISOString() })
      .eq('id', execution.id);

    // 计算分账
    const calculation = calculateSplit(schedule.splitRule);
    if (!calculation.success) {
      throw new Error('Split calculation failed');
    }

    // 创建分账任务并执行
    const { data: splitPayment } = await supabase
      .from('split_payments')
      .insert({
        creator_address: schedule.ownerAddress,
        total_amount: schedule.splitRule.totalAmount,
        token: schedule.splitRule.token,
        chain_id: schedule.splitRule.chainId,
        split_mode: schedule.splitRule.mode,
        rule: schedule.splitRule,
        calculation,
        status: 'pending'
      })
      .select()
      .single();

    // 执行支付
    const result = await executeSplitPayment(
      splitPayment!,
      schedule.ownerAddress
    );

    // 更新执行记录
    const successCount = result.results?.filter(r => r.success).length || 0;
    const failedCount = (result.results?.length || 0) - successCount;

    await supabase
      .from('payroll_executions')
      .update({
        split_payment_id: splitPayment!.id,
        status: result.status === 'completed' ? 'completed' : 'partial',
        results: result.results,
        success_count: successCount,
        failed_count: failedCount
      })
      .eq('id', execution.id);

    // 更新计划
    const nextExecution = this.calculateNextExecution(schedule.frequency);
    await supabase
      .from('payroll_schedules')
      .update({
        last_execution: new Date().toISOString(),
        next_execution: nextExecution.toISOString(),
        execution_count: schedule.executionCount + 1,
        total_paid: schedule.totalPaid + (result.calculation?.totalAmount || 0)
      })
      .eq('id', schedule.id);

    // 发送通知
    await sendNotification({
      type: 'payroll_executed',
      recipient: schedule.ownerAddress,
      email: schedule.notifyEmail,
      data: {
        scheduleName: schedule.name,
        totalAmount: schedule.splitRule.totalAmount,
        token: schedule.splitRule.token,
        successCount,
        failedCount
      }
    });

    return {
      ...execution,
      status: result.status === 'completed' ? 'completed' : 'partial',
      successCount,
      failedCount
    };
  }

  /**
   * 创建确认请求
   */
  static async createConfirmRequest(
    execution: PayrollExecution,
    schedule: PayrollSchedule
  ): Promise<PayrollExecution> {
    const supabase = getSupabase();

    // 更新状态
    await supabase
      .from('payroll_executions')
      .update({ status: 'confirming' })
      .eq('id', execution.id);

    // 创建待确认任务
    await supabase
      .from('pending_actions')
      .insert({
        execution_id: execution.id,
        type: 'confirm',
        requester_address: schedule.ownerAddress,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

    // 发送通知
    await sendNotification({
      type: 'payroll_confirm_required',
      recipient: schedule.ownerAddress,
      email: schedule.notifyEmail,
      data: {
        scheduleName: schedule.name,
        totalAmount: schedule.splitRule.totalAmount,
        executionId: execution.id
      }
    });

    return { ...execution, status: 'confirming' };
  }

  /**
   * 创建审批请求
   */
  static async createApprovalRequest(
    execution: PayrollExecution,
    schedule: PayrollSchedule
  ): Promise<PayrollExecution> {
    const supabase = getSupabase();

    // 更新状态
    await supabase
      .from('payroll_executions')
      .update({ status: 'approving' })
      .eq('id', execution.id);

    // 为每个审批人创建待审批任务
    const approvers = schedule.approverAddresses || [];
    for (const approver of approvers) {
      await supabase
        .from('pending_actions')
        .insert({
          execution_id: execution.id,
          type: 'approve',
          requester_address: schedule.ownerAddress,
          target_address: approver,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });

      // 发送审批通知
      await sendNotification({
        type: 'payroll_approval_required',
        recipient: approver,
        data: {
          scheduleName: schedule.name,
          totalAmount: schedule.splitRule.totalAmount,
          requester: schedule.ownerAddress
        }
      });
    }

    return { ...execution, status: 'approving' };
  }

  /**
   * 确认执行
   */
  static async confirmExecution(executionId: string, confirmerAddress: string): Promise<void> {
    const supabase = getSupabase();

    // 获取执行记录
    const { data: execution } = await supabase
      .from('payroll_executions')
      .select('*, payroll_schedules(*)')
      .eq('id', executionId)
      .single();

    if (!execution || execution.status !== 'confirming') {
      throw new Error('Invalid execution state');
    }

    // 验证确认人
    if (execution.payroll_schedules.owner_address !== confirmerAddress.toLowerCase()) {
      throw new Error('Unauthorized');
    }

    // 更新待处理任务
    await supabase
      .from('pending_actions')
      .update({ status: 'completed' })
      .eq('execution_id', executionId)
      .eq('type', 'confirm');

    // 执行发薪
    await this.executePayroll(execution, execution.payroll_schedules);
  }
}
```

### 3.2 Cron API 端点

```typescript
// app/api/cron/payroll/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PayrollSchedulerService } from '@/lib/services/payroll-scheduler-service';

// Vercel Cron 配置
export const runtime = 'edge';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // 验证 Cron 密钥
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] Payroll job started');

  try {
    // 获取到期的计划
    const dueSchedules = await PayrollSchedulerService.getDueSchedules();
    console.log(`[Cron] Found ${dueSchedules.length} due schedules`);

    const results = [];

    // 处理每个计划
    for (const schedule of dueSchedules) {
      try {
        const execution = await PayrollSchedulerService.processSchedule(schedule);
        results.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          status: execution.status,
          success: true
        });
      } catch (error) {
        console.error(`[Cron] Schedule ${schedule.id} failed:`, error);
        results.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          status: 'failed',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      results
    });

  } catch (error) {
    console.error('[Cron] Payroll job error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
```

### 3.3 Vercel Cron 配置

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/payroll",
      "schedule": "0 * * * *"
    }
  ]
}
```

---

## 4. API 设计

### 4.1 API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/payroll/schedules` | GET | 获取发薪计划列表 |
| `/api/payroll/schedules` | POST | 创建发薪计划 |
| `/api/payroll/schedules/[id]` | GET | 获取计划详情 |
| `/api/payroll/schedules/[id]` | PUT | 更新计划 |
| `/api/payroll/schedules/[id]` | DELETE | 删除计划 |
| `/api/payroll/schedules/[id]/pause` | POST | 暂停计划 |
| `/api/payroll/schedules/[id]/resume` | POST | 恢复计划 |
| `/api/payroll/executions` | GET | 获取执行历史 |
| `/api/payroll/executions/[id]` | GET | 获取执行详情 |
| `/api/payroll/executions/[id]/confirm` | POST | 确认执行 |
| `/api/payroll/executions/[id]/approve` | POST | 审批执行 |
| `/api/payroll/executions/[id]/cancel` | POST | 取消执行 |
| `/api/payroll/pending-actions` | GET | 获取待处理任务 |

---

## 5. 前端组件

### 5.1 组件结构

```
components/payroll/
├── PayrollScheduleList.tsx       # 计划列表
├── PayrollScheduleForm.tsx       # 创建/编辑表单
├── PayrollExecutionList.tsx      # 执行历史
├── PayrollExecutionDetail.tsx    # 执行详情
├── PendingActionList.tsx         # 待处理任务
├── FrequencySelector.tsx         # 周期选择器
├── ExecutionModeSelector.tsx     # 执行模式选择
└── hooks/
    ├── usePayrollSchedules.ts    # 计划数据 Hook
    └── usePayrollExecutions.ts   # 执行数据 Hook
```

### 5.2 页面路由

```
app/payroll/
├── page.tsx                      # 发薪计划列表
├── new/page.tsx                  # 创建计划
├── [id]/page.tsx                 # 计划详情
├── [id]/edit/page.tsx            # 编辑计划
└── executions/
    ├── page.tsx                  # 执行历史
    └── [id]/page.tsx             # 执行详情
```

---

## 6. 通知服务

### 6.1 通知类型

```typescript
// lib/services/notification-service.ts

type NotificationType =
  | 'payroll_upcoming'           // 即将执行提醒
  | 'payroll_confirm_required'   // 需要确认
  | 'payroll_approval_required'  // 需要审批
  | 'payroll_executed'           // 执行完成
  | 'payroll_failed'             // 执行失败
  | 'payroll_missed';            // 错过执行窗口

interface NotificationPayload {
  type: NotificationType;
  recipient: string;             // 钱包地址
  email?: string;                // 可选邮箱
  data: Record<string, any>;
}
```

### 6.2 Email 模板

使用 Resend 发送邮件，React Email 组件。

---

## 7. 安全考虑

### 7.1 执行安全

- **无私钥存储**: 使用预签名交易或 EIP-3009 授权
- **限额保护**: 单次执行金额限制
- **审批流程**: 大额支付多人审批

### 7.2 调度安全

- **Cron 密钥**: 验证请求来源
- **幂等性**: 防止重复执行
- **窗口限制**: 超时任务标记为 missed

---

## 8. 监控与告警

### 8.1 监控指标

- 定时任务执行成功率
- 平均执行时间
- 失败任务数量
- 队列积压数量

### 8.2 告警规则

| 条件 | 告警级别 |
|------|---------|
| 执行失败率 > 5% | Warning |
| 执行失败率 > 20% | Critical |
| Cron 任务连续 3 次失败 | Critical |
| 任务执行时间 > 5 分钟 | Warning |

---

## 9. 文件清单

### 9.1 新增文件

```
types/
└── payroll.ts

lib/services/
├── payroll-scheduler-service.ts
└── notification-service.ts

app/api/
├── cron/payroll/route.ts
└── payroll/
    ├── schedules/route.ts
    ├── schedules/[id]/route.ts
    ├── executions/route.ts
    └── pending-actions/route.ts

app/payroll/
├── page.tsx
├── new/page.tsx
└── [id]/page.tsx

components/payroll/
├── PayrollScheduleList.tsx
├── PayrollScheduleForm.tsx
├── FrequencySelector.tsx
└── hooks/usePayrollSchedules.ts

vercel.json (更新)
```

---

**最后更新**: 2025-01-30
