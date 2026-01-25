/**
 * Batch Transfer Progress Dialog
 * 批量转账进度显示组件
 */

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type BatchTransferStep =
  | 'idle'
  | 'approving'
  | 'approved'
  | 'transferring'
  | 'success'
  | 'error';

export interface BatchTransferProgressProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: BatchTransferStep;
  currentRecipient?: number;
  totalRecipients: number;
  txHash?: string;
  errorMessage?: string;
  chainId?: number;
}

export function BatchTransferProgress({
  open,
  onOpenChange,
  step,
  currentRecipient = 0,
  totalRecipients,
  txHash,
  errorMessage,
  chainId = 42161,
}: BatchTransferProgressProps) {
  const getProgressValue = () => {
    switch (step) {
      case 'idle':
        return 0;
      case 'approving':
        return 25;
      case 'approved':
        return 50;
      case 'transferring':
        return 75;
      case 'success':
        return 100;
      case 'error':
        return 0;
      default:
        return 0;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'idle':
        return '准备批量转账...';
      case 'approving':
        return '等待代币授权...';
      case 'approved':
        return '授权成功！';
      case 'transferring':
        return '正在执行批量转账...';
      case 'success':
        return '批量转账成功！';
      case 'error':
        return '转账失败';
      default:
        return '处理中...';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'idle':
        return '正在准备批量转账交易...';
      case 'approving':
        return '请在钱包中确认代币授权。这是一次性操作，下次无需重复授权。';
      case 'approved':
        return '代币授权已确认，准备发送转账...';
      case 'transferring':
        return `正在向 ${totalRecipients} 个地址发送代币...`;
      case 'success':
        return `成功向 ${totalRecipients} 个地址发送了代币！`;
      case 'error':
        return errorMessage || '批量转账失败，请重试';
      default:
        return '';
    }
  };

  const getBlockExplorerUrl = () => {
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io/tx/',
      42161: 'https://arbiscan.io/tx/',
      8453: 'https://basescan.org/tx/',
      137: 'https://polygonscan.com/tx/',
      56: 'https://bscscan.com/tx/',
    };
    return explorers[chainId] || explorers[42161];
  };

  const canClose = step === 'success' || step === 'error' || step === 'idle';

  return (
    <Dialog open={open} onOpenChange={canClose ? onOpenChange : undefined}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => !canClose && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {step === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
            {(step === 'approving' || step === 'transferring') && (
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            )}
            {getStepTitle()}
          </DialogTitle>
          <DialogDescription>{getStepDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress Bar */}
          {step !== 'error' && (
            <div className="space-y-2">
              <Progress value={getProgressValue()} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{getProgressValue()}%</span>
                {step === 'transferring' && <span>{totalRecipients} 个接收地址</span>}
              </div>
            </div>
          )}

          {/* Step Indicators */}
          <div className="space-y-3">
            {/* Step 1: Approval */}
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                  step === 'approving'
                    ? 'border-blue-500 bg-blue-500/10'
                    : ['approved', 'transferring', 'success'].includes(step)
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-muted bg-muted'
                }`}
              >
                {['approved', 'transferring', 'success'].includes(step) ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : step === 'approving' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">1</span>
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">代币授权</div>
                <div className="text-xs text-muted-foreground">
                  {step === 'approving' && '等待确认...'}
                  {['approved', 'transferring', 'success'].includes(step) && '已完成'}
                  {['idle', 'error'].includes(step) && '待处理'}
                </div>
              </div>
            </div>

            {/* Step 2: Batch Transfer */}
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                  step === 'transferring'
                    ? 'border-blue-500 bg-blue-500/10'
                    : step === 'success'
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-muted bg-muted'
                }`}
              >
                {step === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : step === 'transferring' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">2</span>
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">批量转账</div>
                <div className="text-xs text-muted-foreground">
                  {step === 'transferring' && `发送中...`}
                  {step === 'success' && `已完成 (${totalRecipients} 笔)`}
                  {!['transferring', 'success'].includes(step) && '待处理'}
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Hash */}
          {txHash && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 overflow-hidden">
                  <div className="text-xs font-medium text-muted-foreground mb-1">交易哈希</div>
                  <div className="font-mono text-xs truncate">{txHash}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="shrink-0"
                >
                  <a
                    href={`${getBlockExplorerUrl()}${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {step === 'error' && errorMessage && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
              <div className="text-sm text-red-500">{errorMessage}</div>
            </div>
          )}

          {/* Success Summary */}
          {step === 'success' && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">转账完成</span>
              </div>
              <div className="text-sm text-muted-foreground">
                已成功向 {totalRecipients} 个地址发送代币
              </div>
            </div>
          )}

          {/* Actions */}
          {canClose && (
            <div className="flex justify-end gap-2 pt-2">
              {step === 'error' && (
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  关闭
                </Button>
              )}
              {step === 'success' && (
                <>
                  {txHash && (
                    <Button
                      variant="outline"
                      asChild
                    >
                      <a
                        href={`${getBlockExplorerUrl()}${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        查看交易
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </a>
                    </Button>
                  )}
                  <Button onClick={() => onOpenChange(false)}>
                    完成
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
