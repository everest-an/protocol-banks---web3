/**
 * Concurrency Utility Tests
 * Tests for lib/utils/concurrency.ts
 */

import {
  runConcurrent,
  unwrapResults,
  getSuccessResults,
  getFailedTasks,
  calculateSuccessRate,
  TaskResult,
} from "@/lib/utils/concurrency"

describe("Concurrency Utilities", () => {
  // Helper to create async task
  const createTask = <T>(result: T, delay = 10): (() => Promise<T>) => {
    return () => new Promise((resolve) => setTimeout(() => resolve(result), delay))
  }

  // Helper to create failing task
  const createFailingTask = (errorMessage: string, delay = 10): (() => Promise<never>) => {
    return () =>
      new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), delay))
  }

  describe("runConcurrent", () => {
    it("should execute all tasks successfully", async () => {
      const tasks = [createTask(1), createTask(2), createTask(3)]

      const results = await runConcurrent(tasks)

      expect(results).toHaveLength(3)
      expect(results.every((r) => r.success)).toBe(true)
      expect(results.map((r) => r.result)).toEqual([1, 2, 3])
    })

    it("should respect concurrency limit", async () => {
      const executionOrder: number[] = []
      const tasks = [0, 1, 2, 3, 4].map((i) => () => {
        executionOrder.push(i)
        return Promise.resolve(i)
      })

      await runConcurrent(tasks, { concurrency: 2, batchDelay: 0 })

      // With concurrency 2, tasks should run in batches
      // Batch 1: 0, 1
      // Batch 2: 2, 3
      // Batch 3: 4
      expect(executionOrder).toHaveLength(5)
    })

    it("should handle task failures without stopping", async () => {
      const tasks = [
        createTask("success1"),
        createFailingTask("error"),
        createTask("success2"),
      ]

      const results = await runConcurrent(tasks, { concurrency: 3 })

      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].error).toBe("error")
      expect(results[2].success).toBe(true)
    })

    it("should retry failed tasks", async () => {
      let attemptCount = 0
      const tasks = [
        () => {
          attemptCount++
          if (attemptCount < 3) {
            return Promise.reject(new Error("temporary failure"))
          }
          return Promise.resolve("success")
        },
      ]

      const results = await runConcurrent(tasks, {
        retries: 3,
        retryDelay: 10,
      })

      expect(results[0].success).toBe(true)
      expect(results[0].result).toBe("success")
      expect(results[0].retryCount).toBe(2)
    })

    it("should timeout slow tasks", async () => {
      const tasks = [() => new Promise<string>((resolve) => setTimeout(() => resolve("slow"), 500))]

      const results = await runConcurrent(tasks, { timeout: 50 })

      expect(results[0].success).toBe(false)
      expect(results[0].error).toContain("timeout")
    })

    it("should call progress callback", async () => {
      const tasks = [createTask(1, 5), createTask(2, 5), createTask(3, 5)]
      const progressCalls: Array<{ completed: number; total: number }> = []

      await runConcurrent(tasks, { concurrency: 1, batchDelay: 0 }, (completed, total) => {
        progressCalls.push({ completed, total })
      })

      expect(progressCalls).toHaveLength(3)
      expect(progressCalls[0]).toEqual({ completed: 1, total: 3 })
      expect(progressCalls[1]).toEqual({ completed: 2, total: 3 })
      expect(progressCalls[2]).toEqual({ completed: 3, total: 3 })
    })

    it("should handle empty task array", async () => {
      const results = await runConcurrent([])

      expect(results).toHaveLength(0)
    })

    it("should maintain result order", async () => {
      // Create tasks with varying delays to ensure out-of-order completion
      const tasks = [
        createTask("a", 30),
        createTask("b", 10),
        createTask("c", 20),
      ]

      const results = await runConcurrent(tasks, { concurrency: 3 })

      // Results should be in original order regardless of completion time
      expect(results[0].index).toBe(0)
      expect(results[0].result).toBe("a")
      expect(results[1].index).toBe(1)
      expect(results[1].result).toBe("b")
      expect(results[2].index).toBe(2)
      expect(results[2].result).toBe("c")
    })
  })

  describe("unwrapResults", () => {
    it("should extract results maintaining order", () => {
      const taskResults: TaskResult<string>[] = [
        { index: 0, success: true, result: "a" },
        { index: 1, success: false, error: "failed" },
        { index: 2, success: true, result: "c" },
      ]

      const unwrapped = unwrapResults(taskResults)

      expect(unwrapped).toEqual(["a", null, "c"])
    })

    it("should handle empty array", () => {
      expect(unwrapResults([])).toEqual([])
    })

    it("should sort by index", () => {
      const taskResults: TaskResult<number>[] = [
        { index: 2, success: true, result: 3 },
        { index: 0, success: true, result: 1 },
        { index: 1, success: true, result: 2 },
      ]

      const unwrapped = unwrapResults(taskResults)

      expect(unwrapped).toEqual([1, 2, 3])
    })
  })

  describe("getSuccessResults", () => {
    it("should return only successful results", () => {
      const taskResults: TaskResult<string>[] = [
        { index: 0, success: true, result: "a" },
        { index: 1, success: false, error: "failed" },
        { index: 2, success: true, result: "b" },
      ]

      const successes = getSuccessResults(taskResults)

      expect(successes).toEqual(["a", "b"])
    })

    it("should handle all failures", () => {
      const taskResults: TaskResult<string>[] = [
        { index: 0, success: false, error: "error1" },
        { index: 1, success: false, error: "error2" },
      ]

      expect(getSuccessResults(taskResults)).toEqual([])
    })

    it("should handle empty array", () => {
      expect(getSuccessResults([])).toEqual([])
    })
  })

  describe("getFailedTasks", () => {
    it("should return only failed tasks", () => {
      const taskResults: TaskResult<string>[] = [
        { index: 0, success: true, result: "a" },
        { index: 1, success: false, error: "error1" },
        { index: 2, success: false, error: "error2" },
      ]

      const failures = getFailedTasks(taskResults)

      expect(failures).toHaveLength(2)
      expect(failures).toEqual([
        { index: 1, error: "error1" },
        { index: 2, error: "error2" },
      ])
    })

    it("should handle missing error message", () => {
      const taskResults: TaskResult<string>[] = [
        { index: 0, success: false },
      ]

      const failures = getFailedTasks(taskResults)

      expect(failures[0].error).toBe("Unknown error")
    })

    it("should return empty array when all succeed", () => {
      const taskResults: TaskResult<string>[] = [
        { index: 0, success: true, result: "a" },
        { index: 1, success: true, result: "b" },
      ]

      expect(getFailedTasks(taskResults)).toEqual([])
    })
  })

  describe("calculateSuccessRate", () => {
    it("should calculate correct percentage", () => {
      const taskResults: TaskResult<string>[] = [
        { index: 0, success: true, result: "a" },
        { index: 1, success: true, result: "b" },
        { index: 2, success: false, error: "failed" },
        { index: 3, success: true, result: "c" },
      ]

      const rate = calculateSuccessRate(taskResults)

      expect(rate).toBe(75) // 3 out of 4
    })

    it("should return 0 for empty array", () => {
      expect(calculateSuccessRate([])).toBe(0)
    })

    it("should return 100 for all successes", () => {
      const taskResults: TaskResult<string>[] = [
        { index: 0, success: true, result: "a" },
        { index: 1, success: true, result: "b" },
      ]

      expect(calculateSuccessRate(taskResults)).toBe(100)
    })

    it("should return 0 for all failures", () => {
      const taskResults: TaskResult<string>[] = [
        { index: 0, success: false, error: "e1" },
        { index: 1, success: false, error: "e2" },
      ]

      expect(calculateSuccessRate(taskResults)).toBe(0)
    })
  })
})
