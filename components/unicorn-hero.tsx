"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"

const SCRIPT_URL = "/unicorn-studio.umd.js"

let scriptPromise: Promise<void> | null = null

function loadUnicornStudio(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if ((window as any).UnicornStudio) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    // Check if the script is already fully loaded
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`) as HTMLScriptElement | null
    if (existing) {
      if ((window as any).UnicornStudio) {
        resolve()
        return
      }
      // Script tag exists but not yet loaded — wait for it
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("Failed to load Unicorn Studio")), { once: true })
      return
    }
    const script = document.createElement("script")
    script.src = SCRIPT_URL
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
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!resolvedTheme) return

    let cancelled = false

    async function init() {
      try {
        await loadUnicornStudio()
        if (cancelled || !mountedRef.current) return

        const US = (window as any).UnicornStudio
        if (!US?.addScene) {
          console.warn("[UnicornHero] UnicornStudio.addScene not available")
          return
        }

        // Verify container element exists
        const container = document.getElementById("unicorn-hero-canvas")
        if (!container) {
          console.warn("[UnicornHero] Container element #unicorn-hero-canvas not found")
          return
        }

        // Destroy previous scene instance before reinitialising
        if (sceneRef.current) {
          try { sceneRef.current.destroy?.() } catch { /* ignore */ }
          sceneRef.current = null
        }

        sceneRef.current = await US.addScene({
          elementId: "unicorn-hero-canvas",
          filePath: resolvedTheme === "dark"
            ? "/scenes/hero-discs-dark.json"
            : "/scenes/hero-discs.json",
          fps: 60,
          scale: 1,
          dpi: 1.5,
          lazyLoad: false,
          interactivity: {
            mouse: { disableMobile: true },
          },
        })
      } catch (err) {
        console.warn("[UnicornHero] Failed to initialise scene:", err)
      }
    }

    init()

    return () => {
      cancelled = true
      if (sceneRef.current) {
        try { sceneRef.current.destroy?.() } catch { /* ignore */ }
        sceneRef.current = null
      }
    }
  }, [resolvedTheme])

  return (
    <div
      id="unicorn-hero-canvas"
      className="absolute inset-0 z-[1] pointer-events-none hidden sm:block"
      aria-hidden="true"
    />
  )
}
