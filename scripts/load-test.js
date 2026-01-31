/**
 * Load Testing Configuration for Protocol Banks
 * Using k6 (https://k6.io)
 * 
 * Run: k6 run scripts/load-test.js
 * With env: k6 run -e BASE_URL=https://your-api.com scripts/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const paymentLatency = new Trend('payment_latency');
const batchLatency = new Trend('batch_latency');

// Test configuration
export const options = {
  scenarios: {
    // Scenario 1: Smoke test (basic health check)
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      startTime: '0s',
      tags: { scenario: 'smoke' },
    },
    
    // Scenario 2: Load test (normal load)
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // Ramp up to 50 users
        { duration: '3m', target: 50 },   // Stay at 50 users
        { duration: '1m', target: 100 },  // Ramp up to 100 users
        { duration: '3m', target: 100 },  // Stay at 100 users
        { duration: '1m', target: 0 },    // Ramp down
      ],
      startTime: '30s',
      tags: { scenario: 'load' },
    },
    
    // Scenario 3: Stress test (find breaking point)
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 500 },
        { duration: '5m', target: 500 },
        { duration: '2m', target: 1000 },
        { duration: '5m', target: 1000 },
        { duration: '2m', target: 0 },
      ],
      startTime: '10m',
      tags: { scenario: 'stress' },
    },
    
    // Scenario 4: Spike test (sudden traffic spike)
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '10s', target: 1000 },
        { duration: '3m', target: 1000 },
        { duration: '10s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '10s', target: 0 },
      ],
      startTime: '25m',
      tags: { scenario: 'spike' },
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'],                  // Error rate < 1%
    errors: ['rate<0.05'],                           // Custom error rate < 5%
    payment_latency: ['p(95)<2000'],                 // Payment 95% < 2s
    batch_latency: ['p(95)<5000'],                   // Batch 95% < 5s
  },
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test-api-key';

// Test data
const testWallets = [
  '0x742d35Cc6634C0532925a3b844Bc9e7595f1E9A1',
  '0x8Ba1f109551bD432803012645Ac136ddd64DBA72',
  '0xdD870fA1b7C4700F2BD7f44238821C26f7392148',
];

const testRecipients = [
  { address: '0x1234567890123456789012345678901234567890', amount: '10' },
  { address: '0x2345678901234567890123456789012345678901', amount: '20' },
  { address: '0x3456789012345678901234567890123456789012', amount: '30' },
];

// Headers
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };
}

// Helper: Random wallet
function randomWallet() {
  return testWallets[Math.floor(Math.random() * testWallets.length)];
}

// ============================================
// Test Groups
// ============================================

export default function () {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, {
      'health check status 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  group('Balance Query', () => {
    const wallet = randomWallet();
    const res = http.get(`${BASE_URL}/api/balance?address=${wallet}`, {
      headers: getHeaders(),
    });
    
    check(res, {
      'balance status 200': (r) => r.status === 200,
      'balance has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(res.status !== 200);
  });

  group('Single Payment', () => {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/payout`,
      JSON.stringify({
        recipient: testRecipients[0].address,
        amount: testRecipients[0].amount,
        token: 'USDC',
        chain: 'polygon',
      }),
      { headers: getHeaders() }
    );
    
    paymentLatency.add(Date.now() - start);
    
    check(res, {
      'payment status 200 or 201': (r) => r.status === 200 || r.status === 201,
      'payment accepted': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true || body.status === 'pending';
        } catch {
          return false;
        }
      },
    });
    errorRate.add(res.status >= 400);
  });

  group('Batch Payment', () => {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/payout/batch`,
      JSON.stringify({
        recipients: testRecipients,
        token: 'USDC',
        chain: 'polygon',
      }),
      { headers: getHeaders() }
    );
    
    batchLatency.add(Date.now() - start);
    
    check(res, {
      'batch status 200 or 201': (r) => r.status === 200 || r.status === 201,
      'batch accepted': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true || body.batchId;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(res.status >= 400);
  });

  group('Subscription List', () => {
    const wallet = randomWallet();
    const res = http.get(`${BASE_URL}/api/subscriptions?owner=${wallet}`, {
      headers: getHeaders(),
    });
    
    check(res, {
      'subscriptions status 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  group('Vendor List', () => {
    const wallet = randomWallet();
    const res = http.get(`${BASE_URL}/api/vendors?wallet=${wallet}`, {
      headers: getHeaders(),
    });
    
    check(res, {
      'vendors status 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  // Pace the requests
  sleep(Math.random() * 2 + 1); // 1-3 seconds between iterations
}

// ============================================
// Lifecycle Hooks
// ============================================

export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  
  // Verify API is reachable
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error(`API not reachable: ${res.status}`);
  }
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration.toFixed(2)} seconds`);
}

// ============================================
// Summary Handler
// ============================================

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    duration: data.state.testRunDurationMs,
    vus: data.metrics.vus?.values?.value || 0,
    requests: data.metrics.http_reqs?.values?.count || 0,
    failed: data.metrics.http_req_failed?.values?.rate || 0,
    latency: {
      avg: data.metrics.http_req_duration?.values?.avg || 0,
      p95: data.metrics.http_req_duration?.values['p(95)'] || 0,
      p99: data.metrics.http_req_duration?.values['p(99)'] || 0,
    },
    customMetrics: {
      errorRate: data.metrics.errors?.values?.rate || 0,
      paymentLatencyP95: data.metrics.payment_latency?.values['p(95)'] || 0,
      batchLatencyP95: data.metrics.batch_latency?.values['p(95)'] || 0,
    },
  };

  return {
    'scripts/load-test-results.json': JSON.stringify(summary, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, opts) {
  return `
================================================================================
                           LOAD TEST SUMMARY
================================================================================
Duration:        ${(data.state.testRunDurationMs / 1000).toFixed(2)}s
Virtual Users:   ${data.metrics.vus?.values?.value || 0} (max)
Total Requests:  ${data.metrics.http_reqs?.values?.count || 0}
Failed Requests: ${((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%

Latency:
  Average:       ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms
  P95:           ${(data.metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms
  P99:           ${(data.metrics.http_req_duration?.values['p(99)'] || 0).toFixed(2)}ms

Custom Metrics:
  Error Rate:    ${((data.metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%
  Payment P95:   ${(data.metrics.payment_latency?.values['p(95)'] || 0).toFixed(2)}ms
  Batch P95:     ${(data.metrics.batch_latency?.values['p(95)'] || 0).toFixed(2)}ms

Thresholds:
  http_req_duration p(95)<500ms: ${data.metrics.http_req_duration?.values['p(95)'] < 500 ? '✅ PASS' : '❌ FAIL'}
  http_req_failed rate<1%:       ${(data.metrics.http_req_failed?.values?.rate || 0) < 0.01 ? '✅ PASS' : '❌ FAIL'}
  errors rate<5%:                ${(data.metrics.errors?.values?.rate || 0) < 0.05 ? '✅ PASS' : '❌ FAIL'}
================================================================================
`;
}
