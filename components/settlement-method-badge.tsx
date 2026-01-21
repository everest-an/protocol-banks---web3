"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Zap, Server } from "lucide-react"

interface SettlementMethodBadgeProps {
  method: "cdp" | "relayer"
  fee?: string
  chainId?: number
}

export function SettlementMethodBadge({ method, fee, chainId }: SettlementMethodBadgeProps) {
  const isCDP = method === "cdp" || chainId === 8453

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isCDP ? "default" : "secondary"}
            className={isCDP ? "bg-green-500 hover:bg-green-600" : ""}
          >
            {isCDP ? (
              <>
                <Zap className="h-3 w-3 mr-1" />
                0 手续费
              </>
            ) : (
              <>
                <Server className="h-3 w-3 mr-1" />
                Fee: {fee || "0.1%"}
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isCDP
              ? "Base 链通过 CDP 结算，无需手续费"
              : `通过 Relayer 结算，手续费 ${fee || "0.1%"}`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
