// Push notification service for multi-sig transaction alerts

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export class PushNotificationService {
  private static instance: PushNotificationService
  private swRegistration: ServiceWorkerRegistration | null = null

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService()
    }
    return PushNotificationService.instance
  }

  async init(): Promise<boolean> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return false
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register("/sw.js")
      return true
    } catch (error) {
      console.error("Service worker registration failed:", error)
      return false
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      return "denied"
    }

    if (Notification.permission === "granted") {
      return "granted"
    }

    return await Notification.requestPermission()
  }

  async subscribe(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!this.swRegistration) {
      await this.init()
    }

    if (!this.swRegistration) {
      return null
    }

    try {
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
      })

      const json = subscription.toJSON()
      return {
        endpoint: json.endpoint!,
        keys: {
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
        },
      }
    } catch (error) {
      console.error("Push subscription failed:", error)
      return null
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.swRegistration) {
      return false
    }

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }
      return true
    } catch (error) {
      console.error("Push unsubscription failed:", error)
      return false
    }
  }

  private urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")

    const rawData = window.atob(base64)
    const outputArray = new ArrayBuffer(rawData.length)
    const view = new Uint8Array(outputArray)

    for (let i = 0; i < rawData.length; ++i) {
      view[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  // Show local notification (for testing)
  showLocalNotification(title: string, options?: NotificationOptions): void {
    if (!this.swRegistration) {
      return
    }

    this.swRegistration.showNotification(title, {
      icon: "/logo.png",
      badge: "/logo.png",
      ...options,
    })
  }
}

export const pushService = PushNotificationService.getInstance()
