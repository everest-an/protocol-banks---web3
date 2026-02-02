# AI 计费系统 MVP - 设计文档

**版本**: 1.0  
**日期**: 2026-02-03

---

## 1. 系统架构（简化版）

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    用户层                                    │
├─────────────────────────────────────────────────────────────┤
│  Protocol Banks Web  │  AI Service (Express + Middleware)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                        │
├─────────────────────────────────────────────────────────────┤
│  /api/session-keys/*  │  /api/stream/*                      │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│  SessionKey      │  │  Accumulator │  │  RuleEngine  │
│  Service (TS)    │  │  (Go)        │  │  (Go)        │
└──────────────────┘  └──────────────┘  └──────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    数据层                                    │
├─────────────────────────────────────────────────────────────┤
│  Supabase (PostgreSQL)  │  Redis  │  Polygon (Contract)    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 智能合约设计

### 2.1 SessionKeyValidator 合约

```solidity
// contracts/SessionKeyValidator.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SessionKeyValidator {
    struct SessionKey {
        address owner;
        uint256 limitAmount;      // 总限额（Wei）
        uint256 currentUsage;     // 当前使用量
        uint256 expiresAt;        // 过期时间
        bool isFrozen;            // 是否冻结
        address allowedContract;  // 允许的合约地址
    }
    
    mapping(address => SessionKey) public sessionKeys;
    
    event SessionKeyCreated(
        address indexed sessionKey,
        address indexed owner,
        uint256 limitAmount,
        uint256 expiresAt
    );
    
    event UsageRecorded(
        address indexed sessionKey,
        uint256 amount,
        uint256 newTotal
    );
    
    event SessionKeyFrozen(
        address indexed sessionKey,
        string reason
    );
    
    event SessionKeyUnfrozen(
        address indexed sessionKey
    );
    
    /**
     * @dev 创建 Session Key
     */
    function createSessionKey(
        address _sessionKey,
        uint256 _limitAmount,
        uint256 _duration,
        address _allowedContract
    ) external {
        require(sessionKeys[_sessionKey].owner == address(0), "Key exists");
        require(_limitAmount > 0, "Invalid limit");
        require(_duration > 0, "Invalid duration");
        
        sessionKeys[_sessionKey] = SessionKey({
            owner: msg.sender,
            limitAmount: _limitAmount,
            currentUsage: 0,
            expiresAt: block.timestamp + _duration,
            isFrozen: false,
            allowedContract: _allowedContract
        });
        
        emit SessionKeyCreated(_sessionKey, msg.sender, _limitAmount, block.timestamp + _duration);
    }
    
    /**
     * @dev 验证并记录使用
     */
    function validateAndRecord(
        address _sessionKey,
        uint256 _amount,
        address _targetContract
    ) external returns (bool) {
        SessionKey storage key = sessionKeys[_sessionKey];
        
        // 验证
        require(key.owner != address(0), "Invalid key");
        require(!key.isFrozen, "Key frozen");
        require(block.timestamp < key.expiresAt, "Key expired");
        require(key.currentUsage + _amount <= key.limitAmount, "Limit exceeded");
        require(key.allowedContract == _targetContract, "Contract not allowed");
        
        // 记录使用
        key.currentUsage += _amount;
        
        emit UsageRecorded(_sessionKey, _amount, key.currentUsage);
        
        return true;
    }
    
    /**
     * @dev 冻结 Session Key
     */
    function freezeSessionKey(address _sessionKey, string memory _reason) external {
        SessionKey storage key = sessionKeys[_sessionKey];
        require(msg.sender == key.owner, "Not owner");
        require(!key.isFrozen, "Already frozen");
        
        key.isFrozen = true;
        emit SessionKeyFrozen(_sessionKey, _reason);
    }
    
    /**
     * @dev 解冻 Session Key
     */
    function unfreezeSessionKey(address _sessionKey) external {
        SessionKey storage key = sessionKeys[_sessionKey];
        require(msg.sender == key.owner, "Not owner");
        require(key.isFrozen, "Not frozen");
        
        key.isFrozen = false;
        emit SessionKeyUnfrozen(_sessionKey);
    }
    
    /**
     * @dev 查询 Session Key 信息
     */
    function getSessionKey(address _sessionKey) external view returns (
        address owner,
        uint256 limitAmount,
        uint256 currentUsage,
        uint256 expiresAt,
        bool isFrozen,
        address allowedContract
    ) {
        SessionKey memory key = sessionKeys[_sessionKey];
        return (
            key.owner,
            key.limitAmount,
            key.currentUsage,
            key.expiresAt,
            key.isFrozen,
            key.allowedContract
        );
    }
}
```

---

## 3. 后端服务设计

### 3.1 Session Key 管理服务

```typescript
// lib/services/session-key-service.ts
import { ethers } from 'ethers'
import { supabase } from '@/lib/supabase'
import { SessionKeyValidatorABI } from '@/contracts/abis'

