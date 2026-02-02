"use client";

import { useState } from "react";
import { useSessionKey } from "@/hooks/use-session-key";
import { SessionKeyCard } from "@/components/session-key-card";
import { CreateSessionDialog } from "@/components/create-session-dialog";
import type { CreateSessionKeyRequest } from "@/types/session-key";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppKitAccount } from "@reown/appkit/react";
import { Plus, RefreshCw, Key, AlertCircle } from "lucide-react";

export default function SessionKeysPage() {
  const { address, isConnected } = useAppKitAccount();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const {
    sessions,
    isLoading,
    error,
    fetchSessions,
    createSession,
    freezeSession,
    unfreezeSession,
    revokeSession,
    topUpBudget,
    formatBudget,
    supportedChains,
    switchChain,
    currentChainId,
  } = useSessionKey({ chainId: 8453, autoFetch: true });

  const currentChain = supportedChains[currentChainId];

  // Stats
  const activeSessions = sessions.filter((s) => s.isActive && !s.isFrozen);
  const frozenSessions = sessions.filter((s) => s.isActive && s.isFrozen);
  const totalBudgetAllocated = sessions.reduce((sum, s) => sum + s.maxBudget, 0n);
  const totalBudgetUsed = sessions.reduce((sum, s) => sum + s.usedBudget, 0n);

  if (!isConnected) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Key className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">连接钱包</h2>
            <p className="text-muted-foreground text-center max-w-md">
              请先连接您的钱包以管理 AI Agent 会话密钥
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Agent 会话密钥</h1>
          <p className="text-muted-foreground mt-1">
            管理您的 AI Agent 预算和权限
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={currentChainId.toString()}
            onValueChange={(v) => switchChain(parseInt(v))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="选择网络" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(supportedChains).map((chain) => (
                <SelectItem key={chain.chainId} value={chain.chainId.toString()}>
                  {chain.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchSessions} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建会话
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>活跃会话</CardDescription>
            <CardTitle className="text-3xl">{activeSessions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已冻结</CardDescription>
            <CardTitle className="text-3xl text-orange-500">{frozenSessions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总预算分配</CardDescription>
            <CardTitle className="text-2xl">
              {formatBudget(totalBudgetAllocated)} {currentChain?.nativeCurrency.symbol}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已使用</CardDescription>
            <CardTitle className="text-2xl">
              {formatBudget(totalBudgetUsed)} {currentChain?.nativeCurrency.symbol}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Sessions List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">会话列表</h2>
          <Badge variant="secondary">{currentChain?.name}</Badge>
        </div>

        {isLoading && sessions.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Key className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无会话密钥</h3>
              <p className="text-muted-foreground text-center mb-4">
                创建一个会话密钥，让 AI Agent 可以在预算内自主操作
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                创建第一个会话
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <SessionKeyCard
                key={session.sessionId}
                session={session}
                currencySymbol={currentChain?.nativeCurrency.symbol || "ETH"}
                onFreeze={(reason: string) => freezeSession(session.sessionId, reason)}
                onUnfreeze={() => unfreezeSession(session.sessionId)}
                onRevoke={() => revokeSession(session.sessionId)}
                onTopUp={(amount: string) => topUpBudget(session.sessionId, amount)}
                formatBudget={formatBudget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Session Dialog */}
      <CreateSessionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={async (config: Omit<CreateSessionKeyRequest, "chainId">) => {
          const sessionId = await createSession(config);
          if (sessionId) {
            setCreateDialogOpen(false);
          }
        }}
        currencySymbol={currentChain?.nativeCurrency.symbol || "ETH"}
        isLoading={isLoading}
      />
    </div>
  );
}
