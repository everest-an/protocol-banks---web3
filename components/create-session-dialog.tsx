"use client";

import { useState } from "react";
import { CreateSessionKeyRequest } from "@/types/session-key";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Info } from "lucide-react";
import { ethers } from "ethers";

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (config: Omit<CreateSessionKeyRequest, "chainId">) => Promise<void>;
  currencySymbol: string;
  isLoading: boolean;
}

const DURATION_OPTIONS = [
  { label: "1 小时", value: 1 },
  { label: "6 小时", value: 6 },
  { label: "12 小时", value: 12 },
  { label: "1 天", value: 24 },
  { label: "3 天", value: 72 },
  { label: "7 天", value: 168 },
  { label: "14 天", value: 336 },
  { label: "30 天", value: 720 },
];

export function CreateSessionDialog({
  open,
  onOpenChange,
  onSubmit,
  currencySymbol,
  isLoading,
}: CreateSessionDialogProps) {
  const [sessionKeyAddress, setSessionKeyAddress] = useState("");
  const [maxBudgetEth, setMaxBudgetEth] = useState("");
  const [maxSingleTxEth, setMaxSingleTxEth] = useState("");
  const [durationHours, setDurationHours] = useState(24);
  const [allowedTokens, setAllowedTokens] = useState<string[]>([]);
  const [allowedTargets, setAllowedTargets] = useState<string[]>([]);
  const [newToken, setNewToken] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!sessionKeyAddress) {
      newErrors.sessionKeyAddress = "请输入会话密钥地址";
    } else if (!ethers.isAddress(sessionKeyAddress)) {
      newErrors.sessionKeyAddress = "无效的以太坊地址";
    }

    if (!maxBudgetEth) {
      newErrors.maxBudgetEth = "请输入最大预算";
    } else if (parseFloat(maxBudgetEth) <= 0) {
      newErrors.maxBudgetEth = "预算必须大于 0";
    }

    if (!maxSingleTxEth) {
      newErrors.maxSingleTxEth = "请输入单笔上限";
    } else if (parseFloat(maxSingleTxEth) <= 0) {
      newErrors.maxSingleTxEth = "单笔上限必须大于 0";
    } else if (parseFloat(maxSingleTxEth) > parseFloat(maxBudgetEth || "0")) {
      newErrors.maxSingleTxEth = "单笔上限不能超过最大预算";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    await onSubmit({
      sessionKeyAddress,
      maxBudgetEth,
      maxSingleTxEth,
      durationHours,
      allowedTokens: allowedTokens.filter((t) => ethers.isAddress(t)),
      allowedTargets: allowedTargets.filter((t) => ethers.isAddress(t)),
    });
  };

  const handleAddToken = () => {
    if (newToken && ethers.isAddress(newToken) && !allowedTokens.includes(newToken)) {
      setAllowedTokens([...allowedTokens, newToken]);
      setNewToken("");
    }
  };

  const handleAddTarget = () => {
    if (newTarget && ethers.isAddress(newTarget) && !allowedTargets.includes(newTarget)) {
      setAllowedTargets([...allowedTargets, newTarget]);
      setNewTarget("");
    }
  };

  const handleRemoveToken = (token: string) => {
    setAllowedTokens(allowedTokens.filter((t) => t !== token));
  };

  const handleRemoveTarget = (target: string) => {
    setAllowedTargets(allowedTargets.filter((t) => t !== target));
  };

  const handleGenerateWallet = () => {
    const wallet = ethers.Wallet.createRandom();
    setSessionKeyAddress(wallet.address);
  };

  const resetForm = () => {
    setSessionKeyAddress("");
    setMaxBudgetEth("");
    setMaxSingleTxEth("");
    setDurationHours(24);
    setAllowedTokens([]);
    setAllowedTargets([]);
    setNewToken("");
    setNewTarget("");
    setErrors({});
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>创建会话密钥</DialogTitle>
          <DialogDescription>
            为 AI Agent 创建一个带有预算限制的会话密钥
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">基本设置</TabsTrigger>
            <TabsTrigger value="advanced">高级设置</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* Session Key Address */}
            <div className="space-y-2">
              <Label htmlFor="session-key-address">会话密钥地址</Label>
              <div className="flex gap-2">
                <Input
                  id="session-key-address"
                  placeholder="0x..."
                  value={sessionKeyAddress}
                  onChange={(e) => setSessionKeyAddress(e.target.value)}
                  className={errors.sessionKeyAddress ? "border-destructive" : ""}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateWallet}
                  title="生成随机钱包"
                >
                  生成
                </Button>
              </div>
              {errors.sessionKeyAddress && (
                <p className="text-sm text-destructive">{errors.sessionKeyAddress}</p>
              )}
              <p className="text-xs text-muted-foreground">
                AI Agent 将使用此地址签名操作
              </p>
            </div>

            {/* Max Budget */}
            <div className="space-y-2">
              <Label htmlFor="max-budget">最大预算 ({currencySymbol})</Label>
              <Input
                id="max-budget"
                type="number"
                step="0.01"
                min="0"
                placeholder="例如：10"
                value={maxBudgetEth}
                onChange={(e) => setMaxBudgetEth(e.target.value)}
                className={errors.maxBudgetEth ? "border-destructive" : ""}
              />
              {errors.maxBudgetEth && (
                <p className="text-sm text-destructive">{errors.maxBudgetEth}</p>
              )}
            </div>

            {/* Max Single Tx */}
            <div className="space-y-2">
              <Label htmlFor="max-single-tx">单笔上限 ({currencySymbol})</Label>
              <Input
                id="max-single-tx"
                type="number"
                step="0.01"
                min="0"
                placeholder="例如：1"
                value={maxSingleTxEth}
                onChange={(e) => setMaxSingleTxEth(e.target.value)}
                className={errors.maxSingleTxEth ? "border-destructive" : ""}
              />
              {errors.maxSingleTxEth && (
                <p className="text-sm text-destructive">{errors.maxSingleTxEth}</p>
              )}
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>有效期</Label>
              <Select
                value={durationHours.toString()}
                onValueChange={(v) => setDurationHours(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            {/* Info */}
            <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                设置代币和合约白名单可以限制 AI Agent 的操作范围。留空表示允许所有。
              </p>
            </div>

            {/* Allowed Tokens */}
            <div className="space-y-2">
              <Label>允许的代币地址</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="代币合约地址 0x..."
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddToken}
                  disabled={!newToken || !ethers.isAddress(newToken)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {allowedTokens.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {allowedTokens.map((token) => (
                    <Badge key={token} variant="secondary" className="font-mono text-xs">
                      {token.slice(0, 6)}...{token.slice(-4)}
                      <button
                        onClick={() => handleRemoveToken(token)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Allowed Targets */}
            <div className="space-y-2">
              <Label>允许的合约地址</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="目标合约地址 0x..."
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddTarget}
                  disabled={!newTarget || !ethers.isAddress(newTarget)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {allowedTargets.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {allowedTargets.map((target) => (
                    <Badge key={target} variant="secondary" className="font-mono text-xs">
                      {target.slice(0, 6)}...{target.slice(-4)}
                      <button
                        onClick={() => handleRemoveTarget(target)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "创建中..." : "创建会话密钥"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