const CONTRACT_ADDRESS = process.env.SESSION_KEY_VALIDATOR_ADDRESS!

export interface CreateSessionKeyParams {
  agentId: string
  limitAmount: string  // USDC
  expiresIn: number    // 秒
  allowedContract: string
}

export interface SessionKeyInfo {
  id: string
  agentId: string
  publicKey: string
  privateKey?: string  // 只在创建时返回
  limitAmount: string
  currentUsage: string
  expiresAt: Date
  isFrozen: boolean
  allowedContract: string
  createdAt: Date
}

export class SessionKeyService {
  private provider: ethers.Provider
  private contract: ethers.Contract
  
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL)
    this.contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      SessionKeyValidatorABI,
      this.provider
    )
  }
  
  /**
   * 创建 Session Key
   */
  async createSessionKey(params: CreateSessionKeyParams): Promise<SessionKeyInfo> {
    // 1. 生成临时密钥对
    const wallet = ethers.Wallet.createRandom()
    
    // 2. 计算过期时间
    const expiresAt = new Date(Date.now() + params.expiresIn * 1000)
    
    // 3. 转换金额（USDC 有 6 位小数）
    const limitAmountWei = ethers.parseUnits(params.limitAmount, 6)
    
    // 4. 在链上注册 Session Key
    const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY!, this.provider)
    const contractWithSigner = this.contract.connect(signer)
    
    const tx = await contractWithSigner.createSessionKey(
      wallet.address,
      limitAmountWei,
      params.expiresIn,
      params.allowedContract
    )
    
    await tx.wait()
    
    // 5. 存储到数据库
    const { data, error } = await supabase
      .from('session_keys')
      .insert({
        agent_id: params.agentId,
        public_key: wallet.address,
        private_key_encrypted: this.encryptPrivateKey(wallet.privateKey),
        limit_amount: params.limitAmount,
        current_usage: '0',
        expires_at: expiresAt.toISOString(),
        is_frozen: false,
        allowed_contract: params.allowedContract,
      })
      .select()
      .single()
    
    if (error) throw error
    
    return {
      id: data.id,
      agentId: data.agent_id,
      publicKey: wallet.address,
      privateKey: wallet.privateKey,  // 只返回一次
      limitAmount: data.limit_amount,
      currentUsage: data.current_usage,
      expiresAt: new Date(data.expires_at),
      isFrozen: data.is_frozen,
      allowedContract: data.allowed_contract,
      createdAt: new Date(data.created_at),
    }
  }
  
  /**
   * 查询 Session Key
   */
  async getSessionKey(publicKey: string): Promise<SessionKeyInfo | null> {
    const { data, error } = await supabase
      .from('session_keys')
      .select('*')
      .eq('public_key', publicKey)
      .single()
    
    if (error || !data) return null
    
    return {
      id: data.id,
      agentId: data.agent_id,
      publicKey: data.public_key,
      limitAmount: data.limit_amount,
      currentUsage: data.current_usage,
      expiresAt: new Date(data.expires_at),
      isFrozen: data.is_frozen,
      allowedContract: data.allowed_contract,
      createdAt: new Date(data.created_at),
    }
  }
  
  /**
   * 冻结 Session Key
   */
  async freezeSessionKey(publicKey: string, reason: string): Promise<void> {
    // 1. 链上冻结
    const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY!, this.provider)
    const contractWithSigner = this.contract.connect(signer)
    
    const tx = await contractWithSigner.freezeSessionKey(publicKey, reason)
    await tx.wait()
    
    // 2. 数据库更新
    await supabase
      .from('session_keys')
      .update({ is_frozen: true })
      .eq('public_key', publicKey)
  }
  
  /**
   * 解冻 Session Key
   */
  async unfreezeSessionKey(publicKey: string): Promise<void> {
    const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY!, this.provider)
    const contractWithSigner = this.contract.connect(signer)
    
    const tx = await contractWithSigner.unfreezeSessionKey(publicKey)
    await tx.wait()
    
    await supabase
      .from('session_keys')
      .update({ is_frozen: false })
      .eq('public_key', publicKey)
  }
  
  /**
   * 加密私钥
   */
  private encryptPrivateKey(privateKey: string): string {
    // 使用 AES-256-GCM 加密
    // 实现省略
    return privateKey
  }
}

export const sessionKeyService = new SessionKeyService()
```

---

### 3.2 HTTP 402 中间件

```typescript
// lib/middleware/pb-stream.ts
import { Request, Response, NextFunction } from 'express'
import { sessionKeyService } from '@/lib/services/session-key-service'
import { redis } from '@/lib/redis'

export interface PBStreamOptions {
  ratePerCall: string  // USDC per call
  service: string
}

