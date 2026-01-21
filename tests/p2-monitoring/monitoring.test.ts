/**
 * P2 Monitoring & Analytics Tests
 * Tests for transaction monitoring, error tracking, performance metrics, and user analytics
 */

import * as fc from 'fast-check';

describe('P2 Monitoring & Analytics', () => {
  describe('Transaction Monitoring', () => {
    it('should track transaction status changes', () => {
      const monitor = createTransactionMonitor();
      const txHash = '0x' + 'a'.repeat(64);

      monitor.trackTransaction(txHash, { status: 'pending', chainId: 8453 });
      expect(monitor.getStatus(txHash)).toBe('pending');

      monitor.updateStatus(txHash, 'confirmed');
      expect(monitor.getStatus(txHash)).toBe('confirmed');
    });

    it('should record transaction timestamps', () => {
      const monitor = createTransactionMonitor();
      const txHash = '0x' + 'b'.repeat(64);
      const before = Date.now();

      monitor.trackTransaction(txHash, { status: 'pending', chainId: 1 });
      const after = Date.now();

      const tx = monitor.getTransaction(txHash);
      expect(tx.createdAt).toBeGreaterThanOrEqual(before);
      expect(tx.createdAt).toBeLessThanOrEqual(after);
    });

    it('should calculate confirmation time', () => {
      const monitor = createTransactionMonitor();
      const txHash = '0x' + 'c'.repeat(64);

      monitor.trackTransaction(txHash, { status: 'pending', chainId: 8453 });

      // Simulate delay
      monitor.updateStatus(txHash, 'confirmed');

      const tx = monitor.getTransaction(txHash);
      expect(tx.confirmationTime).toBeGreaterThanOrEqual(0);
    });

    it('should track failed transactions with error details', () => {
      const monitor = createTransactionMonitor();
      const txHash = '0x' + 'd'.repeat(64);

      monitor.trackTransaction(txHash, { status: 'pending', chainId: 1 });
      monitor.updateStatus(txHash, 'failed', { error: 'Insufficient gas' });

      const tx = monitor.getTransaction(txHash);
      expect(tx.status).toBe('failed');
      expect(tx.error).toBe('Insufficient gas');
    });

    it('should aggregate transaction statistics', () => {
      const monitor = createTransactionMonitor();

      // Add various transactions
      for (let i = 0; i < 10; i++) {
        const txHash = `0x${i.toString().padStart(64, 'a')}`;
        monitor.trackTransaction(txHash, { status: 'pending', chainId: 8453 });
        if (i < 7) {
          monitor.updateStatus(txHash, 'confirmed');
        } else if (i < 9) {
          monitor.updateStatus(txHash, 'failed', { error: 'Error' });
        }
      }

      const stats = monitor.getStatistics();
      expect(stats.total).toBe(10);
      expect(stats.confirmed).toBe(7);
      expect(stats.failed).toBe(2);
      expect(stats.pending).toBe(1);
      expect(stats.successRate).toBeCloseTo(0.7, 1);
    });
  });

  describe('Error Tracking', () => {
    it('should capture error details', () => {
      const tracker = createErrorTracker();

      tracker.captureError({
        type: 'TRANSACTION_FAILED',
        message: 'Insufficient balance',
        context: { userId: 'user-1', txHash: '0x123' },
      });

      const errors = tracker.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('TRANSACTION_FAILED');
    });

    it('should categorize errors by type', () => {
      const tracker = createErrorTracker();

      tracker.captureError({ type: 'VALIDATION_ERROR', message: 'Invalid address' });
      tracker.captureError({ type: 'TRANSACTION_FAILED', message: 'Gas too low' });
      tracker.captureError({ type: 'VALIDATION_ERROR', message: 'Invalid amount' });
      tracker.captureError({ type: 'NETWORK_ERROR', message: 'Connection timeout' });

      const byType = tracker.getErrorsByType();
      expect(byType['VALIDATION_ERROR']).toBe(2);
      expect(byType['TRANSACTION_FAILED']).toBe(1);
      expect(byType['NETWORK_ERROR']).toBe(1);
    });

    it('should track error frequency over time', () => {
      const tracker = createErrorTracker();

      // Simulate errors over time
      for (let i = 0; i < 20; i++) {
        tracker.captureError({
          type: 'API_ERROR',
          message: `Error ${i}`,
          timestamp: Date.now() - i * 60000, // 1 minute apart
        });
      }

      const frequency = tracker.getErrorFrequency({ windowMinutes: 10 });
      // Errors at 0-9 minutes ago (10 errors) plus potentially the one at exactly 10 minutes
      expect(frequency.count).toBeGreaterThanOrEqual(10);
      expect(frequency.count).toBeLessThanOrEqual(11);
    });

    it('should detect error spikes', () => {
      const tracker = createErrorTracker();

      // Normal error rate
      for (let i = 0; i < 5; i++) {
        tracker.captureError({ type: 'API_ERROR', message: 'Normal error' });
      }

      // Spike
      for (let i = 0; i < 50; i++) {
        tracker.captureError({ type: 'API_ERROR', message: 'Spike error' });
      }

      const alert = tracker.detectSpike({ threshold: 10, windowMinutes: 5 });
      expect(alert.detected).toBe(true);
      expect(alert.count).toBeGreaterThan(10);
    });
  });

  describe('Performance Metrics', () => {
    it('should track API response times', () => {
      const metrics = createPerformanceMetrics();

      metrics.recordResponseTime('/api/batch-payment/submit', 150);
      metrics.recordResponseTime('/api/batch-payment/submit', 200);
      metrics.recordResponseTime('/api/batch-payment/submit', 180);

      const stats = metrics.getEndpointStats('/api/batch-payment/submit');
      expect(stats.count).toBe(3);
      expect(stats.avg).toBeCloseTo(176.67, 0);
      expect(stats.min).toBe(150);
      expect(stats.max).toBe(200);
    });

    it('should calculate percentiles', () => {
      const metrics = createPerformanceMetrics();

      // Add 100 response times
      for (let i = 1; i <= 100; i++) {
        metrics.recordResponseTime('/api/test', i * 10);
      }

      const percentiles = metrics.getPercentiles('/api/test');
      // Percentiles are approximate - allow for off-by-one due to array indexing
      expect(percentiles.p50).toBeGreaterThanOrEqual(490);
      expect(percentiles.p50).toBeLessThanOrEqual(510);
      expect(percentiles.p95).toBeGreaterThanOrEqual(940);
      expect(percentiles.p95).toBeLessThanOrEqual(960);
      expect(percentiles.p99).toBeGreaterThanOrEqual(980);
      expect(percentiles.p99).toBeLessThanOrEqual(1000);
    });

    it('should track throughput', () => {
      const metrics = createPerformanceMetrics();

      // Simulate 100 requests over 10 seconds
      const startTime = Date.now() - 10000;
      for (let i = 0; i < 100; i++) {
        metrics.recordRequest('/api/test', startTime + i * 100);
      }

      const throughput = metrics.getThroughput('/api/test', { windowSeconds: 10 });
      expect(throughput.requestsPerSecond).toBeCloseTo(10, 0);
    });

    it('should detect slow endpoints', () => {
      const metrics = createPerformanceMetrics();

      metrics.recordResponseTime('/api/fast', 50);
      metrics.recordResponseTime('/api/fast', 60);
      metrics.recordResponseTime('/api/slow', 2000);
      metrics.recordResponseTime('/api/slow', 2500);

      const slowEndpoints = metrics.getSlowEndpoints({ thresholdMs: 1000 });
      expect(slowEndpoints).toContain('/api/slow');
      expect(slowEndpoints).not.toContain('/api/fast');
    });
  });

  describe('User Analytics', () => {
    it('should track user activity', () => {
      const analytics = createUserAnalytics();

      analytics.trackEvent('user-1', 'page_view', { page: '/dashboard' });
      analytics.trackEvent('user-1', 'button_click', { button: 'send' });
      analytics.trackEvent('user-1', 'transaction_initiated', { amount: 100 });

      const events = analytics.getUserEvents('user-1');
      expect(events).toHaveLength(3);
    });

    it('should calculate user engagement metrics', () => {
      const analytics = createUserAnalytics();

      // Simulate user sessions
      analytics.startSession('user-1');
      analytics.trackEvent('user-1', 'page_view', { page: '/home' });
      analytics.trackEvent('user-1', 'page_view', { page: '/send' });
      analytics.trackEvent('user-1', 'transaction_completed', {});
      analytics.endSession('user-1');

      const engagement = analytics.getUserEngagement('user-1');
      expect(engagement.totalSessions).toBe(1);
      expect(engagement.totalEvents).toBe(3);
    });

    it('should track conversion funnel', () => {
      const analytics = createUserAnalytics();

      // Simulate funnel: visit -> connect wallet -> initiate tx -> complete tx
      const users = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

      users.forEach(u => analytics.trackEvent(u, 'visit', {}));
      users.slice(0, 4).forEach(u => analytics.trackEvent(u, 'wallet_connected', {}));
      users.slice(0, 3).forEach(u => analytics.trackEvent(u, 'tx_initiated', {}));
      users.slice(0, 2).forEach(u => analytics.trackEvent(u, 'tx_completed', {}));

      const funnel = analytics.getFunnelMetrics(['visit', 'wallet_connected', 'tx_initiated', 'tx_completed']);
      expect(funnel.visit).toBe(5);
      expect(funnel.wallet_connected).toBe(4);
      expect(funnel.tx_initiated).toBe(3);
      expect(funnel.tx_completed).toBe(2);
      expect(funnel.conversionRate).toBeCloseTo(0.4, 1); // 2/5
    });

    it('should generate daily active users report', () => {
      const analytics = createUserAnalytics();

      // Simulate activity over multiple days
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      analytics.trackEvent('user-1', 'activity', {}, today);
      analytics.trackEvent('user-2', 'activity', {}, today);
      analytics.trackEvent('user-3', 'activity', {}, today);
      analytics.trackEvent('user-1', 'activity', {}, yesterday);
      analytics.trackEvent('user-4', 'activity', {}, yesterday);

      const dau = analytics.getDailyActiveUsers(today);
      expect(dau).toBe(3);

      const dauYesterday = analytics.getDailyActiveUsers(yesterday);
      expect(dauYesterday).toBe(2);
    });
  });

  describe('Alerting', () => {
    it('should trigger alerts on threshold breach', () => {
      const alerting = createAlertingSystem();
      const alerts: any[] = [];

      alerting.onAlert((alert) => alerts.push(alert));
      alerting.setThreshold('error_rate', { max: 0.1 });

      alerting.checkMetric('error_rate', 0.05); // OK
      expect(alerts).toHaveLength(0);

      alerting.checkMetric('error_rate', 0.15); // Breach
      expect(alerts).toHaveLength(1);
      expect(alerts[0].metric).toBe('error_rate');
      expect(alerts[0].value).toBe(0.15);
    });

    it('should support multiple alert channels', () => {
      const alerting = createAlertingSystem();
      const emailAlerts: any[] = [];
      const slackAlerts: any[] = [];

      alerting.addChannel('email', (alert) => emailAlerts.push(alert));
      alerting.addChannel('slack', (alert) => slackAlerts.push(alert));

      alerting.setThreshold('latency_p99', { max: 1000 });
      alerting.checkMetric('latency_p99', 1500);

      expect(emailAlerts).toHaveLength(1);
      expect(slackAlerts).toHaveLength(1);
    });

    it('should implement alert cooldown', () => {
      const alerting = createAlertingSystem();
      const alerts: any[] = [];

      alerting.onAlert((alert) => alerts.push(alert));
      alerting.setThreshold('cpu_usage', { max: 80, cooldownMs: 60000 });

      alerting.checkMetric('cpu_usage', 90); // First alert
      alerting.checkMetric('cpu_usage', 95); // Should be suppressed (cooldown)
      alerting.checkMetric('cpu_usage', 85); // Should be suppressed (cooldown)

      expect(alerts).toHaveLength(1);
    });
  });
});

