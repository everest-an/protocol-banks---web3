/**
 * Health Check Endpoint
 * GET /api/health - Basic health status
 */

import { NextResponse } from 'next/server';
import { HealthMonitorService } from '@/lib/services/health-monitor-service';

const healthMonitor = new HealthMonitorService();

/**
 * GET /api/health
 * Returns basic health status
 */
export async function GET() {
  try {
    const health = await healthMonitor.basicHealth();
    
    return NextResponse.json(health, {
      status: health.status === 'ok' ? 200 : 503,
    });
  } catch (error: any) {
    console.error('[Health] Check error:', error);
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        message: error.message || 'Health check failed',
      },
      { status: 503 }
    );
  }
}
