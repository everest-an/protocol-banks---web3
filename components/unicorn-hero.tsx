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

/** Patch the gradient layer background color in the compiled GLSL */
function patchBgColor(data: any, isDark: boolean): any {
  const cloned = JSON.parse(JSON.stringify(data))
  const gradient = cloned.history?.find((l: any) => l.id === "gradient")
  if (gradient?.compiledFragmentShaders?.[0]) {
    gradient.compiledFragmentShaders[0] = gradient.compiledFragmentShaders[0].replace(
      /return vec3\([^)]+\);(\s*\}void main)/,
      isDark
        ? "return vec3(0.0, 0.0, 0.0);$1"
        : "return vec3(0.8549019607843137, 0.9803921568627451, 1.0);$1"
    )
  }
  return cloned
}

export function UnicornHero() {
  const sceneRef = useRef<any>(null)
  const dataRef = useRef<any>(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    // Wait until next-themes has resolved the theme
    if (!resolvedTheme) return

    let cancelled = false

    async function init() {
      try {
        await loadUnicornStudio()
        if (cancelled) return

        // Fetch JSON only once, cache in ref
        if (!dataRef.current) {
          const res = await fetch("/scenes/hero-discs.json")
          dataRef.current = await res.json()
        }
        if (cancelled) return

        const US = (window as any).UnicornStudio
        if (!US?.addScene) return

        sceneRef.current = await US.addScene({
          elementId: "unicorn-hero-canvas",
          data: patchBgColor(dataRef.current, resolvedTheme === "dark"),
          fps: 60,
          scale: 1,
          dpi: 1.5,
          lazyLoad: false,
        })
      } catch {
        // Fail silently — page renders fine without the animation
      }
    }

    // Destroy previous scene before re-init on theme switch
    sceneRef.current?.destroy?.()
    sceneRef.current = null

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
      className="absolute inset-0 pointer-events-none hidden sm:block"
      aria-hidden="true"
    />
  )
}
