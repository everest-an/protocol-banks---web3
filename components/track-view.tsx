"use client"

import { useEffect } from "react"
import { track, type EventName } from "@/lib/analytics/events"

/** Fire one funnel event when a server-rendered page is viewed. */
export function TrackView({ name }: { name: EventName }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const source = params.get("ref") || params.get("utm_source")
    if (source) {
      try {
        localStorage.setItem("pb_ref", source.slice(0, 32))
      } catch {}
    }
    track(name)
  }, [name])

  return null
}
