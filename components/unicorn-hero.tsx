"use client"

import { useEffect, useRef } from "react"

const CDN_URL = "https://cdn.unicorn.studio/v2.0.5/unicornStudio.umd.js"

// Singleton script-load promise so we never insert the tag twice
let scriptPromise: Promise<void> | null = null

function loadUnicornStudio(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if ((window as any).UnicornStudio) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CDN_URL}"]`)
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", reject)
      return
    }
    const script = document.createElement("script")
    script.src = CDN_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Unicorn Studio"))
    document.head.appendChild(script)
  })

  return scriptPromise
}

export function UnicornHero() {
  const sceneRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        await loadUnicornStudio()
        if (cancelled) return

        const res = await fetch("/scenes/hero-discs.json")
        const data = await res.json()
        if (cancelled) return

        const US = (window as any).UnicornStudio
        if (!US?.addScene) return

        sceneRef.current = await US.addScene({
          elementId: "unicorn-hero-canvas",
          data,
          fps: 60,
          scale: 1,
          dpi: 1.5,
          lazyLoad: false,
        })
      } catch {
        // Fail silently — page renders fine without the animation
      }
    }

    init()

    return () => {
      cancelled = true
      sceneRef.current?.destroy?.()
      sceneRef.current = null
    }
  }, [])

  return (
    <div
      id="unicorn-hero-canvas"
      className="absolute inset-0 pointer-events-none dark:hidden"
      aria-hidden="true"
    />
  )
}
