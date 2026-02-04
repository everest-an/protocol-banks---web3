/**
 * Export Service
 * Generates accounting reports and exports in various formats (CSV, Excel, PDF)
 */

import { prisma } from '@/lib/prisma';

// ============================================
// Types
// ============================================

export interface AccountingReport {
  period: {
    start: string;
    end: string;
  };
  summary: {
    total_outgoing: number;
    total_incoming: number;
    net_flow: number;
    transaction_count: number;
    unique_recipients: number;
    unique_senders: number;
  };
  by_token: TokenBreakdown[];
  by_category: CategoryBreakdown[];
  by_vendor: VendorBreakdown[];
  transactions: AccountingTransaction[];
}

export interface TokenBreakdown {
  token: string;
  total_amount: number;
  transaction_count: number;
}

export interface CategoryBreakdown {
  category: string;
  total_amount: number;
  transaction_count: number;
}

export interface VendorBreakdown {
  vendor_name: string;
  vendor_address: string;
  total_amount: number;
  transaction_count: number;
}

export interface AccountingTransaction {
  date: string;
  reference: string;
  type: 'sent' | 'received';
  description: string;
  vendor_name: string;
  category: string;
  debit: number;
  credit: number;
  balance: number;
  token: string;
  usd_value: number;
  tx_hash: string;
  notes: string;
}

export interface ReportParams {
  owner_address: string;
  start_date: string;
  end_date: string;
  include_pending?: boolean;
  categories?: string[];
  tokens?: string[];
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

// ============================================
// Export Service Class
// ============================================

export class ExportService {
  constructor() {}

  // ============================================
  // Report Generation
  // ============================================

