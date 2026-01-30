"use client"

/**
 * PDF Payment Report Component
 * Generates professional PDF reports using @react-pdf/renderer
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer"
import type { PDFReportData } from "@/lib/services/report-service"

// Register fonts for better rendering
Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2",
      fontWeight: 600,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2",
      fontWeight: 700,
    },
  ],
})

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Inter",
    fontSize: 10,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 30,
  },
  logo: {
    fontSize: 24,
    fontWeight: 700,
    color: "#0066ff",
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#666",
    marginBottom: 20,
  },
  companyInfo: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 4,
  },
  companyName: {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 4,
  },
  companyAddress: {
    fontSize: 10,
    color: "#666",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 16,
  },
  summarySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 12,
    color: "#333",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: "45%",
    padding: 12,
    backgroundColor: "#f0f7ff",
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: "#666",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 600,
    color: "#0066ff",
  },
  tableSection: {
    marginBottom: 24,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    padding: 8,
    borderRadius: 4,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 600,
    color: "#333",
  },
  tableRow: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tableCell: {
    fontSize: 9,
    color: "#444",
  },
  colDate: { width: "12%" },
  colRecipient: { width: "30%" },
  colAmount: { width: "15%", textAlign: "right" },
  colToken: { width: "8%" },
  colStatus: { width: "10%" },
  colTxHash: { width: "25%" },
  statusCompleted: {
    color: "#22c55e",
  },
  statusPending: {
    color: "#f59e0b",
  },
  statusFailed: {
    color: "#ef4444",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
  },
  footerDivider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginBottom: 12,
  },
  footerText: {
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
  footerLink: {
    fontSize: 8,
    color: "#0066ff",
    textAlign: "center",
    marginTop: 4,
  },
  pageNumber: {
    position: "absolute",
    bottom: 30,
    right: 40,
    fontSize: 8,
    color: "#999",
  },
})

// Utility functions
function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function truncateHash(hash: string): string {
  if (!hash || hash.length < 10) return hash || "-"
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

function getStatusStyle(status: string) {
  switch (status?.toLowerCase()) {
    case "completed":
    case "success":
      return styles.statusCompleted
    case "pending":
      return styles.statusPending
    case "failed":
      return styles.statusFailed
    default:
      return {}
  }
}

// ============================================
// PDF Document Component
// ============================================

interface PaymentReportPDFProps {
  data: PDFReportData
}

export function PaymentReportPDF({ data }: PaymentReportPDFProps) {
  const { summary, transactions, pdfOptions, generatedAt } = data
  const maxTransactionsPerPage = 20
  const pages = Math.ceil(transactions.length / maxTransactionsPerPage)

  return (
    <Document>
      {/* First Page - Summary */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Protocol Banks</Text>
          <Text style={styles.title}>Payment Report</Text>
          <Text style={styles.subtitle}>
            {summary.dateRange.start} to {summary.dateRange.end}
          </Text>

          {/* Company Info */}
          {pdfOptions?.companyName && (
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{pdfOptions.companyName}</Text>
              {pdfOptions.companyAddress && (
                <Text style={styles.companyAddress}>{pdfOptions.companyAddress}</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Payments</Text>
              <Text style={styles.summaryValue}>{summary.totalTransactions}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Amount</Text>
              <Text style={styles.summaryValue}>
                {formatNumber(summary.totalAmount)} {summary.token}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Unique Recipients</Text>
              <Text style={styles.summaryValue}>{summary.uniqueRecipients}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Average Payment</Text>
              <Text style={styles.summaryValue}>
                {formatNumber(
                  summary.totalTransactions > 0
                    ? summary.totalAmount / summary.totalTransactions
                    : 0
                )}{" "}
                {summary.token}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Transactions Table - First Page */}
        <View style={styles.tableSection}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
              <Text style={[styles.tableHeaderCell, styles.colRecipient]}>Recipient</Text>
              <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
              <Text style={[styles.tableHeaderCell, styles.colToken]}>Token</Text>
              <Text style={[styles.tableHeaderCell, styles.colStatus]}>Status</Text>
              <Text style={[styles.tableHeaderCell, styles.colTxHash]}>Tx Hash</Text>
            </View>

            {/* Table Rows - First Page */}
            {transactions.slice(0, maxTransactionsPerPage).map((tx, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colDate]}>{tx.date}</Text>
                <Text style={[styles.tableCell, styles.colRecipient]}>
                  {tx.recipientName || truncateAddress(tx.recipient)}
                </Text>
                <Text style={[styles.tableCell, styles.colAmount]}>{formatNumber(parseFloat(tx.amount))}</Text>
                <Text style={[styles.tableCell, styles.colToken]}>{tx.token}</Text>
                <Text style={[styles.tableCell, styles.colStatus, getStatusStyle(tx.status)]}>
                  {tx.status}
                </Text>
                <Text style={[styles.tableCell, styles.colTxHash]}>{truncateHash(tx.txHash)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Text style={styles.footerText}>
            Generated by Protocol Banks on {new Date(generatedAt).toLocaleDateString()}
          </Text>
          <Text style={styles.footerLink}>
            All transactions are verifiable on-chain
          </Text>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>

      {/* Additional Pages for more transactions */}
      {Array.from({ length: pages - 1 }, (_, pageIndex) => {
        const startIndex = (pageIndex + 1) * maxTransactionsPerPage
        const pageTransactions = transactions.slice(
          startIndex,
          startIndex + maxTransactionsPerPage
        )

        return (
          <Page key={pageIndex + 1} size="A4" style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.logo}>Protocol Banks</Text>
              <Text style={styles.subtitle}>Payment Report (continued)</Text>
            </View>

            <View style={styles.tableSection}>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, styles.colRecipient]}>Recipient</Text>
                  <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
                  <Text style={[styles.tableHeaderCell, styles.colToken]}>Token</Text>
                  <Text style={[styles.tableHeaderCell, styles.colStatus]}>Status</Text>
                  <Text style={[styles.tableHeaderCell, styles.colTxHash]}>Tx Hash</Text>
                </View>

                {pageTransactions.map((tx, index) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colDate]}>{tx.date}</Text>
                    <Text style={[styles.tableCell, styles.colRecipient]}>
                      {tx.recipientName || truncateAddress(tx.recipient)}
                    </Text>
                    <Text style={[styles.tableCell, styles.colAmount]}>
                      {formatNumber(parseFloat(tx.amount))}
                    </Text>
                    <Text style={[styles.tableCell, styles.colToken]}>{tx.token}</Text>
                    <Text style={[styles.tableCell, styles.colStatus, getStatusStyle(tx.status)]}>
                      {tx.status}
                    </Text>
                    <Text style={[styles.tableCell, styles.colTxHash]}>{truncateHash(tx.txHash)}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.footer}>
              <View style={styles.footerDivider} />
              <Text style={styles.footerText}>
                Generated by Protocol Banks on {new Date(generatedAt).toLocaleDateString()}
              </Text>
            </View>

            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </Page>
        )
      })}
    </Document>
  )
}
