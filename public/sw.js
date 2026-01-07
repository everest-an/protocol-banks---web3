// Service Worker for Push Notifications

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener("push", (event) => {
  if (!event.data) return

  const data = event.data.json()

  const options = {
    body: data.body || "You have a new notification",
    icon: "/logo.png",
    badge: "/logo.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/",
    },
    actions: data.actions || [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
    tag: data.tag || "default",
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(data.title || "Protocol Banks", options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  if (event.action === "dismiss") {
    return
  }

  const url = event.notification.data?.url || "/"

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    }),
  )
})
