/**
 * 并发控制工具
 * 用于批量异步操作的并发限制
 */

export interface ConcurrencyOptions {
  /** 最大并发数，默认 5 */
  concurrency?: number;
  /** 每批之间的延迟（毫秒），默认 100ms */
  batchDelay?: number;
  /** 单个任务超时（毫秒），默认 30000ms */
  timeout?: number;
  /** 失败后重试次数，默认 0 */
  retries?: number;
  /** 重试延迟（毫秒），默认 1000ms */
  retryDelay?: number;
}

export interface TaskResult<T> {
  index: number;
  success: boolean;
  result?: T;
  error?: string;
  retryCount?: number;
}

/**
 * 带超时的 Promise 包装
 */
function withTimeout<T>(promise: Promise<T>, ms: number, taskName = 'Task'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${taskName} timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 并行执行任务，控制并发数
 *
 * @param tasks - 任务函数数组
 * @param options - 并发选项
 * @param onProgress - 进度回调 (completed, total, results)
 * @returns 所有任务的结果
 *
 * @example
 * ```ts
 * const results = await runConcurrent(
 *   recipients.map((r) => () => processPayment(r)),
 *   { concurrency: 5 },
 *   (done, total) => console.log(`${done}/${total}`)
 * );
 * ```
 */
export async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  options: ConcurrencyOptions = {},
  onProgress?: (completed: number, total: number, results: TaskResult<T>[]) => void
): Promise<TaskResult<T>[]> {
  const {
    concurrency = 5,
    batchDelay = 100,
    timeout = 30000,
    retries = 0,
    retryDelay = 1000,
  } = options;

  const total = tasks.length;
  const results: TaskResult<T>[] = [];
  let completed = 0;

  // 执行单个任务（带重试）
  async function executeTask(
    task: () => Promise<T>,
    index: number,
    retryCount = 0
  ): Promise<TaskResult<T>> {
    try {
      const result = await withTimeout(task(), timeout, `Task ${index}`);
      return {
        index,
        success: true,
        result,
        retryCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // 检查是否需要重试
      if (retryCount < retries) {
        console.log(`[Concurrency] Task ${index} failed, retrying (${retryCount + 1}/${retries})...`);
        await delay(retryDelay);
        return executeTask(task, index, retryCount + 1);
      }

      return {
        index,
        success: false,
        error: errorMessage,
        retryCount,
      };
    }
  }

  // 分批处理
  for (let i = 0; i < total; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchStartIndex = i;

    // 并行执行当前批次
    const batchPromises = batch.map((task, batchIndex) =>
      executeTask(task, batchStartIndex + batchIndex)
    );

    const batchResults = await Promise.all(batchPromises);

    // 收集结果
    for (const result of batchResults) {
      results[result.index] = result;
      completed++;

      // 触发进度回调
      if (onProgress) {
        onProgress(completed, total, results);
      }
    }

    // 批次之间添加延迟（最后一批不需要）
    if (i + concurrency < total && batchDelay > 0) {
      await delay(batchDelay);
    }
  }

  return results;
}

/**
 * 将 TaskResult 数组转换为简单结果数组
 * 保持原始顺序
 */
export function unwrapResults<T>(taskResults: TaskResult<T>[]): Array<T | null> {
  return taskResults
    .sort((a, b) => a.index - b.index)
    .map((r) => (r.success ? r.result! : null));
}

/**
 * 获取成功的结果
 */
export function getSuccessResults<T>(taskResults: TaskResult<T>[]): T[] {
  return taskResults
    .filter((r) => r.success && r.result !== undefined)
    .map((r) => r.result!);
}

/**
 * 获取失败的任务信息
 */
export function getFailedTasks<T>(taskResults: TaskResult<T>[]): Array<{ index: number; error: string }> {
  return taskResults
    .filter((r) => !r.success)
    .map((r) => ({ index: r.index, error: r.error || 'Unknown error' }));
}

/**
 * 计算成功率
 */
export function calculateSuccessRate<T>(taskResults: TaskResult<T>[]): number {
  if (taskResults.length === 0) return 0;
  const successCount = taskResults.filter((r) => r.success).length;
  return (successCount / taskResults.length) * 100;
}
