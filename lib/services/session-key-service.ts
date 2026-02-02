/**
 * Session Key Service
 * Encapsulates all interactions with SessionKeyValidator smart contract
 */

import { ethers } from "ethers";
import {
  SessionKeyConfig,
  SessionKeyDetails,
  UsageRecord,
  SessionKeyStats,
  ChainConfig,
  getChainConfig,
} from "@/types/session-key";

// SessionKeyValidator ABI (minimal interface)
const SESSION_KEY_ABI = [
  // Write functions
  "function createSessionKey(address sessionKey, uint256 maxBudget, uint256 maxSingleTx, uint256 duration, address[] calldata allowedTokens, address[] calldata allowedTargets) external returns (bytes32 sessionId)",
  "function validateAndRecord(bytes32 sessionId, uint256 amount, address token, address target, bytes calldata signature) external returns (bool success)",
  "function freezeSessionKey(bytes32 sessionId, string calldata reason) external",
  "function unfreezeSessionKey(bytes32 sessionId) external",
  "function revokeSessionKey(bytes32 sessionId) external",
  "function topUpBudget(bytes32 sessionId, uint256 additionalBudget) external",
  
  // Read functions
  "function getSessionKey(bytes32 sessionId) external view returns (address owner, address sessionKey, uint256 maxBudget, uint256 usedBudget, uint256 remainingBudget, uint256 maxSingleTx, uint256 expiresAt, bool isActive, bool isFrozen)",
  "function getAllowedTokens(bytes32 sessionId) external view returns (address[])",
  "function getAllowedTargets(bytes32 sessionId) external view returns (address[])",
  "function getOwnerSessions(address owner) external view returns (bytes32[])",
  "function getUsageHistory(bytes32 sessionId) external view returns (tuple(uint256 timestamp, uint256 amount, address token, address target, bytes32 txHash)[])",
  "function isSessionValid(bytes32 sessionId) external view returns (bool)",
  "function getRemainingBudget(bytes32 sessionId) external view returns (uint256)",
  "function sessionKeyToId(address sessionKey) external view returns (bytes32)",
  
  // Stats
  "function totalSessionsCreated() external view returns (uint256)",
  "function totalBudgetAllocated() external view returns (uint256)",
  "function totalBudgetUsed() external view returns (uint256)",
  
  // Events
  "event SessionKeyCreated(bytes32 indexed sessionId, address indexed owner, address indexed sessionKey, uint256 maxBudget, uint256 expiresAt)",
  "event SessionKeyUsed(bytes32 indexed sessionId, address indexed sessionKey, uint256 amount, address token, address target)",
  "event SessionKeyFrozen(bytes32 indexed sessionId, address indexed frozenBy, string reason)",
  "event SessionKeyUnfrozen(bytes32 indexed sessionId, address indexed unfrozenBy)",
  "event SessionKeyRevoked(bytes32 indexed sessionId, address indexed revokedBy, uint256 remainingBudget)",
  "event BudgetTopUp(bytes32 indexed sessionId, uint256 additionalBudget, uint256 newTotalBudget)",
];

export class SessionKeyService {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private chainConfig: ChainConfig;

  constructor(chainId: number, signerOrProvider?: ethers.Signer | ethers.Provider) {
    const config = getChainConfig(chainId);
    if (!config) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    if (!config.contractAddress) {
      throw new Error(`Session Key contract not deployed on chain ${chainId}`);
    }

    this.chainConfig = config;
    this.provider = signerOrProvider instanceof ethers.Signer
      ? signerOrProvider.provider!
      : signerOrProvider || new ethers.JsonRpcProvider(config.rpcUrl);

    this.contract = new ethers.Contract(
      config.contractAddress,
      SESSION_KEY_ABI,
      signerOrProvider || this.provider
    );
  }

  /**
   * Connect with a signer for write operations
   */
  connect(signer: ethers.Signer): SessionKeyService {
    const newService = new SessionKeyService(this.chainConfig.chainId, signer);
    return newService;
  }

  /**
   * Get chain configuration
   */
  getChainConfig(): ChainConfig {
    return this.chainConfig;
  }

  // ============================================
  // Write Functions
  // ============================================