// Helper functions and types
interface Transaction {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  chainId: number;
  createdAt: number;
  updatedAt: number;
  confirmationTime?: number;
  error?: string;
}

function createTransactionMonitor() {
  const transactions = new Map<string, Transaction>();

  return {
    trackTransaction(txHash: string, params: { status: Transaction['status']; chainId: number }) {
      transactions.set(txHash, {
        txHash,
        status: params.status,
        chainId: params.chainId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    },
    updateStatus(txHash: string, status: Transaction['status'], options?: { error?: string }) {
      const tx = transactions.get(txHash);
      if (tx) {
        tx.status = status;
        tx.updatedAt = Date.now();
        if (status === 'confirmed') {
          tx.confirmationTime = tx.updatedAt - tx.createdAt;
        }
        if (options?.error) {
          tx.error = options.error;
        }
      }
    },
    getStatus(txHash: string): Transaction['status'] | undefined {
      return transactions.get(txHash)?.status;
    },
    getTransaction(txHash: string): Transaction | undefined {
      return transactions.get(txHash);
    },
    getStatistics() {
      const all = Array.from(transactions.values());
      const confirmed = all.filter(t => t.status === 'confirmed').length;
      const failed = all.filter(t => t.status === 'failed').length;
      const pending = all.filter(t => t.status === 'pending').length;
      return {
        total: all.length,
        confirmed,
        failed,
        pending,
        successRate: all.length > 0 ? confirmed / all.length : 0,
      };
    },
  };
}

interface ErrorEntry {
  type: string;
  message: string;
  context?: Record<string, any>;
  timestamp: number;
}

function createErrorTracker() {
  const errors: ErrorEntry[] = [];

  return {
    captureError(params: { type: string; message: string; context?: Record<string, any>; timestamp?: number }) {
      errors.push({
        type: params.type,
        message: params.message,
        context: params.context,
        timestamp: params.timestamp ?? Date.now(),
      });
    },
    getErrors(): ErrorEntry[] {
      return [...errors];
    },
    getErrorsByType(): Record<string, number> {
      const byType: Record<string, number> = {};
      errors.forEach(e => {
        byType[e.type] = (byType[e.type] || 0) + 1;
      });
      return byType;
    },
    getErrorFrequency(options: { windowMinutes: number }): { count: number } {
      const cutoff = Date.now() - options.windowMinutes * 60 * 1000;
      const recent = errors.filter(e => e.timestamp >= cutoff);
      return { count: recent.length };
    },
    detectSpike(options: { threshold: number; windowMinutes: number }): { detected: boolean; count: number } {
      const { count } = this.getErrorFrequency({ windowMinutes: options.windowMinutes });
      return { detected: count > options.threshold, count };
    },
  };
}

function createPerformanceMetrics() {
  const responseTimes = new Map<string, number[]>();
  const requests = new Map<string, number[]>();

  return {
    recordResponseTime(endpoint: string, timeMs: number) {
      const times = responseTimes.get(endpoint) || [];
      times.push(timeMs);
      responseTimes.set(endpoint, times);
    },
    recordRequest(endpoint: string, timestamp: number) {
      const reqs = requests.get(endpoint) || [];
      reqs.push(timestamp);
      requests.set(endpoint, reqs);
    },
    getEndpointStats(endpoint: string) {
      const times = responseTimes.get(endpoint) || [];
      if (times.length === 0) return { count: 0, avg: 0, min: 0, max: 0 };
      return {
        count: times.length,
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
      };
    },
    getPercentiles(endpoint: string) {
      const times = [...(responseTimes.get(endpoint) || [])].sort((a, b) => a - b);
      if (times.length === 0) return { p50: 0, p95: 0, p99: 0 };
      return {
        p50: times[Math.floor(times.length * 0.5)],
        p95: times[Math.floor(times.length * 0.95)],
        p99: times[Math.floor(times.length * 0.99)],
      };
    },
    getThroughput(endpoint: string, options: { windowSeconds: number }) {
      const reqs = requests.get(endpoint) || [];
      const cutoff = Date.now() - options.windowSeconds * 1000;
      const recent = reqs.filter(t => t >= cutoff);
      return { requestsPerSecond: recent.length / options.windowSeconds };
    },
    getSlowEndpoints(options: { thresholdMs: number }): string[] {
      const slow: string[] = [];
      responseTimes.forEach((times, endpoint) => {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        if (avg > options.thresholdMs) slow.push(endpoint);
      });
      return slow;
    },
  };
}

function createUserAnalytics() {
  const events: Array<{ userId: string; event: string; data: any; timestamp: Date }> = [];
  const sessions = new Map<string, { startTime: Date; endTime?: Date }>();

  return {
    trackEvent(userId: string, event: string, data: any, timestamp?: Date) {
      events.push({ userId, event, data, timestamp: timestamp || new Date() });
    },
    startSession(userId: string) {
      sessions.set(userId, { startTime: new Date() });
    },
    endSession(userId: string) {
      const session = sessions.get(userId);
      if (session) session.endTime = new Date();
    },
    getUserEvents(userId: string) {
      return events.filter(e => e.userId === userId);
    },
    getUserEngagement(userId: string) {
      const userEvents = this.getUserEvents(userId);
      const userSessions = Array.from(sessions.entries()).filter(([id]) => id === userId);
      return {
        totalSessions: userSessions.length,
        totalEvents: userEvents.length,
      };
    },
    getFunnelMetrics(steps: string[]) {
      const result: Record<string, number> = {};
      const usersByStep = new Map<string, Set<string>>();

      steps.forEach(step => {
        const users = new Set(events.filter(e => e.event === step).map(e => e.userId));
        usersByStep.set(step, users);
        result[step] = users.size;
      });

      const firstStep = steps[0];
      const lastStep = steps[steps.length - 1];
      const firstCount = usersByStep.get(firstStep)?.size || 0;
      const lastCount = usersByStep.get(lastStep)?.size || 0;
      result.conversionRate = firstCount > 0 ? lastCount / firstCount : 0;

      return result;
    },
    getDailyActiveUsers(date: Date): number {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const activeUsers = new Set(
        events
          .filter(e => e.timestamp >= dayStart && e.timestamp < dayEnd)
          .map(e => e.userId)
      );
      return activeUsers.size;
    },
  };
}

function createAlertingSystem() {
  const thresholds = new Map<string, { max: number; cooldownMs?: number }>();
  const lastAlerts = new Map<string, number>();
  const channels: Array<(alert: any) => void> = [];

  return {
    onAlert(callback: (alert: any) => void) {
      channels.push(callback);
    },
    addChannel(name: string, callback: (alert: any) => void) {
      channels.push(callback);
    },
    setThreshold(metric: string, config: { max: number; cooldownMs?: number }) {
      thresholds.set(metric, config);
    },
    checkMetric(metric: string, value: number) {
      const threshold = thresholds.get(metric);
      if (!threshold) return;

      if (value > threshold.max) {
        const lastAlert = lastAlerts.get(metric) || 0;
        const cooldown = threshold.cooldownMs || 0;

        if (Date.now() - lastAlert > cooldown) {
          const alert = { metric, value, threshold: threshold.max, timestamp: Date.now() };
          channels.forEach(ch => ch(alert));
          lastAlerts.set(metric, Date.now());
        }
      }
    },
  };
}