export function pbStreamMiddleware(options: PBStreamOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const sessionKey = req.headers['x-session-key'] as string
    
    // 1. 检查 Session Key
    if (!sessionKey) {
      return res.status(402).json({
        error: 'Payment Required',
        message: 'Please provide a valid session key',
        paymentInfo: {
          service: options.service,
          rate: options.ratePerCall,
          currency: 'USDC',
        },
      })
    }
    
    // 2. 验证 Session Key（使用 Redis 缓存）
    const cacheKey = `session_key:${sessionKey}`
    let keyInfo = await redis.get(cacheKey)
    
    if (!keyInfo) {
      keyInfo = await sessionKeyService.getSessionKey(sessionKey)
      if (!keyInfo) {
        return res.status(403).json({
          error: 'Invalid Session Key',
          message: 'Session key not found',
        })
      }
      // 缓存 5 分钟
      await redis.setex(cacheKey, 300, JSON.stringify(keyInfo))
    } else {
      keyInfo = JSON.parse(keyInfo)
    }
    
    // 3. 检查状态
    if (keyInfo.isFrozen) {
      return res.status(403).json({
        error: 'Session Key Frozen',
        message: 'This session key has been frozen',
      })
    }
    
    if (new Date(keyInfo.expiresAt) < new Date()) {
      return res.status(403).json({
        error: 'Session Key Expired',
        message: 'This session key has expired',
      })
    }
    
    // 4. 检查余额
    const remainingBalance = parseFloat(keyInfo.limitAmount) - parseFloat(keyInfo.currentUsage)
    if (remainingBalance < parseFloat(options.ratePerCall)) {
      return res.status(402).json({
        error: 'Insufficient Balance',
        required: options.ratePerCall,
        available: remainingBalance.toString(),
      })
    }
    
    // 5. 记录使用（异步，不阻塞请求）
    recordUsage(sessionKey, options.ratePerCall, options.service).catch(console.error)
    
    // 6. 放行请求
    next()
  }
}

/**
 * 记录使用量（链下累积）
 */
async function recordUsage(sessionKey: string, amount: string, service: string) {
  const usageKey = `usage:${sessionKey}`
  
  // Redis 原子增加
  const newTotal = await redis.incrbyfloat(usageKey, parseFloat(amount))
  
  // 检查是否达到结算阈值（10 USDC）
  if (newTotal >= 10) {
    // 触发链上结算（通过消息队列）
    await redis.lpush('settlement_queue', JSON.stringify({
      sessionKey,
      amount: newTotal,
      timestamp: Date.now(),
    }))
    
    // 重置计数器
    await redis.set(usageKey, '0')
  }
  
  // 更新数据库
  await supabase
    .from('session_keys')
    .update({
      current_usage: supabase.raw(`current_usage + ${amount}`),
    })
    .eq('public_key', sessionKey)
}
```

---

### 3.3 状态通道累积器（Go）

```go
// services/pb-stream/accumulator.go
package pbstream

import (
    "context"
    "encoding/json"
    "log"
    "time"
    
    "github.com/go-redis/redis/v8"
    "github.com/ethereum/go-ethereum/ethclient"
)

type SettlementJob struct {
    SessionKey string  `json:"sessionKey"`
    Amount     float64 `json:"amount"`
    Timestamp  int64   `json:"timestamp"`
}

type Accumulator struct {
    redis      *redis.Client
    ethClient  *ethclient.Client
    contractAddr string
}

func NewAccumulator(redisAddr string, rpcURL string, contractAddr string) *Accumulator {
    rdb := redis.NewClient(&redis.Options{
        Addr: redisAddr,
    })
    
    client, err := ethclient.Dial(rpcURL)
    if err != nil {
        log.Fatal(err)
    }
    
    return &Accumulator{
        redis:      rdb,
        ethClient:  client,
        contractAddr: contractAddr,
    }
}

/**
 * 启动结算工作器
 */
func (a *Accumulator) Start() {
    ctx := context.Background()
    
    for {
        // 从队列中取出结算任务
        result, err := a.redis.BRPop(ctx, 0, "settlement_queue").Result()
        if err != nil {
            log.Printf("Error popping from queue: %v", err)
            continue
        }
        
        // 解析任务
        var job SettlementJob
        if err := json.Unmarshal([]byte(result[1]), &job); err != nil {
            log.Printf("Error unmarshaling job: %v", err)
            continue
        }
        
        // 执行链上结算
        if err := a.settleOnChain(ctx, &job); err != nil {
            log.Printf("Settlement failed: %v", err)
            
            // 重试机制（最多 3 次）
            a.retrySettlement(ctx, &job)
        }
    }
}

/**
 * 链上结算
 */
