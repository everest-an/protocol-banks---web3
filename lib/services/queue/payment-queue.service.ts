/**
 * Payment Queue Service
 *
 * 高并发支付处理队列，基于 Redis + BullMQ
 *
 * 功能:
 * - 支付任务入队 (防止重复提交)
 * - 并发处理 (50 Worker)
 * - 自动重试 (指数退避)
 * - 防双花验证
 * - 优先级队列 (大额订单优先)
 */

import { Queue, Worker, Job } from 'bullmq'
import type { Redis } from 'ioredis'
import { createRedisConnection } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { getConfirmationInfo, getTronTransaction } from '@/lib/services/tron-payment'
import { webhookTriggerService } from '@/lib/services/webhook-trigger-service'
import { unifiedYieldService } from '@/lib/services/yield/unified-yield.service'
import { logger } from '@/lib/logger/structured-logger'
import { paymentTaskSchema, formatZodError } from '@/lib/validations/yield'

/**
 * 支付任务数据
 */
export interface PaymentTask {
  paymentId: string
  orderId: string
  txHash: string
  amount: string
  token: string
  network: 'tron' | 'ethereum' | 'base' | 'arbitrum'
  merchantId: string
}

/**
 * 队列配置
 */
const QUEUE_CONFIG = {
  name: 'payment-processing',
  concurrency: 50,       // 50 个并发 Worker
  attempts: 3,           // 最多重试 3 次
  backoffType: 'exponential' as const,
  backoffDelay: 2000,    // 2 秒后开始重试
  jobTimeout: 60000,     // 单个任务超时 60 秒
  stalledInterval: 30000 // Stalled 检测间隔 30 秒
}

/**
 * Payment Queue Service
 */
export class PaymentQueueService {
  private queue: Queue
  private redis: Redis
  private worker: Worker | null = null

  constructor() {
    // 初始化安全 Redis 连接 (支持 TLS + 认证)
    this.redis = createRedisConnection()

    // 初始化队列
    this.queue = new Queue(QUEUE_CONFIG.name, {
      connection: this.redis as unknown as import('bullmq').ConnectionOptions,
      defaultJobOptions: {
        attempts: QUEUE_CONFIG.attempts,
        backoff: {
          type: QUEUE_CONFIG.backoffType,
          delay: QUEUE_CONFIG.backoffDelay
        },
        removeOnComplete: {
          age: 86400,  // 保留完成任务 24 小时
          count: 1000
        },
        removeOnFail: {
          age: 604800  // 保留失败任务 7 天
        }
      }
    })

    logger.info('Payment queue service initialized', {
      component: 'payment-queue',
      action: 'initialize',
      metadata: {
        concurrency: QUEUE_CONFIG.concurrency,
        maxAttempts: QUEUE_CONFIG.attempts,
        queueName: QUEUE_CONFIG.name
      }
    })
  }

  /**
   * 添加支付任务到队列
   *
   * @param task - 支付任务数据
   * @returns Job 对象
   */
  async enqueuePayment(task: PaymentTask): Promise<Job> {
    // Zod 输入验证
    const validated = paymentTaskSchema.safeParse(task)
    if (!validated.success) {
      throw new Error(`Invalid payment task: ${formatZodError(validated.error)}`)
    }

    // 使用 jobId 防止重复提交
    const jobId = `payment-${task.txHash}`

    // 检查任务是否已存在
    const existingJob = await this.queue.getJob(jobId)
    if (existingJob) {
      logger.info('Payment job already exists, skipping', {
        component: 'payment-queue',
        action: 'enqueue',
        txHash: task.txHash,
        orderId: task.orderId,
        metadata: { jobId }
      })
      return existingJob
    }

    // 计算优先级 (金额越大优先级越高)
    const priority = this.calculatePriority(parseFloat(task.amount))

    // 添加到队列
    const job = await this.queue.add(
      'process-payment',
      task,
      {
        jobId,
        priority
      }
    )

    logger.info('Payment job enqueued', {
      component: 'payment-queue',
      action: 'enqueue',
      txHash: task.txHash,
      orderId: task.orderId,
      network: task.network,
      metadata: { jobId, priority, amount: task.amount }
    })

    // 保存任务记录到数据库
    await this.saveJobRecord(job.id!, task, 'pending')

    return job
  }

