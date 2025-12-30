"use client"

import { useState, useMemo, useEffect, useRef, type MouseEvent, type WheelEvent } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ExternalLink, Layers, Share2 } from "lucide-react"

interface Vendor {
  id: string
  name?: string
  company_name?: string
  wallet_address: string
  totalReceived?: number
  monthly_volume?: number
  transactionCount?: number
  transaction_count?: number
  category?: string
  notes?: string
  tier?: "subsidiary" | "partner" | "vendor"
  parentId?: string
  email?: string
}

interface Node {
  id: string
  x: number
  y: number
  r: number
  data: Vendor | null
  type: "root" | "subsidiary" | "partner" | "vendor"
  color: string
}

interface Edge {
  source: Node
  target: Node
  weight: number
}

interface NetworkGraphProps {
  vendors: Vendor[]
  userAddress?: string
  onPaymentRequest?: (vendor: Vendor) => void
}

const getVendorName = (vendor: Vendor | null): string => {
  if (!vendor) return "Unknown"
  return vendor.company_name || vendor.name || "Unknown"
}

export function NetworkGraph({ vendors, userAddress, onPaymentRequest }: NetworkGraphProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Advanced Layout Calculation
  const { nodes, edges } = useMemo(() => {
    if (!vendors.length) return { nodes: [], edges: [] }

    const width = dimensions.width || 1200
    const height = dimensions.height || 800
    const centerX = width * 0.45
    const centerY = height / 2

    // Root Node (Your Company)
    const rootNode: Node = {
      id: "root",
      x: centerX,
      y: centerY,
      r: 40,
      data: { company_name: "MY ORGANIZATION", wallet_address: userAddress || "0x..." } as Vendor,
      type: "root",
      color: "#ffffff",
    }

    const processedNodes: Node[] = [rootNode]
    const processedEdges: Edge[] = []

    const findParent = (id?: string) => processedNodes.find((n) => n.id === id) || rootNode

    // 1. Process Subsidiaries (Inner Ring - Green)
    const subsidiaries = vendors.filter((v) => v.tier === "subsidiary")
    subsidiaries.forEach((v, i) => {
      const angle = (i / Math.max(subsidiaries.length, 1)) * Math.PI * 2 - Math.PI / 2
      const radius = 180
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius
      const node: Node = {
        id: v.id,
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        r: 25,
        data: v,
        type: "subsidiary",
        color: "#10b981",
      }
      processedNodes.push(node)
      processedEdges.push({ source: rootNode, target: node, weight: 3 })
    })

    // 2. Process Partners (Middle Ring - Blue)
    const partners = vendors.filter((v) => v.tier === "partner")
    partners.forEach((v, i) => {
      const parent = findParent(v.parentId)
      const angleOffset = (Math.random() - 0.5) * 0.6
      let baseAngle = Math.atan2(parent.y - centerY, parent.x - centerX)
      if (parent.id === "root") baseAngle = (i / Math.max(partners.length, 1)) * Math.PI * 2

      const angle = baseAngle + angleOffset
      const radius = 320 + Math.random() * 50
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius

      const node: Node = {
        id: v.id,
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        r: 15,
        data: v,
        type: "partner",
        color: "#3b82f6",
      }
      processedNodes.push(node)
      processedEdges.push({ source: parent, target: node, weight: 2 })
    })

    // 3. Process Vendors (Outer Cloud - Gray)
    const regularVendors = vendors.filter((v) => !v.tier || v.tier === "vendor")
    regularVendors.forEach((v, i) => {
      const parent = findParent(v.parentId)
      const baseAngle = Math.atan2(parent.y - centerY, parent.x - centerX)
      const angle = baseAngle + (Math.random() - 0.5) * 1.2
      const radius = 450 + Math.random() * 120
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius

      const node: Node = {
        id: v.id,
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        r: 6 + Math.random() * 4,
        data: v,
        type: "vendor",
        color: "#71717a",
      }
      processedNodes.push(node)
      processedEdges.push({ source: parent, target: node, weight: 1 })
    })

    return { nodes: processedNodes, edges: processedEdges }
  }, [vendors, dimensions, userAddress])

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current
        setDimensions({ width: clientWidth, height: clientHeight })
      }
    }
    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const scaleAmount = -e.deltaY * 0.001
    const newScale = Math.min(Math.max(0.5, transform.k + scaleAmount), 4)
    setTransform((prev) => ({ ...prev, k: newScale }))
  }

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }))
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const totalFlow = useMemo(() => {
    return vendors.reduce((acc, v) => acc + (v.monthly_volume || v.totalReceived || 0), 0)
  }, [vendors])

  return (
    <div className="flex flex-col lg:flex-row h-[750px] border border-border rounded-xl overflow-hidden bg-[#09090b] text-white shadow-2xl">
      {/* Main Visualization Area */}
      <div className="relative flex-1 bg-[#050505] flex flex-col group">
        {/* Technical Grid Background */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <svg width="100%" height="100%">
            <pattern id="tech-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#333" strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#tech-grid)" />
          </svg>
        </div>

        {/* HUD Overlay */}
        <div className="absolute top-6 left-6 z-20 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-zinc-400 tracking-widest uppercase">System Online</span>
          </div>
          <h3 className="text-2xl font-light tracking-tight text-white">Global Payment Mesh</h3>
          <div className="flex gap-4 text-xs text-zinc-500 font-mono pt-2">
            <div>
              NODES: <span className="text-zinc-300">{nodes.length}</span>
            </div>
            <div>
              LINKS: <span className="text-zinc-300">{edges.length}</span>
            </div>
            <div>
              FLOW: <span className="text-zinc-300">{(totalFlow / 1000000).toFixed(2)}M</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-6 left-6 z-20 space-y-2 text-xs font-mono">
          <div className="text-zinc-500 uppercase tracking-wider mb-2">Payment Status</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-white/60"></div>
            <span className="text-zinc-400">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-emerald-500"></div>
            <span className="text-zinc-400">Streaming</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-0.5 bg-amber-500 opacity-60"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent, transparent 2px, currentColor 2px, currentColor 4px)",
              }}
            ></div>
            <span className="text-zinc-400">Pending</span>
          </div>
        </div>

        {/* Graph Container */}
        <div
          className="flex-1 overflow-hidden cursor-move relative z-10"
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <svg width="100%" height="100%" className="block select-none">
            <defs>
              <radialGradient id="node-glow">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="green-glow">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="blue-glow">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
              {/* Connecting Lines */}
              {edges.map((edge, i) => {
                const isHovered =
                  hoveredNode && (hoveredNode.id === edge.source.id || hoveredNode.id === edge.target.id)
                const isSelected =
                  selectedNode && (selectedNode.id === edge.source.id || selectedNode.id === edge.target.id)
                const active = isHovered || isSelected

                return (
                  <g key={`edge-${i}`} className="pointer-events-none">
                    <line
                      x1={edge.source.x}
                      y1={edge.source.y}
                      x2={edge.target.x}
                      y2={edge.target.y}
                      stroke={active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)"}
                      strokeWidth={active ? 1.5 : 0.5}
                      className="transition-all duration-300"
                    />
                    {/* Flow Particles */}
                    <circle r="1.5" fill={active ? "#fff" : "rgba(255,255,255,0.5)"}>
                      <animateMotion
                        dur={`${2 + Math.random() * 3}s`}
                        repeatCount="indefinite"
                        path={`M${edge.source.x},${edge.source.y} L${edge.target.x},${edge.target.y}`}
                      />
                    </circle>
                    {edge.weight > 1 && (
                      <circle r="1" fill="rgba(255,255,255,0.4)">
                        <animateMotion
                          dur={`${3 + Math.random() * 3}s`}
                          begin="1s"
                          repeatCount="indefinite"
                          path={`M${edge.source.x},${edge.source.y} L${edge.target.x},${edge.target.y}`}
                        />
                      </circle>
                    )}
                  </g>
                )
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                const isRoot = node.type === "root"
                const isSelected = selectedNode?.id === node.id
                const isHovered = hoveredNode?.id === node.id
                const dimmed =
                  (selectedNode || hoveredNode) &&
                  !isSelected &&
                  !isHovered &&
                  !edges.some(
                    (e) =>
                      (e.source.id === node.id && e.target.id === (selectedNode?.id || hoveredNode?.id)) ||
                      (e.target.id === node.id && e.source.id === (selectedNode?.id || hoveredNode?.id)),
                  )

                const glowId =
                  node.type === "subsidiary" ? "green-glow" : node.type === "partner" ? "blue-glow" : "node-glow"

                return (
                  <g
                    key={node.id}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      setSelectedNode(node)
                    }}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{
                      opacity: dimmed ? 0.4 : 1,
                    }}
                    className="transition-opacity duration-300 cursor-pointer"
                  >
                    {/* Glow Effect for subsidiaries */}
                    {(node.type === "subsidiary" || node.type === "partner") && (
                      <circle cx={node.x} cy={node.y} r={node.r * 2.5} fill={`url(#${glowId})`} opacity="0.5" />
                    )}

                    {/* Selection/Hover Glow */}
                    {(isSelected || isHovered) && (
                      <circle cx={node.x} cy={node.y} r={node.r * 2} fill="url(#node-glow)" opacity="0.4" />
                    )}

                    {/* Main Node Body */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.r}
                      fill={isRoot ? "#fff" : "#0a0a0a"}
                      stroke={node.color}
                      strokeWidth={isSelected ? 3 : node.type === "vendor" ? 1 : 2}
                      className="transition-all duration-300"
                    />

                    {/* Inner glow for subsidiaries */}
                    {node.type === "subsidiary" && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.r - 4}
                        fill="none"
                        stroke={node.color}
                        strokeWidth={1}
                        opacity={0.5}
                      />
                    )}

                    {/* Label */}
                    {(node.r > 8 || isSelected || isHovered) && (
                      <text
                        x={node.x}
                        y={node.y + node.r + 14}
                        textAnchor="middle"
                        fill={isSelected || isHovered ? "#fff" : "#71717a"}
                        className="text-[10px] font-mono tracking-wider font-medium pointer-events-none select-none uppercase"
                      >
                        {getVendorName(node.data).substring(0, 18)}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Zoom Controls */}
          <div className="absolute bottom-6 left-6 flex gap-2 z-30">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
              onClick={() => setTransform((prev) => ({ ...prev, k: Math.min(prev.k + 0.2, 4) }))}
            >
              +
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
              onClick={() => setTransform((prev) => ({ ...prev, k: Math.max(prev.k - 0.2, 0.5) }))}
            >
              -
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
              onClick={() => setTransform({ x: 0, y: 0, k: 1 })}
            >
              ⟲
            </Button>
          </div>
        </div>
      </div>

      {/* Enterprise Inspector Panel */}
      <div className="w-full lg:w-[400px] border-t lg:border-t-0 lg:border-l border-zinc-800 bg-[#09090b] flex flex-col shadow-xl z-20">
        {selectedNode && selectedNode.data ? (
          <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-8 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`font-mono text-[10px] uppercase tracking-wider bg-transparent border-zinc-700 ${
                      selectedNode.type === "subsidiary"
                        ? "text-emerald-500 border-emerald-500/30"
                        : selectedNode.type === "partner"
                          ? "text-blue-500 border-blue-500/30"
                          : "text-zinc-500"
                    }`}
                  >
                    {selectedNode.type.toUpperCase()}
                  </Badge>
                  {selectedNode.data.parentId && (
                    <Badge variant="secondary" className="text-[10px]">
                      <Share2 className="w-3 h-3 mr-1" /> Linked
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-white"
                  onClick={() => setSelectedNode(null)}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>

              <h2 className="text-2xl font-light text-white mb-2">{getVendorName(selectedNode.data)}</h2>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 bg-zinc-900 rounded px-2 py-1 w-fit">
                <span className="truncate max-w-[200px]">{selectedNode.data.wallet_address}</span>
                <button
                  className="hover:text-white"
                  onClick={() => navigator.clipboard.writeText(selectedNode.data!.wallet_address)}
                >
                  <Layers className="w-3 h-3" />
                </button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-8 space-y-8">
                {/* Primary Stats */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Total Volume</p>
                    <p className="text-2xl font-light text-white tracking-tight">
                      $
                      {(selectedNode.data.monthly_volume || selectedNode.data.totalReceived || 0).toLocaleString(
                        undefined,
                        { maximumFractionDigits: 0 },
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Tx Count</p>
                    <p className="text-2xl font-light text-white tracking-tight">
                      {selectedNode.data.transaction_count || selectedNode.data.transactionCount || 0}
                    </p>
                  </div>
                </div>

                {/* Flow Visualization */}
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Payment Flow (YTD)</p>
                    <p className="text-xs text-emerald-500">+12.4% vs prev</p>
                  </div>
                  <div className="h-24 flex items-end gap-1 border-b border-l border-zinc-800 p-1">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-zinc-700 hover:bg-zinc-500 transition-all rounded-t-sm"
                        style={{ height: `${20 + Math.random() * 80}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Metadata Table */}
                <div className="space-y-4">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono border-b border-zinc-800 pb-2">
                    Entity Details
                  </p>
                  <div className="grid grid-cols-[100px_1fr] gap-y-4 text-sm">
                    <span className="text-zinc-500">Category</span>
                    <span className="text-white font-medium">{selectedNode.data.category || "General"}</span>

                    <span className="text-zinc-500">Email</span>
                    <span className="text-zinc-300">{selectedNode.data.email || "N/A"}</span>

                    <span className="text-zinc-500">Contract</span>
                    <span className="text-zinc-300">{selectedNode.data.notes || "Standard Agreement"}</span>

                    <span className="text-zinc-500">Status</span>
                    <span className="flex items-center gap-2 text-emerald-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active Contract
                    </span>
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Action Footer */}
            <div className="p-6 border-t border-zinc-800">
              <Button
                className="w-full bg-white text-black hover:bg-zinc-200 font-medium tracking-wide"
                onClick={() => selectedNode.data && onPaymentRequest?.(selectedNode.data)}
              >
                INITIATE TRANSFER
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 text-zinc-500">
            <Layers className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">Select an entity to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