func (a *Accumulator) settleOnChain(ctx context.Context, job *SettlementJob) error {
    // 1. 调用智能合约记录使用
    // 2. 等待交易确认
    // 3. 更新数据库
    // 4. 发送 Webhook 通知
    
    log.Printf("Settling %f USDC for session key %s", job.Amount, job.SessionKey)
    
    // 实现省略...
    
    return nil
}

/**
 * 重试结算
 */
func (a *Accumulator) retrySettlement(ctx context.Context, job *SettlementJob) {
    maxRetries := 3
    
    for i := 0; i < maxRetries; i++ {
        time.Sleep(time.Duration(i+1) * time.Minute)
        
        if err := a.settleOnChain(ctx, job); err == nil {
            return
        }
        
        log.Printf("Retry %d/%d failed for session key %s", i+1, maxRetries, job.SessionKey)
    }
    
    // 所有重试失败，记录到失败队列
    a.redis.LPush(ctx, "settlement_failed", job)
}
```

---

## 4. 前端界面设计

### 4.1 Session Key 管理页面

```typescript
// app/session-keys/page.tsx
'use client'

import { useState } from 'react'
import { useSessionKeys } from '@/hooks/use-session-keys'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CreateSessionKeyDialog } from '@/components/session-keys/create-dialog'

export default function SessionKeysPage() {
  const { sessionKeys, isLoading, createSessionKey, freezeSessionKey } = useSessionKeys()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Session Keys</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          Create Session Key
        </Button>
      </div>
      
      <div className="grid gap-4">
        {sessionKeys?.map((key) => (
          <Card key={key.id} className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold">{key.publicKey}</h3>
                <p className="text-sm text-muted-foreground">
                  Expires: {new Date(key.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant={key.isFrozen ? "default" : "destructive"}
                size="sm"
                onClick={() => freezeSessionKey(key.publicKey)}
              >
                {key.isFrozen ? 'Unfreeze' : 'Freeze'}
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Usage</span>
                <span>
                  {key.currentUsage} / {key.limitAmount} USDC
                </span>
              </div>
              <Progress 
                value={(parseFloat(key.currentUsage) / parseFloat(key.limitAmount)) * 100} 
              />
            </div>
          </Card>
        ))}
      </div>
      
      <CreateSessionKeyDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={createSessionKey}
      />
    </div>
  )
}
```

---

## 5. 数据库设计

```sql
-- Session Keys 表
CREATE TABLE session_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id),
  public_key TEXT UNIQUE NOT NULL,
  private_key_encrypted TEXT NOT NULL,
  limit_amount DECIMAL(20, 6) NOT NULL,
  current_usage DECIMAL(20, 6) DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  is_frozen BOOLEAN DEFAULT FALSE,
  allowed_contract TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_session_keys_agent_id ON session_keys(agent_id);
CREATE INDEX idx_session_keys_public_key ON session_keys(public_key);
CREATE INDEX idx_session_keys_expires_at ON session_keys(expires_at);

-- 微支付记录表
CREATE TABLE micro_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_key_id UUID REFERENCES session_keys(id),
  amount DECIMAL(20, 6) NOT NULL,
  service TEXT NOT NULL,
  settled BOOLEAN DEFAULT FALSE,
  tx_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_micro_payments_session_key_id ON micro_payments(session_key_id);
CREATE INDEX idx_micro_payments_settled ON micro_payments(settled);
```

---

## 6. API 设计

### 6.1 创建 Session Key

```http
POST /api/session-keys
Authorization: Bearer {api_key}

Request:
{
  "agentId": "agent-123",
  "limitAmount": "50",
  "expiresIn": 2592000,
  "allowedContract": "0x..."
}

Response:
{
  "id": "sk-123",
  "publicKey": "0x...",
  "privateKey": "0x...",  // 只返回一次
  "limitAmount": "50",
  "expiresAt": "2026-03-05T00:00:00Z"
}
```

### 6.2 查询 Session Key

```http
GET /api/session-keys/{publicKey}

Response:
{
  "id": "sk-123",
  "publicKey": "0x...",
  "limitAmount": "50",
  "currentUsage": "12.34",
  "remainingBalance": "37.66",
  "expiresAt": "2026-03-05T00:00:00Z",
  "isFrozen": false
}
```

### 6.3 冻结 Session Key

```http
POST /api/session-keys/{publicKey}/freeze
Authorization: Bearer {api_key}

Request:
{
  "reason": "Suspicious activity"
}

Response:
{
  "success": true,
  "frozenAt": "2026-02-03T12:00:00Z"
}
```

---

## 7. 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Production                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Vercel      │  │  Docker      │  │  Supabase    │      │
│  │  (Next.js)   │  │  (Go Worker) │  │  (Database)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Redis       │  │  Polygon     │  │  Monitoring  │      │
│  │  (Upstash)   │  │  (Contract)  │  │  (Sentry)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

