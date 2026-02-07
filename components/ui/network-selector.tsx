/**
 * Network Selector Component
 * Select a network with visual badges
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ALL_NETWORKS } from "@/lib/networks"
import { NetworkBadge } from "@/components/vendors/network-badge"

interface NetworkSelectorProps {
  value: string
  onChange: (network: string) => void
  placeholder?: string
  includeAll?: boolean
  filterByType?: "EVM" | "TRON"
  className?: string
}

export function NetworkSelector({
  value,
  onChange,
  placeholder = "Select network",
  includeAll = false,
  filterByType,
  className = "",
}: NetworkSelectorProps) {
  // Filter networks by type if specified
  const networks = Object.entries(ALL_NETWORKS).filter(([key, config]) => {
    if (!filterByType) return true
    return config.type === filterByType
  })

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {value && value !== "all" ? (
            <div className="flex items-center">
              <NetworkBadge network={value} />
            </div>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {includeAll && (
          <SelectItem value="all">
            <span className="font-medium">All Networks</span>
          </SelectItem>
        )}
        {networks.map(([key, config]) => (
          <SelectItem key={key} value={key}>
            <div className="flex items-center space-x-2">
              <NetworkBadge network={key} />
              <span className="text-xs text-muted-foreground">
                {config.type}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Network Type Selector (EVM vs TRON)
 */
interface NetworkTypeSelectorProps {
  value: string
  onChange: (type: string) => void
  placeholder?: string
  includeAll?: boolean
  className?: string
}

export function NetworkTypeSelector({
  value,
  onChange,
  placeholder = "Select network type",
  includeAll = false,
  className = "",
}: NetworkTypeSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && (
          <SelectItem value="all">
            <span className="font-medium">All Types</span>
          </SelectItem>
        )}
        <SelectItem value="EVM">
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span>EVM Networks</span>
          </div>
        </SelectItem>
        <SelectItem value="TRON">
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span>TRON Network</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
