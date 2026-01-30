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
 * Can accept either a BatchReport object or an array of items (for backward compatibility)
 */
export function generateBatchCsvReport(report: BatchReport | BatchReportItem[]): string {
  // Handle array input (backward compatibility)
  let items: BatchReportItem[]
  let summary: BatchReport['summary'] | null = null

  if (Array.isArray(report)) {
    // Convert array to items with timestamp
    items = report.map(item => ({
      ...item,
      timestamp: item.timestamp || Date.now(),
    }))
  } else if (report && report.items && Array.isArray(report.items)) {
    // Valid BatchReport object
    items = report.items
    summary = report.summary
  } else {
    console.error('[ReportGenerator] Invalid report structure:', report)
    return ''
  }

  const headers = [
    'Recipient',
    'Amount',
    'Token',
    'Status',
    'Transaction Hash',
    'Error',
    'Timestamp',
  ]

  const rows = items.map(item => [
    item.recipient,
    item.amount.toString(),
    item.token,
    item.status,
    item.transactionHash || '',
    item.error || '',
    new Date(item.timestamp).toISOString(),
  ])
  
  // Add summary row (if available)
  if (summary) {
    rows.push([])
    rows.push(['Summary'])
    rows.push(['Total Items', summary.total.toString()])
    rows.push(['Successful', summary.successful.toString()])
    rows.push(['Failed', summary.failed.toString()])
    rows.push(['Pending', summary.pending.toString()])
    rows.push(['Total Amount', summary.totalAmount.toString()])
    rows.push(['Successful Amount', summary.successfulAmount.toString()])
  } else {
    // Calculate summary from items
    const successful = items.filter(i => i.status === 'success')
    const failed = items.filter(i => i.status === 'failed')
    const pending = items.filter(i => i.status === 'pending')

    rows.push([])
    rows.push(['Summary'])
    rows.push(['Total Items', items.length.toString()])
    rows.push(['Successful', successful.length.toString()])
    rows.push(['Failed', failed.length.toString()])
    rows.push(['Pending', pending.length.toString()])
    rows.push(['Total Amount', items.reduce((sum, i) => sum + i.amount, 0).toString()])
    rows.push(['Successful Amount', successful.reduce((sum, i) => sum + i.amount, 0).toString()])
  }
  
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
