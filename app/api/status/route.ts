/**
 * Detailed Status Endpoint
 * GET /api/status - Detailed component status with version
 */

import { NextResponse } from 'next/server';
import { HealthMonitorService } from '@/lib/services/health-monitor-service';

const healthMonitor = new HealthMonitorService();

/**
 * GET /api/status
 * Returns detailed health status of all components
 */
export async function GET() {
  try {
    const status = await healthMonitor.detailedHealth();
    
    const httpStatus = status.status === 'healthy' ? 200 
      : status.status === 'degraded' ? 200 
      : 503;
    
    return NextResponse.json(status, { status: httpStatus });
  } catch (error: any) {
    console.error('[Status] Check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        uptime_seconds: 0,
        components: [],
        error: error.message || 'Status check failed',
      },
      { status: 503 }
    );
  }
}