  /**
   * 启动 Worker 处理队列
   *
   * Worker 会自动处理队列中的任务，支持并发和重试
   */
  startWorker() {
    if (this.worker) {
      logger.warn('Worker already started', {
        component: 'payment-queue',
        action: 'start_worker'
      })
      return
    }

    this.worker = new Worker(
      QUEUE_CONFIG.name,
      async (job: Job<PaymentTask>) => {
        const { paymentId, orderId, txHash, amount, network, merchantId } = job.data

        const jobLogger = logger.child({
          component: 'payment-queue',
          orderId,
          txHash,
          network
        })

        jobLogger.info(`Processing payment job (attempt ${job.attemptsMade + 1}/${QUEUE_CONFIG.attempts})`, {
          action: 'process_job',
          metadata: { jobId: job.id, amount, merchantId }
        })

        try {
          // 1. 验证交易确认数
          const confirmationInfo = await getConfirmationInfo(txHash)
          if (confirmationInfo.confirmations < 3) {
            throw new Error(`Insufficient confirmations: ${confirmationInfo.confirmations}/3`)
          }

          // 2. 防双花检查
          const isDoubleSpend = await this.checkDoubleSpend(txHash, orderId)
          if (isDoubleSpend) {
            throw new Error('Double spend detected')
          }

          // 3. 链上验证交易真实性
          const onChainTx = await getTronTransaction(txHash)
          if (!onChainTx) {
            throw new Error('Transaction not found on blockchain')
          }

          // 4. 验证金额匹配
          if (onChainTx.amount !== amount) {
            throw new Error(`Amount mismatch: expected ${amount}, got ${onChainTx.amount}`)
          }

          // 5. 更新订单状态
          await prisma.acquiringOrder.update({
            where: { id: orderId },
            data: {
              status: 'confirmed',
              tx_hash: txHash,
              paid_at: new Date()
            }
          })

          // 6. 更新支付记录
          await prisma.payment.update({
            where: { id: paymentId },
            data: {
              status: 'completed',
              confirmations: confirmationInfo.confirmations
            }
          })

          // 7. 触发 Webhook (resolve chain_id from network)
          const chainIdMap: Record<string, number> = {
            ethereum: 1, base: 8453, arbitrum: 42161, tron: 728126428,
          }
          await webhookTriggerService.triggerPaymentCompleted(merchantId, {
            payment_id: paymentId,
            from_address: onChainTx.from_address,
            to_address: onChainTx.to_address,
            amount,
            token_symbol: onChainTx.token_symbol,
            chain_id: chainIdMap[network] ?? 1,
            tx_hash: txHash,
            status: 'completed',
            created_at: new Date().toISOString()
          })

          // 8. 自动存入收益协议 (非阻塞)
          try {
            await unifiedYieldService.autoDepositHook(orderId, merchantId, amount, network)
          } catch (autoDepositError) {
            jobLogger.warn('Auto-deposit hook failed (non-blocking)', {
              action: 'auto_deposit_failed',
              metadata: { error: String(autoDepositError) }
            })
          }

          // 9. 更新任务状态
          await this.saveJobRecord(job.id!, job.data, 'completed')

          jobLogger.logPayment('completed', txHash, amount, {
            action: 'job_completed',
            metadata: {
              jobId: job.id,
              confirmations: confirmationInfo.confirmations,
              merchantId
            }
          })

          return { success: true, txHash, confirmations: confirmationInfo.confirmations }

        } catch (error) {
          jobLogger.error('Payment job failed', error instanceof Error ? error : new Error(String(error)), {
            action: 'job_failed',
            metadata: {
              jobId: job.id,
              attempt: job.attemptsMade + 1,
              maxAttempts: QUEUE_CONFIG.attempts
            }
          })

          // 更新任务状态 (best-effort, don't lose original error)
          try {
            await this.saveJobRecord(job.id!, job.data, 'failed', error instanceof Error ? error.message : 'Unknown error')
          } catch (dbError) {
            jobLogger.error('Failed to save job failure record', dbError instanceof Error ? dbError : new Error(String(dbError)), {
              action: 'save_failure_record_error',
              metadata: { jobId: job.id }
            })
          }

          // 抛出错误触发重试
          throw error
        }
      },
      {
        connection: this.redis as unknown as import('bullmq').ConnectionOptions,
        concurrency: QUEUE_CONFIG.concurrency,
        lockDuration: QUEUE_CONFIG.jobTimeout,
        stalledInterval: QUEUE_CONFIG.stalledInterval,
        limiter: {
          max: 100,      // 每个时间窗口最多处理 100 个任务
          duration: 1000  // 时间窗口 1 秒
        }
      }
    )

    // 监听事件
    this.worker.on('completed', (job) => {
      logger.info('Job completed', {
        component: 'payment-queue',
        action: 'job_completed',
        metadata: { jobId: job.id }
      })
    })

    this.worker.on('failed', (job, err) => {
      logger.error('Job failed', err, {
        component: 'payment-queue',
        action: 'job_failed',
        metadata: { jobId: job?.id, attempt: job?.attemptsMade }
      })
    })

    this.worker.on('stalled', (jobId) => {
      logger.logSecurityEvent('job_stalled', 'medium', {
        jobId,
        message: 'Worker stalled - possible crash or timeout'
      }, { component: 'payment-queue' })
    })

    this.worker.on('error', (err) => {
      logger.error('Worker error', err, {
        component: 'payment-queue',
        action: 'worker_error'
      })
    })

    logger.info('Worker started', {
      component: 'payment-queue',
      action: 'start_worker',
      metadata: { concurrency: QUEUE_CONFIG.concurrency }
    })
  }

