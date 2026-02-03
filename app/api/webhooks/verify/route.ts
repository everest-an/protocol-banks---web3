/**
 * Webhook Signature Verification Endpoint
 * POST /api/webhooks/verify - Verify an incoming webhook signature
 *
 * This endpoint allows merchants to verify webhook signatures
 * to confirm that events originated from Protocol Banks.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/services/webhook-service';

/**
 * POST /api/webhooks/verify
 * Verify a webhook payload signature
 *
 * Body: { payload: string, signature: string, secret: string }
 * OR use headers: X-Webhook-Signature, X-Webhook-Timestamp
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Mode 1: JSON body with explicit fields (for testing)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { payload, signature, secret } = body;

      if (!payload || !signature || !secret) {
        return NextResponse.json(
          {
            error: 'Bad Request',
            message: 'payload, signature, and secret are required',
          },
          { status: 400 }
        );
      }

      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const isValid = verifyWebhookSignature(payloadStr, signature, secret);

      return NextResponse.json({
        valid: isValid,
        message: isValid
          ? 'Signature is valid'
          : 'Signature verification failed. The payload may have been tampered with or the secret is incorrect.',
      });
    }

    // Mode 2: Raw body with signature in headers (simulating real webhook receipt)
    const signature = request.headers.get('x-webhook-signature');
    const secret = request.headers.get('x-webhook-secret');

    if (!signature || !secret) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'X-Webhook-Signature and X-Webhook-Secret headers are required',
        },
        { status: 400 }
      );
    }

    const rawBody = await request.text();
    const isValid = verifyWebhookSignature(rawBody, signature, secret);

    return NextResponse.json({
      valid: isValid,
      message: isValid
        ? 'Signature is valid'
        : 'Signature verification failed',
    });
  } catch (error: any) {
    console.error('[Webhook Verify] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Verification failed' },
      { status: 500 }
    );
  }
}
