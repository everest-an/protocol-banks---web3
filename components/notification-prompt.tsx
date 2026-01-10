"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Bell, X } from "lucide-react"
import { pushService } from "@/lib/push-notifications"

export function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return
    }

    setPermission(Notification.permission)

    // Show prompt if permission not yet requested and user is on mobile
    if (Notification.permission === "default") {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const hasSeenPrompt = localStorage.getItem("notification-prompt-dismissed")

      if (isMobile && !hasSeenPrompt) {
        // Delay showing prompt
        const timer = setTimeout(() => setShowPrompt(true), 3000)
        return () => clearTimeout(timer)
      }
    }
  }, [])

  const handleEnable = async () => {
    const result = await pushService.requestPermission()
    setPermission(result)

    if (result === "granted") {
      await pushService.init()
      // In production, you would subscribe with your VAPID key
      // await pushService.subscribe(VAPID_PUBLIC_KEY)
    }

    setShowPrompt(false)
  }

  const handleDismiss = () => {
    localStorage.setItem("notification-prompt-dismissed", "true")
    setShowPrompt(false)
  }

  if (!showPrompt || permission === "granted") {
    return null
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 md:hidden animate-in slide-in-from-bottom-4">
      <Card className="bg-card/95 backdrop-blur-lg border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm">Enable Notifications</h4>
              <p className="text-xs text-muted-foreground mt-1">Get notified when transactions need your signature</p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleEnable}>
                  Enable
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss}>
                  Not Now
                </Button>
              </div>
            </div>
            <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
