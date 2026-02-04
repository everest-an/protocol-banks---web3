/**
 * Invoice Export Endpoint
 * GET /api/invoice/export?id=<invoiceId>&sig=<signature>&format=html
 *
 * Generates a printable invoice HTML document that can be saved as PDF
 * via browser print (Ctrl+P → Save as PDF).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function generateInvoiceHTML(invoice: any): string {
  const statusColors: Record<string, string> = {
    paid: '#059669',
    pending: '#d97706',
    expired: '#dc2626',
    cancelled: '#6b7280',
  };

  const statusColor = statusColors[invoice.status] || '#6b7280';
  const createdDate = new Date(invoice.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const expiresDate = invoice.expires_at
    ? new Date(invoice.expires_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${invoice.invoice_id}</title>
        <style>
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .no-print { display: none !important; }
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif; color: #111; background: white; }
          .page { max-width: 800px; margin: 0 auto; padding: 48px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
          .logo { font-size: 24px; font-weight: 700; color: #0066FF; }
          .logo span { color: #111; }
          .invoice-meta { text-align: right; }
          .invoice-number { font-size: 14px; color: #6b7280; margin-bottom: 4px; }
          .invoice-id { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 13px; font-weight: 500; color: white; background: ${statusColor}; }
          .parties { display: flex; gap: 48px; margin-bottom: 48px; }
          .party { flex: 1; }
          .party-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 8px; font-weight: 600; }
          .party-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
          .party-detail { font-size: 14px; color: #374151; line-height: 1.5; }
          .party-address { font-family: monospace; font-size: 13px; color: #6b7280; word-break: break-all; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
          thead th { text-align: left; padding: 12px 16px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; font-weight: 600; }
          thead th:last-child { text-align: right; }
          tbody td { padding: 16px; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
          tbody td:last-child { text-align: right; font-weight: 600; }
          .totals { display: flex; justify-content: flex-end; margin-bottom: 48px; }
          .totals-table { width: 280px; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
          .totals-row.total { font-size: 18px; font-weight: 700; border-top: 2px solid #111; padding-top: 12px; margin-top: 8px; }
          .fiat-note { color: #6b7280; font-size: 13px; }
          .payment-info { background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 32px; }
          .payment-info h3 { font-size: 14px; font-weight: 600; margin-bottom: 16px; }
          .payment-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
          .payment-label { color: #6b7280; }
          .payment-value { font-weight: 500; font-family: monospace; font-size: 13px; }
          .payment-value a { color: #0066FF; text-decoration: none; }
          .footer { border-top: 1px solid #e5e7eb; padding-top: 24px; text-align: center; }
          .footer p { font-size: 12px; color: #9ca3af; line-height: 1.6; }
          .print-btn { display: block; margin: 16px auto; padding: 10px 24px; background: #0066FF; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
          .print-btn:hover { background: #0052CC; }
        </style>
      </head>
      <body>
        <div class="page">
          <!-- Print Button -->
          <button class="print-btn no-print" onclick="window.print()">
            Download as PDF (Print)
          </button>

          <!-- Header -->
          <div class="header">
            <div>
              <div class="logo">Protocol <span>Banks</span></div>
              <p style="font-size: 13px; color: #6b7280; margin-top: 4px;">Crypto Payment Infrastructure</p>
            </div>
            <div class="invoice-meta">
              <div class="invoice-number">INVOICE</div>
              <div class="invoice-id">${invoice.invoice_id}</div>
              <span class="status">${invoice.status.toUpperCase()}</span>
            </div>
          </div>

          <!-- Parties -->
          <div class="parties">
            <div class="party">
              <div class="party-label">From</div>
              <div class="party-name">${invoice.merchant_name || 'Merchant'}</div>
              ${invoice.recipient_address ? `<div class="party-address">${invoice.recipient_address}</div>` : ''}
            </div>
            <div class="party">
              <div class="party-label">Bill To</div>
              <div class="party-name">${invoice.metadata?.customerName || 'Customer'}</div>
              ${invoice.metadata?.customerEmail ? `<div class="party-detail">${invoice.metadata.customerEmail}</div>` : ''}
              ${invoice.paid_by ? `<div class="party-address">${invoice.paid_by}</div>` : ''}
            </div>
            <div class="party">
              <div class="party-label">Dates</div>
              <div class="party-detail">Issued: ${createdDate}</div>
              ${expiresDate ? `<div class="party-detail">Due: ${expiresDate}</div>` : ''}
              ${invoice.paid_at ? `<div class="party-detail" style="color: #059669;">Paid: ${new Date(invoice.paid_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>` : ''}
            </div>
          </div>

          <!-- Line Items -->
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Token</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${invoice.description || 'Payment'}</td>
                <td>${invoice.token || 'USDC'}</td>
                <td>${invoice.amount} ${invoice.token || 'USDC'}</td>
              </tr>
            </tbody>
          </table>

          <!-- Totals -->
          <div class="totals">
            <div class="totals-table">
              <div class="totals-row">
                <span>Subtotal</span>
                <span>${invoice.amount} ${invoice.token || 'USDC'}</span>
              </div>
              <div class="totals-row">
                <span>Network Fee</span>
                <span>Paid by sender</span>
              </div>
              <div class="totals-row total">
                <span>Total</span>
                <span>${invoice.amount} ${invoice.token || 'USDC'}</span>
              </div>
              ${invoice.amount_fiat ? `
              <div class="totals-row fiat-note">
                <span>Fiat Equivalent</span>
                <span>${invoice.amount_fiat} ${invoice.fiat_currency || 'USD'}</span>
              </div>` : ''}
            </div>
          </div>

          <!-- Payment Info -->
          ${invoice.tx_hash ? `
          <div class="payment-info">
            <h3>Payment Details</h3>
            <div class="payment-row">
              <span class="payment-label">Transaction Hash</span>
              <span class="payment-value">${invoice.tx_hash}</span>
            </div>
            <div class="payment-row">
              <span class="payment-label">Network</span>
              <span class="payment-value">${invoice.chain_id ? `Chain ${invoice.chain_id}` : 'Base'}</span>
            </div>
            ${invoice.paid_by ? `
            <div class="payment-row">
              <span class="payment-label">Paid By</span>
              <span class="payment-value">${invoice.paid_by}</span>
            </div>` : ''}
          </div>` : ''}

          <!-- Footer -->
          <div class="footer">
            <p>This invoice was generated by Protocol Banks.</p>
            <p>All payments are non-custodial and settled directly on the blockchain.</p>
            <p style="margin-top: 8px;">protocol-banks.vercel.app</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('id');
    const signature = searchParams.get('sig');

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    // Try to fetch from database
    let invoice: any = null;

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('invoice_id', invoiceId)
        .single();

      if (!error && data) {
        invoice = data;
      }
    } catch {
      // Fall through to mock
    }

    // Mock invoice for development/demo
    if (!invoice) {
      invoice = {
        invoice_id: invoiceId,
        amount: '100.00',
        token: 'USDC',
        description: 'Payment for services',
        merchant_name: 'Protocol Banks Test',
        recipient_address: '0x1234567890abcdef1234567890abcdef12345678',
        status: 'pending',
        amount_fiat: '100.00',
        fiat_currency: 'USD',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          customerName: 'Customer',
          customerEmail: 'customer@example.com',
        },
      };
    }

    const html = generateInvoiceHTML(invoice);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('[Invoice Export] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export invoice' },
      { status: 500 }
    );
  }
}
