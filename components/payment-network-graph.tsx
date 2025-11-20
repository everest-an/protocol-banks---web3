"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"

interface Node {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  type: "prime" | "sub" | "vendor" | "internal"
  label?: string
  value?: number
}

interface Link {
  source: number
  target: number
  value: number
}

export default function PaymentNetworkGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  // Configuration for the "Space Atlas" aesthetic
  const COLORS = {
    prime: "#06b6d4", // Cyan-500
    sub: "#14b8a6", // Teal-500
    vendor: "#ffffff", // White
    internal: "#64748b", // Slate-500
    bg: "#000000",
    link: "rgba(255, 255, 255, 0.1)",
    linkActive: "rgba(6, 182, 212, 0.4)",
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number
    let nodes: Node[] = []
    let links: Link[] = []

    // Initialize complex network data
    const initGraph = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      canvas.width = width
      canvas.height = height

      nodes = []
      links = []

      // Central Hub (Internal Wallet)
      nodes.push({
        id: 0,
        x: width / 2,
        y: height / 2,
        vx: 0,
        vy: 0,
        size: 8,
        type: "internal",
        label: "Treasury",
        value: 1000000,
      })

      // Create clusters
      const clusters = 5
      for (let i = 0; i < clusters; i++) {
        const angle = (i / clusters) * Math.PI * 2
        const dist = 100 + Math.random() * 50
        const cx = width / 2 + Math.cos(angle) * dist
        const cy = height / 2 + Math.sin(angle) * dist

        // Cluster Hub (Prime Contractor)
        const hubId = nodes.length
        nodes.push({
          id: hubId,
          x: cx,
          y: cy,
          vx: 0,
          vy: 0,
          size: 6,
          type: "prime",
          label: `Prime ${i + 1}`,
          value: 50000 + Math.random() * 50000,
        })

        links.push({ source: 0, target: hubId, value: 2 })

        // Satellite nodes (Sub-contractors & Vendors)
        const satellites = 5 + Math.floor(Math.random() * 8)
        for (let j = 0; j < satellites; j++) {
          const sAngle = Math.random() * Math.PI * 2
          const sDist = 30 + Math.random() * 40

          nodes.push({
            id: nodes.length,
            x: cx + Math.cos(sAngle) * sDist,
            y: cy + Math.sin(sAngle) * sDist,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2,
            size: Math.random() > 0.7 ? 4 : 2, // Rectangular dots
            type: Math.random() > 0.6 ? "sub" : "vendor",
            value: 1000 + Math.random() * 9000,
          })

          links.push({ source: hubId, target: nodes.length - 1, value: 1 })
        }
      }
    }

    const draw = () => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw Links
      links.forEach((link) => {
        const source = nodes[link.source]
        const target = nodes[link.target]

        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.strokeStyle = COLORS.link
        ctx.lineWidth = 0.5
        ctx.stroke()
      })

      // Draw Nodes (Rectangles as requested)
      nodes.forEach((node) => {
        // Physics update (gentle float)
        if (node.id !== 0) {
          // Don't move center
          node.x += node.vx
          node.y += node.vy

          // Soft boundaries
          const margin = 50
          if (node.x < margin) node.vx += 0.01
          if (node.x > canvas.width - margin) node.vx -= 0.01
          if (node.y < margin) node.vy += 0.01
          if (node.y > canvas.height - margin) node.vy -= 0.01
        }

        ctx.fillStyle = COLORS[node.type]
        // Draw rectangle centered at x,y
        ctx.fillRect(node.x - node.size / 2, node.y - node.size / 2, node.size, node.size)

        // Glow effect for Prime nodes
        if (node.type === "prime") {
          ctx.shadowColor = COLORS.prime
          ctx.shadowBlur = 10
          ctx.fillRect(node.x - node.size / 2, node.y - node.size / 2, node.size, node.size)
          ctx.shadowBlur = 0
        }
      })

      // Draw "Data Stream" particles (optional visual flair)
      const time = Date.now() / 1000
      links.forEach((link, i) => {
        if (i % 3 === 0) {
          // Only some links have active data
          const source = nodes[link.source]
          const target = nodes[link.target]
          const progress = ((time + i) % 2) / 2 // 0 to 1 loop

          const px = source.x + (target.x - source.x) * progress
          const py = source.y + (target.y - source.y) * progress

          ctx.fillStyle = "#ffffff"
          ctx.fillRect(px - 1, py - 1, 2, 2)
        }
      })

      animationFrameId = requestAnimationFrame(draw)
    }

    const handleResize = () => {
      initGraph()
    }

    window.addEventListener("resize", handleResize)
    initGraph()
    draw()

    return () => {
      window.removeEventListener("resize", handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-[500px] relative border-b border-border bg-black overflow-hidden group">
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {/* Overlay UI similar to reference image */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 bg-cyan-500 rounded-sm"></div>
          <span className="text-xs text-cyan-500 font-mono uppercase tracking-wider">Prime Wallets</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 bg-teal-500 rounded-sm"></div>
          <span className="text-xs text-teal-500 font-mono uppercase tracking-wider">Sub-Wallets</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-white rounded-sm"></div>
          <span className="text-xs text-gray-400 font-mono uppercase tracking-wider">Vendors</span>
        </div>
      </div>

      <div className="absolute top-6 right-6 z-10 text-right pointer-events-none">
        <h3 className="text-2xl font-bold text-white font-mono tracking-tight">NETWORK ATLAS</h3>
        <p className="text-xs text-gray-500 font-mono mt-1">LIVE TRANSACTION TOPOLOGY</p>
      </div>

      {/* Interactive Timeline Slider Mockup */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-64 h-8 bg-black/50 border border-white/10 rounded-full flex items-center px-4 backdrop-blur-sm">
        <div className="w-2 h-2 bg-cyan-500 rounded-full mr-2"></div>
        <div className="flex-1 h-0.5 bg-white/20 relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1/2 h-0.5 bg-cyan-500"></div>
          <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] cursor-pointer hover:scale-110 transition-transform"></div>
        </div>
        <span className="ml-3 text-xs font-mono text-cyan-500">2024</span>
      </div>
    </div>
  )
}
