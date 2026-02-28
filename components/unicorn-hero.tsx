"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"

const CDN_URL = "https://cdn.unicorn.studio/v2.0.5/unicornStudio.umd.js"

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
  const { resolvedTheme } = useTheme()
  const sceneRef = useRef<any>(null)

  useEffect(() => {
    if (!resolvedTheme) return

    let cancelled = false

    async function init() {
      try {
        await loadUnicornStudio()
        if (cancelled) return

        const US = (window as any).UnicornStudio
        if (!US?.addScene) return

        // Destroy previous scene instance before reinitialising
        sceneRef.current?.destroy?.()
        sceneRef.current = null

        sceneRef.current = await US.addScene({
          elementId: "unicorn-hero-canvas",
          filePath: resolvedTheme === "dark"
            ? "/scenes/hero-discs-dark.json"
            : "/scenes/hero-discs.json",
          fps: 60,
          scale: 1,
          dpi: 1.5,
          lazyLoad: false,
        })
      } catch (err) {
        console.warn("[UnicornHero]", err)
      }
    }

    init()

    return () => {
      cancelled = true
      sceneRef.current?.destroy?.()
      sceneRef.current = null
    }
  }, [resolvedTheme])

  return (
    <div
      id="unicorn-hero-canvas"
      className="absolute inset-0 pointer-events-none hidden sm:block overflow-hidden"
      aria-hidden="true"
    />
  )
}