  /**
   * Create a new session key
   */
  async createSessionKey(config: SessionKeyConfig): Promise<{ sessionId: string; txHash: string }> {
    const tx = await this.contract.createSessionKey(
      config.sessionKey,
      config.maxBudget,
      config.maxSingleTx,
      config.duration,
      config.allowedTokens,
      config.allowedTargets
    );

    const receipt = await tx.wait();
    
    // Parse event to get sessionId
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = this.contract.interface.parseLog(log);
        return parsed?.name === "SessionKeyCreated";
      } catch {
        return false;
      }
    });

    let sessionId = "";
    if (event) {
      const parsed = this.contract.interface.parseLog(event);
      sessionId = parsed?.args[0] || "";
    }

    return {
      sessionId,
      txHash: receipt.hash,
    };
  }

  /**
   * Validate an operation and record usage
   */
  async validateAndRecord(
    sessionId: string,
    amount: bigint,
    token: string,
    target: string,
    signature: string
  ): Promise<{ success: boolean; txHash: string }> {
    const tx = await this.contract.validateAndRecord(
      sessionId,
      amount,
      token,
      target,
      signature
    );

    const receipt = await tx.wait();
    return {
      success: true,
      txHash: receipt.hash,
    };
  }

  /**
   * Freeze a session key
   */
  async freezeSessionKey(sessionId: string, reason: string): Promise<string> {
    const tx = await this.contract.freezeSessionKey(sessionId, reason);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Unfreeze a session key
   */
  async unfreezeSessionKey(sessionId: string): Promise<string> {
    const tx = await this.contract.unfreezeSessionKey(sessionId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Revoke a session key
   */
  async revokeSessionKey(sessionId: string): Promise<string> {
    const tx = await this.contract.revokeSessionKey(sessionId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Top up session budget
   */
  async topUpBudget(sessionId: string, additionalBudget: bigint): Promise<string> {
    const tx = await this.contract.topUpBudget(sessionId, additionalBudget);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ============================================
  // Read Functions
  // ============================================

  /**
   * Get session key details
   */
  async getSessionKey(sessionId: string): Promise<SessionKeyDetails | null> {
    try {
      const [
        owner,
        sessionKey,
        maxBudget,
        usedBudget,
        remainingBudget,
        maxSingleTx,
        expiresAt,
        isActive,
        isFrozen,
      ] = await this.contract.getSessionKey(sessionId);

      const allowedTokens = await this.contract.getAllowedTokens(sessionId);
      const allowedTargets = await this.contract.getAllowedTargets(sessionId);

      return {
        sessionId,
        owner,
        sessionKey,
        maxBudget,
        usedBudget,
        remainingBudget,
        maxSingleTx,
        expiresAt: Number(expiresAt),
        createdAt: 0, // Not returned by contract, would need event parsing
        isActive,
        isFrozen,
        allowedTokens: [...allowedTokens],
        allowedTargets: [...allowedTargets],
      };
    } catch (error) {
      console.error("[SessionKeyService] getSessionKey error:", error);
      return null;
    }
  }

  /**
   * Get all sessions for an owner
   */
  async getOwnerSessions(ownerAddress: string): Promise<SessionKeyDetails[]> {
    try {
      const sessionIds: string[] = await this.contract.getOwnerSessions(ownerAddress);
      
      const sessions: SessionKeyDetails[] = [];
      for (const sessionId of sessionIds) {
        const session = await this.getSessionKey(sessionId);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (error) {
      console.error("[SessionKeyService] getOwnerSessions error:", error);
      return [];
    }
  }

  /**
   * Get usage history for a session
   */
  async getUsageHistory(sessionId: string): Promise<UsageRecord[]> {
    try {
      const records = await this.contract.getUsageHistory(sessionId);
      return records.map((r: any) => ({
        timestamp: Number(r.timestamp),
        amount: r.amount,
        token: r.token,
        target: r.target,
        txHash: r.txHash,
      }));
    } catch (error) {
      console.error("[SessionKeyService] getUsageHistory error:", error);
      return [];
    }
  }

  /**
   * Check if session is valid
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    try {
      return await this.contract.isSessionValid(sessionId);
    } catch {
      return false;
    }
  }

  /**
   * Get remaining budget for a session
   */
  async getRemainingBudget(sessionId: string): Promise<bigint> {
    try {
      return await this.contract.getRemainingBudget(sessionId);
    } catch {
      return 0n;
    }
  }

  /**
   * Get session ID by session key address
   */
  async getSessionIdByKey(sessionKeyAddress: string): Promise<string | null> {
    try {
      const sessionId = await this.contract.sessionKeyToId(sessionKeyAddress);
      if (sessionId === ethers.ZeroHash) {
        return null;
      }
      return sessionId;
    } catch {
      return null;
    }
  }

  /**
   * Get global statistics
   */
  async getStats(): Promise<SessionKeyStats> {
    try {
      const [totalSessionsCreated, totalBudgetAllocated, totalBudgetUsed] = await Promise.all([
        this.contract.totalSessionsCreated(),
        this.contract.totalBudgetAllocated(),
        this.contract.totalBudgetUsed(),
      ]);

      return {
        totalSessionsCreated: Number(totalSessionsCreated),
        totalBudgetAllocated,
        totalBudgetUsed,
      };
    } catch (error) {
      console.error("[SessionKeyService] getStats error:", error);
      return {
        totalSessionsCreated: 0,
        totalBudgetAllocated: 0n,
        totalBudgetUsed: 0n,
      };
    }
  }

  // ============================================
  // Utility Functions
  // ============================================

  /**
   * Generate signature for validateAndRecord
   */
  static async generateOperationSignature(
    signer: ethers.Signer,
    sessionId: string,
    amount: bigint,
    token: string,
    target: string,
    chainId: number,
    currentUsedBudget: bigint
  ): Promise<string> {
    const messageHash = ethers.solidityPackedKeccak256(
      ["bytes32", "uint256", "address", "address", "uint256", "uint256"],
      [sessionId, amount, token, target, chainId, currentUsedBudget]
    );

    return await signer.signMessage(ethers.getBytes(messageHash));
  }

  /**
   * Parse ETH string to wei
   */
  static parseEth(ethString: string): bigint {
    return ethers.parseEther(ethString);
  }

  /**
   * Format wei to ETH string
   */
  static formatEth(wei: bigint): string {
    return ethers.formatEther(wei);
  }

  /**
   * Get explorer URL for transaction
   */
  getExplorerTxUrl(txHash: string): string {
    return `${this.chainConfig.explorerUrl}/tx/${txHash}`;
  }

  /**
   * Get explorer URL for address
   */
  getExplorerAddressUrl(address: string): string {
    return `${this.chainConfig.explorerUrl}/address/${address}`;
  }
}

// Export singleton factory
export function createSessionKeyService(
  chainId: number,
  signerOrProvider?: ethers.Signer | ethers.Provider
): SessionKeyService {
  return new SessionKeyService(chainId, signerOrProvider);
}
