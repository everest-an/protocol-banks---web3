/**
 * Payment Notification Email Endpoint
 * POST /api/notifications/payment - Send payment notification emails
 *
 * Sends receipt to payer and notification to merchant after successful payment.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface PaymentNotificationRequest {
  type: 'payment_received' | 'payment_sent' | 'invoice_paid' | 'payment_link_paid';
  recipientEmail: string;
  merchantName?: string;
  amount: string;
  token: string;
  txHash: string;
  chainId: number;
  payerAddress?: string;
  recipientAddress?: string;
  invoiceId?: string;
  linkId?: string;
  description?: string;
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  137: 'Polygon',
  42161: 'Arbitrum',
  8453: 'Base',
  10: 'Optimism',
  56: 'BNB Chain',
};

const EXPLORER_URLS: Record<number, string> = {
  1: 'https://etherscan.io/tx/',
  137: 'https://polygonscan.com/tx/',
  42161: 'https://arbiscan.io/tx/',
  8453: 'https://basescan.org/tx/',
  10: 'https://optimistic.etherscan.io/tx/',
  56: 'https://bscscan.com/tx/',
};

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function buildPaymentReceivedEmail(data: PaymentNotificationRequest): string {
  const chainName = CHAIN_NAMES[data.chainId] || `Chain ${data.chainId}`;
  const explorerUrl = (EXPLORER_URLS[data.chainId] || 'https://etherscan.io/tx/') + data.txHash;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 560px; margin: 0 auto; padding: 24px; }
          .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #0066FF, #0052CC); padding: 32px 24px; text-align: center; color: white; }
          .header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 600; }
          .header p { margin: 0; opacity: 0.85; font-size: 14px; }
          .amount-box { text-align: center; padding: 32px 24px; border-bottom: 1px solid #eee; }
          .amount { font-size: 36px; font-weight: 700; color: #111; }
          .token { font-size: 16px; color: #666; margin-left: 4px; }
          .status { display: inline-block; background: #DEF7EC; color: #03543F; padding: 4px 12px; border-radius: 99px; font-size: 13px; font-weight: 500; margin-top: 8px; }
          .details { padding: 24px; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { color: #6b7280; }
          .detail-value { color: #111; font-weight: 500; text-align: right; }
          .detail-value a { color: #0066FF; text-decoration: none; }
          .cta { padding: 0 24px 24px; }
          .cta a { display: block; text-align: center; background: #0066FF; color: white; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
          .footer { text-align: center; padding: 24px; font-size: 12px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h1>Payment Received</h1>
              <p>${data.merchantName || 'Protocol Banks'}</p>
            </div>
            <div class="amount-box">
              <div>
                <span class="amount">${data.amount}</span>
                <span class="token">${data.token}</span>
              </div>
              <div class="status">Confirmed</div>
            </div>
            <div class="details">
              ${data.payerAddress ? `
              <div class="detail-row">
                <span class="detail-label">From</span>
                <span class="detail-value">${formatAddress(data.payerAddress)}</span>
              </div>` : ''}
              ${data.recipientAddress ? `
              <div class="detail-row">
                <span class="detail-label">To</span>
                <span class="detail-value">${formatAddress(data.recipientAddress)}</span>
              </div>` : ''}
              <div class="detail-row">
                <span class="detail-label">Network</span>
                <span class="detail-value">${chainName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Transaction</span>
                <span class="detail-value"><a href="${explorerUrl}">${formatAddress(data.txHash)}</a></span>
              </div>
              ${data.description ? `
              <div class="detail-row">
                <span class="detail-label">Description</span>
                <span class="detail-value">${data.description}</span>
              </div>` : ''}
              ${data.invoiceId ? `
              <div class="detail-row">
                <span class="detail-label">Invoice</span>
                <span class="detail-value">${data.invoiceId}</span>
              </div>` : ''}
              <div class="detail-row">
                <span class="detail-label">Date</span>
                <span class="detail-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
            <div class="cta">
              <a href="${explorerUrl}">View on Explorer</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated notification from Protocol Banks.</p>
            <p>Payments are non-custodial and settled directly on-chain.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body: PaymentNotificationRequest = await request.json();

    if (!body.recipientEmail || !body.amount || !body.token || !body.txHash) {
      return NextResponse.json(
        { error: 'recipientEmail, amount, token, and txHash are required' },
        { status: 400 }
      );
    }

    if (!resend) {
      // In development, log instead of sending
      console.log('[Notifications] Would send payment notification:', {
        to: body.recipientEmail,
        type: body.type,
        amount: body.amount,
        token: body.token,
      });

      return NextResponse.json({
        success: true,
        message: 'Email service not configured. Notification logged.',
        mock: true,
      });
    }

    const subjectMap: Record<string, string> = {
      payment_received: `Payment Received: ${body.amount} ${body.token}`,
      payment_sent: `Payment Sent: ${body.amount} ${body.token}`,
      invoice_paid: `Invoice Paid: ${body.amount} ${body.token}`,
      payment_link_paid: `Payment Link Payment: ${body.amount} ${body.token}`,
    };

    const subject = subjectMap[body.type] || `Payment Notification: ${body.amount} ${body.token}`;
    const html = buildPaymentReceivedEmail(body);

    const { data, error } = await resend.emails.send({
      from: 'Protocol Banks <notifications@e.protocolbanks.com>',
      to: [body.recipientEmail],
      subject,
      html,
    });

    if (error) {
      console.error('[Notifications] Email send error:', error);
      return NextResponse.json(
        { error: 'Failed to send notification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      emailId: data?.id,
    });
  } catch (error: any) {
    console.error('[Notifications] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}