  /**
   * Generate accounting report for a period
   */
  async generateAccountingReport(params: ReportParams): Promise<AccountingReport> {
    const { owner_address, start_date, end_date, include_pending } = params;

    const whereBase = {
      created_at: {
        gte: new Date(start_date),
        lte: new Date(end_date)
      }
    };
    
    const statusFilter = include_pending ? {} : { status: 'completed' };

    // Fetch sent payments
    const sentPayments = await prisma.payment.findMany({
      where: {
        from_address: owner_address,
        ...whereBase,
        ...statusFilter
      },
      include: {
        vendor: {
          select: { name: true, category: true }
        }
      }
    });

    // Fetch received payments
    const receivedPayments = await prisma.payment.findMany({
      where: {
        to_address: owner_address,
        ...whereBase,
        ...statusFilter
      },
      include: {
        vendor: {
          select: { name: true, category: true }
        }
      }
    });

    // Map to structure compatible with logic below (adding timestamp alias)
    const mapPayment = (p: any) => ({
      ...p,
      timestamp: p.created_at.toISOString(),
      amount_usd: p.amount_usd || 0, // Ensure numeric safety
      amount: p.amount || 0
    });

    // Process transactions
    const sent = (sentPayments || []).map(mapPayment);
    const received = (receivedPayments || []).map(mapPayment);

    // Calculate summary
    const total_outgoing = sent.reduce((sum: number, p: any) => sum + parseFloat(p.amount_usd || p.amount || 0), 0);
    const total_incoming = received.reduce((sum: number, p: any) => sum + parseFloat(p.amount_usd || p.amount || 0), 0);
    const uniqueRecipients = new Set(sent.map((p: any) => p.to_address));
    const uniqueSenders = new Set(received.map((p: any) => p.from_address));

    // Token breakdown
    const tokenMap = new Map<string, { total: number; count: number }>();
    [...sent, ...received].forEach((p: any) => {
      const token = p.token_symbol || p.token || 'UNKNOWN';
      const existing = tokenMap.get(token) || { total: 0, count: 0 };
      tokenMap.set(token, {
        total: existing.total + parseFloat(p.amount_usd || p.amount || 0),
        count: existing.count + 1,
      });
    });

    // Category breakdown
    const categoryMap = new Map<string, { total: number; count: number }>();
    sent.forEach((p: any) => {
      const category = p.vendor?.category || 'Uncategorized';
      const existing = categoryMap.get(category) || { total: 0, count: 0 };
      categoryMap.set(category, {
        total: existing.total + parseFloat(p.amount_usd || p.amount || 0),
        count: existing.count + 1,
      });
    });

    // Vendor breakdown
    const vendorMap = new Map<string, { name: string; address: string; total: number; count: number }>();
    sent.forEach((p: any) => {
      const address = p.to_address;
      const existing = vendorMap.get(address) || {
        name: p.vendor?.name || 'Unknown',
        address,
        total: 0,
        count: 0,
      };
      vendorMap.set(address, {
        ...existing,
        total: existing.total + parseFloat(p.amount_usd || p.amount || 0),
        count: existing.count + 1,
      });
    });

    // Build transaction list
    let runningBalance = 0;
    const allTransactions = [
      ...sent.map((p: any) => ({ ...p, type: 'sent' as const })),
      ...received.map((p: any) => ({ ...p, type: 'received' as const })),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const transactions: AccountingTransaction[] = allTransactions.map((p: any) => {
      const amount = parseFloat(p.amount_usd || p.amount || 0);
      const debit = p.type === 'sent' ? amount : 0;
      const credit = p.type === 'received' ? amount : 0;
      runningBalance += credit - debit;

      return {
        date: p.timestamp,
        reference: p.id,
        type: p.type,
        description: p.type === 'sent'
          ? `Payment to ${p.vendor?.name || p.to_address.slice(0, 10)}...`
          : `Received from ${p.from_address.slice(0, 10)}...`,
        vendor_name: p.vendor?.name || '',
        category: p.vendor?.category || 'Uncategorized',
        debit,
        credit,
        balance: runningBalance,
        token: p.token_symbol || p.token || '',
        usd_value: amount,
        tx_hash: p.tx_hash || '',
        notes: p.notes || '',
      };
    });

    return {
      period: {
        start: start_date,
        end: end_date,
      },
      summary: {
        total_outgoing,
        total_incoming,
        net_flow: total_incoming - total_outgoing,
        transaction_count: sent.length + received.length,
        unique_recipients: uniqueRecipients.size,
        unique_senders: uniqueSenders.size,
      },
      by_token: Array.from(tokenMap.entries()).map(([token, data]) => ({
        token,
        total_amount: data.total,
        transaction_count: data.count,
      })),
      by_category: Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        total_amount: data.total,
        transaction_count: data.count,
      })),
      by_vendor: Array.from(vendorMap.values()).map((v) => ({
        vendor_name: v.name,
        vendor_address: v.address,
        total_amount: v.total,
        transaction_count: v.count,
      })),
      transactions,
    };
  }

  // ============================================
  // Export Formats
  // ============================================

  /**
   * Export report to CSV
   */
  exportToCSV(report: AccountingReport): string {
    const headers = [
      'Date',
      'Reference',
      'Type',
      'Description',
      'Vendor',
      'Category',
      'Debit',
      'Credit',
      'Balance',
      'Token',
      'USD Value',
      'TX Hash',
      'Notes',
    ];

    const rows = report.transactions.map((t) => [
      new Date(t.date).toISOString().split('T')[0],
      t.reference,
      t.type,
      t.description,
      t.vendor_name,
      t.category,
      t.debit.toFixed(2),
      t.credit.toFixed(2),
      t.balance.toFixed(2),
      t.token,
      t.usd_value.toFixed(2),
      t.tx_hash,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    // Add summary section
    const summaryRows = [
      [],
      ['Summary'],
      ['Period', `${report.period.start} to ${report.period.end}`],
      ['Total Outgoing', report.summary.total_outgoing.toFixed(2)],
      ['Total Incoming', report.summary.total_incoming.toFixed(2)],
      ['Net Flow', report.summary.net_flow.toFixed(2)],
      ['Transaction Count', report.summary.transaction_count.toString()],
      ['Unique Recipients', report.summary.unique_recipients.toString()],
    ];

    const allRows = [headers, ...rows, ...summaryRows];
    return allRows.map((row) => row.join(',')).join('\n');
  }

  /**
   * Export report to Excel format (XLSX)
   * Returns a Blob that can be downloaded
   */
  async exportToExcel(report: AccountingReport): Promise<Blob> {
    // Use simple XLSX generation without external library
    // This creates a basic Excel XML format
    const xml = this.generateExcelXML(report);
    return new Blob([xml], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  private generateExcelXML(report: AccountingReport): string {
    const escapeXml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const rows = report.transactions.map(
      (t) => `
      <Row>
        <Cell><Data ss:Type="String">${escapeXml(new Date(t.date).toISOString().split('T')[0])}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(t.reference)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(t.type)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(t.description)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(t.vendor_name)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(t.category)}</Data></Cell>
        <Cell><Data ss:Type="Number">${t.debit.toFixed(2)}</Data></Cell>
        <Cell><Data ss:Type="Number">${t.credit.toFixed(2)}</Data></Cell>
        <Cell><Data ss:Type="Number">${t.balance.toFixed(2)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(t.token)}</Data></Cell>
        <Cell><Data ss:Type="Number">${t.usd_value.toFixed(2)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(t.tx_hash)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(t.notes)}</Data></Cell>
      </Row>`
    );

    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Transactions">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Date</Data></Cell>
    <Cell><Data ss:Type="String">Reference</Data></Cell>
    <Cell><Data ss:Type="String">Type</Data></Cell>
    <Cell><Data ss:Type="String">Description</Data></Cell>
    <Cell><Data ss:Type="String">Vendor</Data></Cell>
    <Cell><Data ss:Type="String">Category</Data></Cell>
    <Cell><Data ss:Type="String">Debit</Data></Cell>
    <Cell><Data ss:Type="String">Credit</Data></Cell>
    <Cell><Data ss:Type="String">Balance</Data></Cell>
    <Cell><Data ss:Type="String">Token</Data></Cell>
    <Cell><Data ss:Type="String">USD Value</Data></Cell>
    <Cell><Data ss:Type="String">TX Hash</Data></Cell>
    <Cell><Data ss:Type="String">Notes</Data></Cell>
   </Row>
   ${rows.join('\n')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Summary">
  <Table>
   <Row><Cell><Data ss:Type="String">Report Period</Data></Cell><Cell><Data ss:Type="String">${report.period.start} to ${report.period.end}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Total Outgoing</Data></Cell><Cell><Data ss:Type="Number">${report.summary.total_outgoing.toFixed(2)}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Total Incoming</Data></Cell><Cell><Data ss:Type="Number">${report.summary.total_incoming.toFixed(2)}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Net Flow</Data></Cell><Cell><Data ss:Type="Number">${report.summary.net_flow.toFixed(2)}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Transaction Count</Data></Cell><Cell><Data ss:Type="Number">${report.summary.transaction_count}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Unique Recipients</Data></Cell><Cell><Data ss:Type="Number">${report.summary.unique_recipients}</Data></Cell></Row>
  </Table>
 </Worksheet>
</Workbook>`;
  }

  /**
   * Generate quick summary for dashboard
   */
  async getQuickSummary(
    ownerAddress: string,
    days: number = 30
  ): Promise<{
    total_outgoing: number;
    total_incoming: number;
    transaction_count: number;
    period: string;
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const report = await this.generateAccountingReport({
      owner_address: ownerAddress,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    });

    return {
      total_outgoing: report.summary.total_outgoing,
      total_incoming: report.summary.total_incoming,
      transaction_count: report.summary.transaction_count,
      period: `Last ${days} days`,
    };
  }
}

// Export singleton instance
export const exportService = new ExportService();
