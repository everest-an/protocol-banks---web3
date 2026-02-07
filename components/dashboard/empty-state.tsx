/**
 * Empty State Component
 *
 * Unified empty state display for dashboard pages
 * Shows icon, title, description, and optional action
 */

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { FileX2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { glassIcon } from "@/lib/design-system/glass-styles"

export interface EmptyStateProps extends React.ComponentProps<"div"> {
  /** Icon to display */
  icon?: LucideIcon
  /** Empty state title */
  title: string
  /** Optional description */
  description?: string
  /** Optional action button - can be an object or React node */
  action?: React.ReactNode | {
    label: string
    onClick: () => void
    variant?: "default" | "outline" | "ghost"
  }
  /** Size variant */
  size?: "sm" | "md" | "lg"
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      icon: Icon = FileX2,
      title,
      description,
      action,
      size = "md",
      className,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: {
        container: "py-8",
        icon: "p-3",
        iconSize: "size-5",
        title: "text-base",
        description: "text-xs",
      },
      md: {
        container: "py-12",
        icon: "p-4",
        iconSize: "size-6",
        title: "text-lg",
        description: "text-sm",
      },
      lg: {
        container: "py-16",
        icon: "p-5",
        iconSize: "size-7",
        title: "text-xl",
        description: "text-base",
      },
    }[size]

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center",
          sizeClasses.container,
          className
        )}
        {...props}
      >
        {/* Icon */}
        <div
          className={cn(
            glassIcon.circle.default,
            sizeClasses.icon,
            "mb-4"
          )}
        >
          <Icon className={cn(sizeClasses.iconSize, "text-muted-foreground")} />
        </div>

        {/* Title */}
        <h3 className={cn("font-semibold text-foreground", sizeClasses.title)}>
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p
            className={cn(
              "mt-2 text-muted-foreground max-w-sm",
              sizeClasses.description
            )}
          >
            {description}
          </p>
        )}

        {/* Action Button */}
        {action && (
          React.isValidElement(action)
            ? <div className="mt-6">{action}</div>
            : (
              <Button
                onClick={(action as { onClick: () => void }).onClick}
                variant={(action as { variant?: "default" | "outline" | "ghost" }).variant || "default"}
                className="mt-6"
              >
                {(action as { label: string }).label}
              </Button>
            )
        )}
      </div>
    )
  }
)
EmptyState.displayName = "EmptyState"

export { EmptyState }
