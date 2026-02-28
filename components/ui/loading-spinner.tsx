import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  text?: string
  className?: string
  fullPage?: boolean
}

const sizeMap = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-8 w-8",
}

export function LoadingSpinner({ size = "md", text, className, fullPage }: LoadingSpinnerProps) {
  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={cn("animate-spin text-muted-foreground", sizeMap.lg)} />
          {text && <p className="text-sm text-muted-foreground">{text}</p>}
        </div>
      </div>
    )
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Loader2 className={cn("animate-spin", sizeMap[size])} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </span>
  )
}
