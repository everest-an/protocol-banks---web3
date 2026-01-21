/**
 * Report Generator Service
 * Generates CSV and other reports for batch operations
 */

export interface BatchReportItem {
  recipient: string
  amount: number
  token: string
  status: 'success' | 'failed' | 'pending'
  transactionHash?: string
  error?: string
  timestamp: number
}

export interface BatchReport {
  batchId: string
  createdAt: number
  completedAt?: number
  items: BatchReportItem[]
  summary: {
    total: number
    successful: number
    failed: number
    pending: number
    totalAmount: number
    successfulAmount: number
  }
}

/**
 * Generate CSV string from batch report
 */
export function generateBatchCsvReport(report: BatchReport): string {
  const headers = [
    'Recipient',
    'Amount',
    'Token',
    'Status',
    'Transaction Hash',
    'Error',
    'Timestamp',
  ]
  
  const rows = report.items.map(item => [
    item.recipient,
    item.amount.toString(),
    item.token,
    item.status,
    item.transactionHash || '',
    item.error || '',
    new Date(item.timestamp).toISOString(),
  ])
  
  // Add summary row
  rows.push([])
  rows.push(['Summary'])
  rows.push(['Total Items', report.summary.total.toString()])
  rows.push(['Successful', report.summary.successful.toString()])
  rows.push(['Failed', report.summary.failed.toString()])
  rows.push(['Pending', report.summary.pending.toString()])
  rows.push(['Total Amount', report.summary.totalAmount.toString()])
  rows.push(['Successful Amount', report.summary.successfulAmount.toString()])
  
  // Convert to CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n')
  
  return csvContent
}

/**
 * Create batch report from items
 */
export function createBatchReport(
  batchId: string,
  items: BatchReportItem[]
): BatchReport {
  const successful = items.filter(i => i.status === 'success')
  const failed = items.filter(i => i.status === 'failed')
  const pending = items.filter(i => i.status === 'pending')
  
  return {
    batchId,
    createdAt: Date.now(),
    items,
    summary: {
      total: items.length,
      successful: successful.length,
      failed: failed.length,
      pending: pending.length,
      totalAmount: items.reduce((sum, i) => sum + i.amount, 0),
      successfulAmount: successful.reduce((sum, i) => sum + i.amount, 0),
    },
  }
}

/**
 * Download CSV file in browser
 */
export function downloadCsvReport(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

/**
 * Generate filename for report
 */
export function generateReportFilename(batchId: string, type: string = 'batch'): string {
  const date = new Date().toISOString().split('T')[0]
  return `protocol-banks-${type}-${batchId}-${date}.csv`
}

/**
 * Format report for email
 */
export function formatReportForEmail(report: BatchReport): string {
  return `
Batch Payment Report
====================

Batch ID: ${report.batchId}
Created: ${new Date(report.createdAt).toLocaleString()}
${report.completedAt ? `Completed: ${new Date(report.completedAt).toLocaleString()}` : ''}

Summary
-------
Total Items: ${report.summary.total}
Successful: ${report.summary.successful}
Failed: ${report.summary.failed}
Pending: ${report.summary.pending}

Total Amount: $${report.summary.totalAmount.toFixed(2)}
Successful Amount: $${report.summary.successfulAmount.toFixed(2)}

${report.summary.failed > 0 ? `
Failed Transactions
-------------------
${report.items
  .filter(i => i.status === 'failed')
  .map(i => `- ${i.recipient}: ${i.error || 'Unknown error'}`)
  .join('\n')}
` : ''}
`.trim()
}
