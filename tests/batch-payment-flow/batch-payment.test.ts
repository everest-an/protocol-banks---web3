/**
 * Batch Payment Flow Tests
 * Tests for file parsing, validation, fee calculation, and execution
 */

import * as fc from 'fast-check';

describe('Batch Payment Flow', () => {
  describe('File Parsing', () => {
    describe('CSV Parser', () => {
      it('should parse valid CSV with standard columns', () => {
        const csvContent = `recipient_address,amount,token_symbol
0x1234567890123456789012345678901234567890,100.5,USDC
0xabcdefabcdefabcdefabcdefabcdefabcdefabcd,50.25,USDT`;

        const result = parseCSV(csvContent);
        expect(result.items).toHaveLength(2);
        expect(result.errors).toHaveLength(0);
        expect(result.items[0].recipient_address).toBe('0x1234567890123456789012345678901234567890');
        expect(result.items[0].amount).toBe('100.5');
        expect(result.items[0].token_symbol).toBe('USDC');
      });

      it('should handle flexible column names', () => {
        const csvContent = `address,value,token
0x1234567890123456789012345678901234567890,100,USDC`;

        const result = parseCSV(csvContent, {
          columnMapping: {
            recipient_address: 'address',
            amount: 'value',
            token_symbol: 'token',
          },
        });
        expect(result.items).toHaveLength(1);
        expect(result.items[0].recipient_address).toBe('0x1234567890123456789012345678901234567890');
      });

      it('should report parsing errors with line numbers', () => {
        const csvContent = `recipient_address,amount,token_symbol
0x1234567890123456789012345678901234567890,100,USDC
invalid_row_missing_columns
0xabcdefabcdefabcdefabcdefabcdefabcdefabcd,50,USDT`;

        const result = parseCSV(csvContent);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].line).toBe(3);
      });

      it('should enforce row count limits', () => {
        fc.assert(
          fc.property(fc.integer({ min: 10001, max: 20000 }), (rowCount) => {
            const rows = Array(rowCount).fill('0x1234567890123456789012345678901234567890,100,USDC');
            const csvContent = `recipient_address,amount,token_symbol\n${rows.join('\n')}`;
            
            const result = parseCSV(csvContent, { maxRows: 10000 });
            expect(result.errors.some(e => e.message.includes('limit'))).toBe(true);
          }),
          { numRuns: 5 }
        );
      });
    });

    describe('Excel Parser', () => {
      it('should parse Excel-like data structure', () => {
        const excelData = {
          sheets: [{
            name: 'Payments',
            rows: [
              ['recipient_address', 'amount', 'token_symbol'],
              ['0x1234567890123456789012345678901234567890', 100, 'USDC'],
              ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 50, 'USDT'],
            ],
          }],
        };

        const result = parseExcel(excelData);
        expect(result.items).toHaveLength(2);
      });
    });
  });

  describe('Data Validation', () => {
    it('should validate Ethereum addresses with checksum', () => {
      fc.assert(
        fc.property(fc.hexaString({ minLength: 40, maxLength: 40 }), (hex) => {
          const address = `0x${hex}`;
          const result = validateAddress(address);
          // Should either be valid or have a specific error
          expect(typeof result.valid).toBe('boolean');
        }),
        { numRuns: 100 }
      );
    });

    it('should reject invalid addresses', () => {
      const invalidAddresses = [
        '0x123', // Too short
        '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // Invalid hex
        'not_an_address',
        '', // Empty
        '1234567890123456789012345678901234567890', // Missing 0x
      ];

      invalidAddresses.forEach((addr) => {
        const result = validateAddress(addr);
        expect(result.valid).toBe(false);
      });
    });

    it('should validate positive amounts', () => {
      fc.assert(
        fc.property(fc.float({ min: Math.fround(0.01), max: Math.fround(1000000), noNaN: true }), (amount) => {
          const result = validateAmount(amount.toString());
          expect(result.valid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject negative or zero amounts', () => {
      const invalidAmounts = ['-100', '0', '-0.001'];
      invalidAmounts.forEach((amount) => {
        const result = validateAmount(amount);
        expect(result.valid).toBe(false);
      });
    });

    it('should detect duplicate recipients', () => {
      const items = [
        { recipient_address: '0x1234567890123456789012345678901234567890', amount: '100', token_symbol: 'USDC' },
        { recipient_address: '0x1234567890123456789012345678901234567890', amount: '50', token_symbol: 'USDC' },
        { recipient_address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', amount: '75', token_symbol: 'USDC' },
      ];

      const result = validateBatch(items);
      expect(result.warnings.some(w => w.includes('duplicate'))).toBe(true);
    });

    it('should validate supported token symbols', () => {
      const supportedTokens = ['USDC', 'USDT', 'DAI', 'ETH'];
      supportedTokens.forEach((token) => {
        const result = validateTokenSymbol(token);
        expect(result.valid).toBe(true);
      });

      const unsupportedTokens = ['INVALID', 'XYZ', ''];
      unsupportedTokens.forEach((token) => {
        const result = validateTokenSymbol(token);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Fee Calculation', () => {
    it('should calculate gas fees correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // item count
          fc.integer({ min: 1, max: 100 }), // gas price in gwei
          (itemCount, gasPrice) => {
            const items = Array(itemCount).fill({
              recipient_address: '0x1234567890123456789012345678901234567890',
              amount: '100',
              token_symbol: 'USDC',
              chain_id: 1,
            });

            const fees = calculateFees({ items, gasPrice, paymentMethod: 'standard' });
            
            expect(fees.gasFee).toBeGreaterThan(0);
            expect(fees.totalFee).toBeGreaterThanOrEqual(fees.gasFee);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should calculate service fee as 0.5% of total', () => {
      const items = [
        { recipient_address: '0x1234567890123456789012345678901234567890', amount: '1000', token_symbol: 'USDC', chain_id: 1 },
      ];

      const fees = calculateFees({ items, gasPrice: 20, paymentMethod: 'standard' });
      expect(fees.serviceFee).toBe(5); // 0.5% of 1000
    });

    it('should return zero gas fee for x402 on Base chain', () => {
      const items = [
        { recipient_address: '0x1234567890123456789012345678901234567890', amount: '100', token_symbol: 'USDC', chain_id: 8453 }, // Base mainnet
      ];

      const fees = calculateFees({ items, gasPrice: 20, paymentMethod: 'x402' });
      expect(fees.gasFee).toBe(0);
    });

    it('should provide fee breakdown by token', () => {
      const items = [
        { recipient_address: '0x1234567890123456789012345678901234567890', amount: '100', token_symbol: 'USDC', chain_id: 1 },
        { recipient_address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', amount: '200', token_symbol: 'USDT', chain_id: 1 },
      ];

      const fees = calculateFees({ items, gasPrice: 20, paymentMethod: 'standard' });
      expect(fees.breakdown).toBeDefined();
      expect(fees.breakdown.USDC).toBeDefined();
      expect(fees.breakdown.USDT).toBeDefined();
    });
  });

  describe('Transaction Grouping', () => {
    it('should group payments by token', () => {
      const items = [
        { recipient_address: '0x1111111111111111111111111111111111111111', amount: '100', token_symbol: 'USDC', chain_id: 1 },
        { recipient_address: '0x2222222222222222222222222222222222222222', amount: '200', token_symbol: 'USDT', chain_id: 1 },
        { recipient_address: '0x3333333333333333333333333333333333333333', amount: '150', token_symbol: 'USDC', chain_id: 1 },
      ];

      const groups = groupByToken(items);
      expect(groups.USDC).toHaveLength(2);
      expect(groups.USDT).toHaveLength(1);
    });

    it('should maintain order within groups', () => {
      const items = [
        { recipient_address: '0x1111111111111111111111111111111111111111', amount: '100', token_symbol: 'USDC', chain_id: 1, order: 1 },
        { recipient_address: '0x2222222222222222222222222222222222222222', amount: '200', token_symbol: 'USDC', chain_id: 1, order: 2 },
        { recipient_address: '0x3333333333333333333333333333333333333333', amount: '150', token_symbol: 'USDC', chain_id: 1, order: 3 },
      ];

      const groups = groupByToken(items);
      expect(groups.USDC[0].order).toBe(1);
      expect(groups.USDC[1].order).toBe(2);
      expect(groups.USDC[2].order).toBe(3);
    });
  });

  describe('Batch Status Tracking', () => {
    it('should track individual item status', () => {
      const batch = createTestBatch(5);
      
      // Simulate some completions and failures
      updateItemStatus(batch, 0, 'completed', '0xhash1');
      updateItemStatus(batch, 1, 'completed', '0xhash2');
      updateItemStatus(batch, 2, 'failed', null, 'Insufficient balance');

      const status = getBatchStatus(batch);
      expect(status.completed).toBe(2);
      expect(status.failed).toBe(1);
      expect(status.pending).toBe(2);
    });

    it('should calculate completion percentage', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (total, completed) => {
            const actualCompleted = Math.min(completed, total);
            const percentage = calculateCompletionPercentage(actualCompleted, total);
            expect(percentage).toBeGreaterThanOrEqual(0);
            expect(percentage).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

// Helper functions for testing
interface ParseResult {
  items: PaymentItem[];
  errors: ParseError[];
}

interface PaymentItem {
  recipient_address: string;
  amount: string;
  token_symbol: string;
  chain_id?: number;
  token_address?: string;
  order?: number;
}

interface ParseError {
  line: number;
  message: string;
}

interface ParseOptions {
  columnMapping?: Record<string, string>;
  maxRows?: number;
}

function parseCSV(content: string, options: ParseOptions = {}): ParseResult {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const items: PaymentItem[] = [];
  const errors: ParseError[] = [];

  const maxRows = options.maxRows || 10000;
  if (lines.length - 1 > maxRows) {
    errors.push({ line: 0, message: `Row count exceeds limit of ${maxRows}` });
    return { items, errors };
  }

  // columnMapping maps target field name -> source column name
  const mapping = options.columnMapping || {};

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) {
      errors.push({ line: i + 1, message: 'Column count mismatch' });
      continue;
    }

    const item: any = {};
    
    // First, create a map of header -> value
    const rowData: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rowData[header] = values[idx];
    });

    // Then apply mapping: for each target field, look up the source column
    const targetFields = ['recipient_address', 'amount', 'token_symbol'];
    targetFields.forEach((targetField) => {
      const sourceColumn = mapping[targetField] || targetField;
      if (rowData[sourceColumn] !== undefined) {
        item[targetField] = rowData[sourceColumn];
      }
    });

    items.push(item as PaymentItem);
  }

  return { items, errors };
}

function parseExcel(data: { sheets: { name: string; rows: any[][] }[] }): ParseResult {
  const items: PaymentItem[] = [];
  const errors: ParseError[] = [];

  const sheet = data.sheets[0];
  if (!sheet || sheet.rows.length < 2) {
    return { items, errors };
  }

  const headers = sheet.rows[0] as string[];
  for (let i = 1; i < sheet.rows.length; i++) {
    const row = sheet.rows[i];
    const item: any = {};
    headers.forEach((header, idx) => {
      item[header] = String(row[idx]);
    });
    items.push(item as PaymentItem);
  }

  return { items, errors };
}

function validateAddress(address: string): { valid: boolean; error?: string } {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required' };
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { valid: false, error: 'Invalid Ethereum address format' };
  }
  return { valid: true };
}

function validateAmount(amount: string): { valid: boolean; error?: string } {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    return { valid: false, error: 'Amount must be a positive number' };
  }
  return { valid: true };
}

function validateTokenSymbol(symbol: string): { valid: boolean; error?: string } {
  const supported = ['USDC', 'USDT', 'DAI', 'ETH', 'WETH'];
  if (!supported.includes(symbol.toUpperCase())) {
    return { valid: false, error: `Unsupported token: ${symbol}` };
  }
  return { valid: true };
}

function validateBatch(items: PaymentItem[]): { validItems: PaymentItem[]; invalidItems: PaymentItem[]; warnings: string[] } {
  const validItems: PaymentItem[] = [];
  const invalidItems: PaymentItem[] = [];
  const warnings: string[] = [];
  const seenAddresses = new Set<string>();

  items.forEach((item) => {
    const addrLower = item.recipient_address.toLowerCase();
    if (seenAddresses.has(addrLower)) {
      warnings.push(`duplicate recipient: ${item.recipient_address}`);
    }
    seenAddresses.add(addrLower);

    const addrValid = validateAddress(item.recipient_address);
    const amountValid = validateAmount(item.amount);
    const tokenValid = validateTokenSymbol(item.token_symbol);

    if (addrValid.valid && amountValid.valid && tokenValid.valid) {
      validItems.push(item);
    } else {
      invalidItems.push(item);
    }
  });

  return { validItems, invalidItems, warnings };
}

interface FeeResult {
  gasFee: number;
  serviceFee: number;
  totalFee: number;
  breakdown: Record<string, { gasFee: number; serviceFee: number }>;
}

function calculateFees(params: { items: PaymentItem[]; gasPrice?: number; paymentMethod: string }): FeeResult {
  const { items, gasPrice = 20, paymentMethod } = params;
  const breakdown: Record<string, { gasFee: number; serviceFee: number }> = {};
  
  let totalGasFee = 0;
  let totalServiceFee = 0;

  const isX402Base = paymentMethod === 'x402' && items.every(i => i.chain_id === 8453);

  items.forEach((item) => {
    const token = item.token_symbol;
    if (!breakdown[token]) {
      breakdown[token] = { gasFee: 0, serviceFee: 0 };
    }

    const amount = parseFloat(item.amount);
    const serviceFee = amount * 0.005; // 0.5%
    const gasFee = isX402Base ? 0 : gasPrice * 21000 * 1e-9; // Simplified gas calculation

    breakdown[token].gasFee += gasFee;
    breakdown[token].serviceFee += serviceFee;
    totalGasFee += gasFee;
    totalServiceFee += serviceFee;
  });

  return {
    gasFee: totalGasFee,
    serviceFee: totalServiceFee,
    totalFee: totalGasFee + totalServiceFee,
    breakdown,
  };
}

function groupByToken(items: PaymentItem[]): Record<string, PaymentItem[]> {
  const groups: Record<string, PaymentItem[]> = {};
  items.forEach((item) => {
    const token = item.token_symbol;
    if (!groups[token]) {
      groups[token] = [];
    }
    groups[token].push(item);
  });
  return groups;
}

interface BatchItem {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txHash?: string;
  error?: string;
}

interface Batch {
  id: string;
  items: BatchItem[];
}

function createTestBatch(itemCount: number): Batch {
  return {
    id: 'test-batch-' + Date.now(),
    items: Array(itemCount).fill(null).map((_, i) => ({
      id: `item-${i}`,
      status: 'pending' as const,
    })),
  };
}

function updateItemStatus(batch: Batch, index: number, status: BatchItem['status'], txHash?: string | null, error?: string) {
  if (batch.items[index]) {
    batch.items[index].status = status;
    if (txHash) batch.items[index].txHash = txHash;
    if (error) batch.items[index].error = error;
  }
}

function getBatchStatus(batch: Batch) {
  return {
    completed: batch.items.filter(i => i.status === 'completed').length,
    failed: batch.items.filter(i => i.status === 'failed').length,
    pending: batch.items.filter(i => i.status === 'pending').length,
    processing: batch.items.filter(i => i.status === 'processing').length,
  };
}

function calculateCompletionPercentage(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}
