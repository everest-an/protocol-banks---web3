/**
 * 使用现成的批量转账合约
 * 无需自己部署，直接使用已验证的公开合约
 */

import { encodeFunctionData, parseUnits, type Address } from 'viem';
import type { PublicClient, WalletClient } from 'viem';

// ============================================
// 已部署的公开批量转账合约地址
// ============================================

export const PUBLIC_BATCH_CONTRACTS: Record<number, Address> = {
  // Arbitrum 主网 - 已验证 ✅
  42161: '0xD152f549545093347A162Dce210e7293f1452150', // Disperse.app

  // Base 主网 - 使用通用地址（待验证）
  8453: '0xD152f549545093347A162Dce210e7293f1452150', // Disperse.app

  // Ethereum 主网 - 已验证 ✅
  1: '0xD152f549545093347A162Dce210e7293f1452150', // Disperse.app

  // Polygon 主网 - 已验证 ✅
  137: '0xD152f549545093347A162Dce210e7293f1452150', // Disperse.app

  // BSC 主网 - 已验证 ✅
  56: '0xD152f549545093347A162Dce210e7293f1452150', // Disperse.app
};

// ============================================
// Disperse.app 合约ABI（行业标准）
// ============================================

const DISPERSE_ABI = [
  {
    constant: false,
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
    ],
    name: 'disperseToken',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
    ],
    name: 'disperseTokenSimple',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ERC20 ABI
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
// Token Addresses
// ============================================

export const TOKEN_ADDRESSES: Record<number, Record<string, Address>> = {
  // Arbitrum
  42161: {
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  },
  // Base
  8453: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  // Ethereum
  1: {
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  },
};

const TOKEN_DECIMALS: Record<string, number> = {
  USDT: 6,
  USDC: 6,
  DAI: 18,
};

// ============================================
// Public Batch Transfer Service
// ============================================

export interface BatchRecipient {
  address: Address;
  amount: string; // 人类可读格式 "100.5"
}

export interface BatchResult {
  success: boolean;
  txHash?: string;
  totalRecipients: number;
  totalAmount: string;
  errorMessage?: string;
}

export class PublicBatchTransferService {
  /**
   * 使用公开合约批量转账
   */
  async batchTransfer(
    walletClient: WalletClient,
    publicClient: PublicClient,
    recipients: BatchRecipient[],
    tokenSymbol: string = 'USDT',
    chainId: number = 42161
  ): Promise<BatchResult> {
    try {
      const [account] = await walletClient.getAddresses();

      // 获取合约地址
      const contractAddress = PUBLIC_BATCH_CONTRACTS[chainId];
      if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error(`No public batch contract available for chain ${chainId}`);
      }

      // 获取代币地址
      const tokenAddress = TOKEN_ADDRESSES[chainId]?.[tokenSymbol];
      if (!tokenAddress) {
        throw new Error(`Token ${tokenSymbol} not supported on chain ${chainId}`);
      }

      const decimals = TOKEN_DECIMALS[tokenSymbol] || 6;

      // 准备数据
      const addresses = recipients.map((r) => r.address);
      const amounts = recipients.map((r) => parseUnits(r.amount, decimals));
      const totalAmount = amounts.reduce((sum, amt) => sum + amt, 0n);

      // 1. 检查并授权代币
      await this.ensureAllowance(
        walletClient,
        publicClient,
        account,
        tokenAddress,
        contractAddress,
        totalAmount
      );

      console.log('[PublicBatch] Sending batch transfer...');
      console.log('  Contract:', contractAddress);
      console.log('  Token:', tokenAddress);
      console.log('  Recipients:', addresses.length);
      console.log('  Total amount:', totalAmount.toString());

      // 2. 执行批量转账
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: DISPERSE_ABI,
        functionName: 'disperseTokenSimple',
        args: [tokenAddress, addresses, amounts],
        account,
      });

      console.log('[PublicBatch] Transaction sent:', hash);

      // 3. 等待确认
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      console.log('[PublicBatch] Transaction confirmed:', receipt.status);

      return {
        success: receipt.status === 'success',
        txHash: hash,
        totalRecipients: recipients.length,
        totalAmount: totalAmount.toString(),
      };
    } catch (error: any) {
      console.error('[PublicBatch] Error:', error);
      return {
        success: false,
        totalRecipients: recipients.length,
        totalAmount: '0',
        errorMessage: error.message || 'Batch transfer failed',
      };
    }
  }

  /**
   * 确保代币授权额度足够
   */
  private async ensureAllowance(
    walletClient: WalletClient,
    publicClient: PublicClient,
    owner: Address,
    tokenAddress: Address,
    spender: Address,
    requiredAmount: bigint
  ): Promise<void> {
    try {
      // 检查当前授权额度
      const currentAllowance = (await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner, spender],
      })) as bigint;

      console.log('[PublicBatch] Current allowance:', currentAllowance.toString());
      console.log('[PublicBatch] Required amount:', requiredAmount.toString());

      // 如果授权不足，请求授权
      if (currentAllowance < requiredAmount) {
        console.log('[PublicBatch] Requesting token approval...');

        const hash = await walletClient.writeContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [spender, requiredAmount], // ✅ 只授权实际需要的数量
          account: owner,
        });

        console.log('[PublicBatch] Approval tx:', hash);
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('[PublicBatch] Approval confirmed');
      } else {
        console.log('[PublicBatch] Sufficient allowance already granted');
      }
    } catch (error) {
      console.error('[PublicBatch] Approval error:', error);
      throw new Error('Failed to approve tokens. Please try again.');
    }
  }

  /**
   * 检查链是否支持公开批量转账
   */
  isChainSupported(chainId: number): boolean {
    const contractAddress = PUBLIC_BATCH_CONTRACTS[chainId];
    return !!contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000';
  }

  /**
   * 获取合约地址
   */
  getContractAddress(chainId: number): Address | null {
    return PUBLIC_BATCH_CONTRACTS[chainId] || null;
  }
}

// Export singleton
export const publicBatchTransferService = new PublicBatchTransferService();
