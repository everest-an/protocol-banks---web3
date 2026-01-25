/**
 * Batch Transfer Service
 * 批量转账服务 - 使用智能合约实现一次签名多笔转账
 */

import { encodeFunctionData, parseUnits, type Address } from 'viem';
import { PublicClient, WalletClient } from 'viem';

// ============================================
// Types
// ============================================

export interface BatchTransferRecipient {
  address: Address;
  amount: string; // 人类可读格式，例如 "100.5"
}

export interface BatchTransferResult {
  success: boolean;
  txHash?: string;
  successCount?: number;
  totalRecipients: number;
  totalAmount: string;
  feeAmount: string;
  errorMessage?: string;
}

export interface ContractStats {
  batchesProcessed: bigint;
  recipientsServed: bigint;
  currentFee: number; // bps
  currentMaxBatch: bigint;
}

// ============================================
// Contract ABI
// ============================================

const BATCH_TRANSFER_ABI = [
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    name: 'batchTransfer',
    outputs: [{ name: 'successCount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'batchTransferEqual',
    outputs: [{ name: 'successCount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amounts', type: 'uint256[]' }],
    name: 'calculateTotalRequired',
    outputs: [
      { name: 'totalRequired', type: 'uint256' },
      { name: 'feeAmount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getStats',
    outputs: [
      { name: 'batchesProcessed', type: 'uint256' },
      { name: 'recipientsServed', type: 'uint256' },
      { name: 'currentFee', type: 'uint16' },
      { name: 'currentMaxBatch', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'maxBatchSize',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'platformFeeBps',
    outputs: [{ name: '', type: 'uint16' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ERC20 Approve ABI
const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ============================================
// Constants
// ============================================

// 合约地址（从环境变量读取）
const BATCH_TRANSFER_CONTRACT = (process.env.NEXT_PUBLIC_BATCH_TRANSFER_CONTRACT ||
  '0x0000000000000000000000000000000000000000') as Address;

// 常见代币地址（Arbitrum）
export const TOKEN_ADDRESSES: Record<string, Address> = {
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
};

// 代币精度
const TOKEN_DECIMALS: Record<string, number> = {
  USDT: 6,
  USDC: 6,
  DAI: 18,
};

// ============================================
// Batch Transfer Service
// ============================================

export class BatchTransferService {
  private contractAddress: Address;

  constructor(contractAddress?: Address) {
    this.contractAddress = contractAddress || BATCH_TRANSFER_CONTRACT;
    if (this.contractAddress === '0x0000000000000000000000000000000000000000') {
      console.warn(
        '[BatchTransfer] Contract address not set. Please set NEXT_PUBLIC_BATCH_TRANSFER_CONTRACT in .env'
      );
    }
  }

  /**
   * 批量转账（不同金额）
   */
  async batchTransfer(
    walletClient: WalletClient,
    publicClient: PublicClient,
    recipients: BatchTransferRecipient[],
    tokenSymbol: string = 'USDT'
  ): Promise<BatchTransferResult> {
    try {
      const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
      if (!tokenAddress) {
        throw new Error(`Unsupported token: ${tokenSymbol}`);
      }

      const decimals = TOKEN_DECIMALS[tokenSymbol] || 6;
      const [account] = await walletClient.getAddresses();

      // 转换金额为wei
      const addresses = recipients.map((r) => r.address);
      const amounts = recipients.map((r) => parseUnits(r.amount, decimals));

      // 计算总金额和手续费
      const { totalRequired, feeAmount } = await this.calculateTotalRequired(publicClient, amounts);

      // 1. 检查并授权代币
      await this.ensureAllowance(walletClient, publicClient, account, tokenAddress, totalRequired);

      // 2. 执行批量转账
      const hash = await walletClient.writeContract({
        address: this.contractAddress,
        abi: BATCH_TRANSFER_ABI,
        functionName: 'batchTransfer',
        args: [tokenAddress, addresses, amounts],
        account,
      });

      // 3. 等待交易确认
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // 4. 解析结果
      const successCount = recipients.length; // 从事件日志中解析实际成功数

      return {
        success: receipt.status === 'success',
        txHash: hash,
        successCount,
        totalRecipients: recipients.length,
        totalAmount: totalRequired.toString(),
        feeAmount: feeAmount.toString(),
      };
    } catch (error: any) {
      console.error('[BatchTransfer] Error:', error);
      return {
        success: false,
        totalRecipients: recipients.length,
        totalAmount: '0',
        feeAmount: '0',
        errorMessage: error.message || 'Batch transfer failed',
      };
    }
  }

  /**
   * 批量转账（相同金额）- Gas优化版本
   */
  async batchTransferEqual(
    walletClient: WalletClient,
    publicClient: PublicClient,
    recipients: Address[],
    amount: string,
    tokenSymbol: string = 'USDT'
  ): Promise<BatchTransferResult> {
    try {
      const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
      if (!tokenAddress) {
        throw new Error(`Unsupported token: ${tokenSymbol}`);
      }

      const decimals = TOKEN_DECIMALS[tokenSymbol] || 6;
      const [account] = await walletClient.getAddresses();
      const amountWei = parseUnits(amount, decimals);

      // 计算总金额
      const totalAmount = amountWei * BigInt(recipients.length);
      const { totalRequired, feeAmount } = await this.calculateTotalRequired(publicClient, [totalAmount]);

      // 1. 授权代币
      await this.ensureAllowance(walletClient, publicClient, account, tokenAddress, totalRequired);

      // 2. 执行批量转账
      const hash = await walletClient.writeContract({
        address: this.contractAddress,
        abi: BATCH_TRANSFER_ABI,
        functionName: 'batchTransferEqual',
        args: [tokenAddress, recipients, amountWei],
        account,
      });

      // 3. 等待确认
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return {
        success: receipt.status === 'success',
        txHash: hash,
        successCount: recipients.length,
        totalRecipients: recipients.length,
        totalAmount: totalRequired.toString(),
        feeAmount: feeAmount.toString(),
      };
    } catch (error: any) {
      console.error('[BatchTransfer] Error:', error);
      return {
        success: false,
        totalRecipients: recipients.length,
        totalAmount: '0',
        feeAmount: '0',
        errorMessage: error.message || 'Batch transfer failed',
      };
    }
  }

  /**
   * 确保有足够的授权额度
   */
  private async ensureAllowance(
    walletClient: WalletClient,
    publicClient: PublicClient,
    owner: Address,
    tokenAddress: Address,
    requiredAmount: bigint
  ): Promise<void> {
    // 检查当前授权额度
    const currentAllowance = (await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [owner, this.contractAddress],
    })) as bigint;

    // 如果授权不足，重新授权
    if (currentAllowance < requiredAmount) {
      console.log('[BatchTransfer] Approving tokens...');
      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [this.contractAddress, requiredAmount],
        account: owner,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      console.log('[BatchTransfer] Approval confirmed');
    }
  }

  /**
   * 计算总金额和手续费
   */
  async calculateTotalRequired(
    publicClient: PublicClient,
    amounts: bigint[]
  ): Promise<{ totalRequired: bigint; feeAmount: bigint }> {
    try {
      const result = (await publicClient.readContract({
        address: this.contractAddress,
        abi: BATCH_TRANSFER_ABI,
        functionName: 'calculateTotalRequired',
        args: [amounts],
      })) as [bigint, bigint];

      return {
        totalRequired: result[0],
        feeAmount: result[1],
      };
    } catch (error) {
      console.error('[BatchTransfer] Error calculating total:', error);
      const total = amounts.reduce((sum, amt) => sum + amt, 0n);
      return { totalRequired: total, feeAmount: 0n };
    }
  }

  /**
   * 获取合约统计信息
   */
  async getStats(publicClient: PublicClient): Promise<ContractStats> {
    try {
      const result = (await publicClient.readContract({
        address: this.contractAddress,
        abi: BATCH_TRANSFER_ABI,
        functionName: 'getStats',
      })) as [bigint, bigint, number, bigint];

      return {
        batchesProcessed: result[0],
        recipientsServed: result[1],
        currentFee: result[2],
        currentMaxBatch: result[3],
      };
    } catch (error) {
      console.error('[BatchTransfer] Error fetching stats:', error);
      return {
        batchesProcessed: 0n,
        recipientsServed: 0n,
        currentFee: 0,
        currentMaxBatch: 200n,
      };
    }
  }

  /**
   * 获取最大批量大小
   */
  async getMaxBatchSize(publicClient: PublicClient): Promise<number> {
    try {
      const maxSize = (await publicClient.readContract({
        address: this.contractAddress,
        abi: BATCH_TRANSFER_ABI,
        functionName: 'maxBatchSize',
      })) as bigint;

      return Number(maxSize);
    } catch (error) {
      console.error('[BatchTransfer] Error fetching max batch size:', error);
      return 200;
    }
  }
}

// Export singleton instance
export const batchTransferService = new BatchTransferService();
