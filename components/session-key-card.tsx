"use client";

import { useState } from "react";
import { SessionKeyDetails } from "@/types/session-key";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MoreVertical,
  Snowflake,
  Play,
  Trash2,
  Plus,
  Clock,
  Wallet,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface SessionKeyCardProps {
  session: SessionKeyDetails;
  currencySymbol: string;
  onFreeze: (reason: string) => Promise<boolean>;
  onUnfreeze: () => Promise<boolean>;
  onRevoke: () => Promise<boolean>;
  onTopUp: (amount: string) => Promise<boolean>;
  formatBudget: (wei: bigint) => string;
}

export function SessionKeyCard({
  session,
  currencySymbol,
  onFreeze,
  onUnfreeze,
  onRevoke,
  onTopUp,
  formatBudget,
}: SessionKeyCardProps) {
  const [actionDialog, setActionDialog] = useState<
    "freeze" | "revoke" | "topup" | null
  >(null);
  const [freezeReason, setFreezeReason] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate usage percentage
  const usagePercent =
    session.maxBudget > 0n
      ? Number((session.usedBudget * 100n) / session.maxBudget)
      : 0;

  // Check if expired
  const isExpired = session.expiresAt * 1000 < Date.now();
  const expiresIn = formatDistanceToNow(new Date(session.expiresAt * 1000), {
    addSuffix: true,
    locale: zhCN,
  });

  // Determine status
  const getStatus = () => {
    if (!session.isActive) return { label: "已撤销", variant: "destructive" as const, icon: XCircle };
    if (session.isFrozen) return { label: "已冻结", variant: "warning" as const, icon: Snowflake };
    if (isExpired) return { label: "已过期", variant: "secondary" as const, icon: Clock };
    return { label: "活跃", variant: "default" as const, icon: CheckCircle };
  };

  const status = getStatus();

  // Handle actions
  const handleFreeze = async () => {
    if (!freezeReason.trim()) return;
    setIsProcessing(true);
    const success = await onFreeze(freezeReason);
    setIsProcessing(false);
    if (success) {
      setActionDialog(null);
      setFreezeReason("");
    }
  };

  const handleUnfreeze = async () => {
    setIsProcessing(true);
    await onUnfreeze();
    setIsProcessing(false);
  };

  const handleRevoke = async () => {
    setIsProcessing(true);
    const success = await onRevoke();
    setIsProcessing(false);
    if (success) {
      setActionDialog(null);
    }
  };

  const handleTopUp = async () => {
    if (!topUpAmount || parseFloat(topUpAmount) <= 0) return;
    setIsProcessing(true);
    const success = await onTopUp(topUpAmount);
    setIsProcessing(false);
    if (success) {
      setActionDialog(null);
      setTopUpAmount("");
    }
  };

  return (
    <>
      <Card className={session.isFrozen ? "border-orange-500" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-mono">
                {session.sessionKey.slice(0, 6)}...{session.sessionKey.slice(-4)}
              </CardTitle>
              <CardDescription className="text-xs">
                ID: {session.sessionId.slice(0, 10)}...
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={status.variant === "warning" ? "outline" : status.variant}>
                <status.icon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {session.isActive && !session.isFrozen && !isExpired && (
                    <>
                      <DropdownMenuItem onClick={() => setActionDialog("topup")}>
                        <Plus className="h-4 w-4 mr-2" />
                        追加预算
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActionDialog("freeze")}>
                        <Snowflake className="h-4 w-4 mr-2" />
                        冻结
                      </DropdownMenuItem>
                    </>
                  )}
                  {session.isActive && session.isFrozen && (
                    <DropdownMenuItem onClick={handleUnfreeze}>
                      <Play className="h-4 w-4 mr-2" />
                      解冻
                    </DropdownMenuItem>
                  )}
                  {session.isActive && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setActionDialog("revoke")}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        撤销
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Budget Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">预算使用</span>
              <span className="font-medium">
                {formatBudget(session.usedBudget)} / {formatBudget(session.maxBudget)} {currencySymbol}
              </span>
            </div>
            <Progress
              value={usagePercent}
              className={usagePercent > 90 ? "[&>div]:bg-destructive" : ""}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>已用 {usagePercent.toFixed(1)}%</span>
              <span>剩余 {formatBudget(session.remainingBudget)} {currencySymbol}</span>
            </div>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground text-xs">单笔上限</p>
                <p className="font-medium">
                  {formatBudget(session.maxSingleTx)} {currencySymbol}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground text-xs">
                  {isExpired ? "已过期" : "过期时间"}
                </p>
                <p className="font-medium">{expiresIn}</p>
              </div>
            </div>
          </div>

          {/* Allowed Tokens/Targets */}
          {(session.allowedTokens.length > 0 || session.allowedTargets.length > 0) && (
            <div className="text-xs text-muted-foreground">
              {session.allowedTokens.length > 0 && (
                <p>允许代币: {session.allowedTokens.length} 个</p>
              )}
              {session.allowedTargets.length > 0 && (
                <p>允许合约: {session.allowedTargets.length} 个</p>
              )}
            </div>
          )}
        </CardContent>

        {session.isFrozen && (
          <CardFooter className="pt-0">
            <div className="flex items-center gap-2 text-orange-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>此会话已被冻结，AI Agent 无法执行操作</span>
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Freeze Dialog */}
      <Dialog open={actionDialog === "freeze"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>冻结会话密钥</DialogTitle>
            <DialogDescription>
              冻结后，AI Agent 将无法使用此会话执行任何操作。您可以随时解冻。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="freeze-reason">冻结原因</Label>
              <Textarea
                id="freeze-reason"
                placeholder="例如：检测到异常活动..."
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleFreeze}
              disabled={!freezeReason.trim() || isProcessing}
            >
              {isProcessing ? "处理中..." : "确认冻结"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={actionDialog === "revoke"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>撤销会话密钥</DialogTitle>
            <DialogDescription>
              撤销后，此会话密钥将永久失效，剩余预算不会自动退回。此操作不可逆。
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium">确定要撤销此会话吗？</p>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              剩余预算: {formatBudget(session.remainingBudget)} {currencySymbol}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={isProcessing}>
              {isProcessing ? "处理中..." : "确认撤销"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top Up Dialog */}
      <Dialog open={actionDialog === "topup"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>追加预算</DialogTitle>
            <DialogDescription>
              为此会话密钥追加预算，让 AI Agent 可以继续执行操作。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topup-amount">追加金额 ({currencySymbol})</Label>
              <Input
                id="topup-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="例如：1.5"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              当前预算: {formatBudget(session.maxBudget)} {currencySymbol}
              <br />
              追加后: {formatBudget(session.maxBudget + BigInt(Math.floor(parseFloat(topUpAmount || "0") * 1e18)))} {currencySymbol}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              取消
            </Button>
            <Button
              onClick={handleTopUp}
              disabled={!topUpAmount || parseFloat(topUpAmount) <= 0 || isProcessing}
            >
              {isProcessing ? "处理中..." : "确认追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
