"use client"

import { useEffect } from "react"
import { track, type EventName } from "@/lib/analytics/events"

/** Fire one funnel event when a server-rendered page is viewed. */
export function TrackView({ name }: { name: EventName }) {
  useEffect(() => {
    track(name)
  }, [name])

  return null
}