  /**
   * 停止 Worker
   */
  async stopWorker() {
    if (this.worker) {
      await this.worker.close()
      this.worker = null
      logger.info('Worker stopped', {
        component: 'payment-queue',
        action: 'stop_worker'
      })
    }
  }

  /**
   * 获取队列统计信息
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount()
    ])

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed
    }
  }

  /**
   * 获取任务详情
   *
   * @param jobId - 任务 ID
   */
  async getJob(jobId: string) {
    return await this.queue.getJob(jobId)
  }

  /**
   * 手动重试失败的任务
   *
   * @param jobId - 任务 ID
   */
  async retryJob(jobId: string) {
    const job = await this.queue.getJob(jobId)
    if (!job) {
      throw new Error('Job not found')
    }

    await job.retry()
    logger.info('Job marked for retry', {
      component: 'payment-queue',
      action: 'retry_job',
      metadata: { jobId }
    })
  }

  /**
   * 清理旧任务
   *
   * @param olderThan - 清理多少毫秒之前的任务
   */
  async cleanOldJobs(olderThan: number = 7 * 24 * 60 * 60 * 1000) {  // 默认 7 天
    await this.queue.clean(olderThan, 100, 'completed')
    await this.queue.clean(olderThan, 100, 'failed')
    logger.info('Old jobs cleaned', {
      component: 'payment-queue',
      action: 'clean_jobs',
      metadata: { olderThan, olderThanDays: olderThan / (24 * 60 * 60 * 1000) }
    })
  }

  /**
   * 计算任务优先级
   *
   * 金额越大，优先级数字越小（优先级越高）
   *
   * @param amount - 支付金额
   * @returns 优先级 (1-10)
   */
  private calculatePriority(amount: number): number {
    if (amount >= 10000) return 1     // 超大额: 最高优先级
    if (amount >= 1000) return 2      // 大额
    if (amount >= 100) return 5       // 中额
    return 10                         // 小额: 最低优先级
  }

  /**
   * 防双花检查
   *
   * @param txHash - 交易哈希
   * @param orderId - 订单 ID
   * @returns 是否为双花攻击
   */
  private async checkDoubleSpend(txHash: string, orderId: string): Promise<boolean> {
    // Redis atomic check-and-set to prevent race conditions
    const lockKey = `ds:lock:${txHash}`
    const acquired = await this.redis.set(lockKey, orderId, 'EX', 300, 'NX')
    if (!acquired) {
      // Key already exists - check if it's the same order
      const existingOrderId = await this.redis.get(lockKey)
      if (existingOrderId && existingOrderId !== orderId) {
        logger.logSecurityEvent('double_spend_race_condition', 'high', {
          txHash, attemptedOrderId: orderId, existingOrderId
        }, { component: 'payment-queue' })
        return true
      }
    }

    // Also check database for durability
    const existingPayment = await prisma.payment.findFirst({
      where: {
        tx_hash: txHash,
        NOT: { id: orderId }
      }
    })

    if (existingPayment) {
      logger.logSecurityEvent(
        'double_spend_detected',
        'high',
        {
          txHash,
          attemptedOrderId: orderId,
          existingOrderId: existingPayment.id
        },
        {
          component: 'payment-queue',
          action: 'double_spend_check',
          txHash,
          orderId
        }
      )
      return true
    }

    return false
  }

  /**
   * 保存任务记录到数据库
   *
   * @param jobId - 任务 ID
   * @param task - 任务数据
   * @param status - 任务状态
   * @param errorMessage - 错误信息 (可选)
   */
  private async saveJobRecord(
    jobId: string,
    task: PaymentTask,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    errorMessage?: string
  ) {
    await prisma.paymentQueueJob.upsert({
      where: { id: jobId },
      create: {
        id: jobId,
        payment_id: task.paymentId,
        order_id: task.orderId,
        tx_hash: task.txHash,
        status,
        error_message: errorMessage,
        attempts: 0
      },
      update: {
        status,
        error_message: errorMessage,
        processed_at: status === 'completed' || status === 'failed' ? new Date() : undefined,
        attempts: {
          increment: status === 'failed' ? 1 : 0
        }
      }
    })
  }

  /**
   * 关闭连接
   */
  async close() {
    await this.stopWorker()
    await this.queue.close()
    await this.redis.quit()
    logger.info('Payment queue service closed', {
      component: 'payment-queue',
      action: 'close'
    })
  }
}

// 导出单例实例
export const paymentQueueService = new PaymentQueueService()
