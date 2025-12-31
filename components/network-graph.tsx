"use client"

import type React from "react"

import type { Vendor } from "@/types/vendor"
import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { ExternalLink, ZoomIn, ZoomOut, RotateCcw, Search } from "lucide-react"
import { createBrowserClient } from "@supabase/ssr"

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
  onSelectVendor?: (vendor: Vendor) => void
  selectedVendorId?: string
  filter?: string
  timeRange?: string
  userAddress?: string
  isDemoMode?: boolean
}

const getFixedOffset = (index: number, seed: number) => {
  const golden = 0.618033988749895
  const value = ((index * golden + seed * 0.1) % 1) * 2 - 1
  return value
}

export function NetworkGraph({
  vendors,
  onSelectVendor,
  selectedVendorId,
  filter,
  timeRange,
  userAddress,
  isDemoMode = false,
}: NetworkGraphProps) {
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [nodeDragOffset, setNodeDragOffset] = useState({ x: 0, y: 0 })
  const [customPositions, setCustomPositions] = useState<Record<string, { x: number; y: number }>>({})

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Node[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)

  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  const initialSetupDone = useRef(false)

  const supabase = useMemo(() => {
    return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  }, [])

  const { nodes, edges } = useMemo(() => {
    if (!vendors.length) {
      const width = dimensions.width || 1200
      const height = dimensions.height || 800
      const centerX = width * 0.45
      const centerY = height / 2

      const rootNode: Node = {
        id: "root",
        x: centerX,
        y: centerY,
        r: 40,
        data: { company_name: "MY ORGANIZATION", wallet_address: userAddress || "0x..." } as Vendor,
        type: "root",
        color: "#ffffff",
      }
      return { nodes: [rootNode], edges: [] }
    }

    const width = dimensions.width || 1200
    const height = dimensions.height || 800
    const centerX = width * 0.45
    const centerY = height / 2

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

    const subsidiaries = vendors.filter((v) => v.tier === "subsidiary")
    subsidiaries.forEach((v, i) => {
      const angle = (i / Math.max(subsidiaries.length, 1)) * Math.PI * 2 - Math.PI / 2
      const radius = 180
      const offsetX = getFixedOffset(i, 1) * 10
      const offsetY = getFixedOffset(i, 2) * 10
      const x = centerX + Math.cos(angle) * radius + offsetX
      const y = centerY + Math.sin(angle) * radius + offsetY
      const node: Node = {
        id: v.id,
        x: customPositions[v.id]?.x ?? x,
        y: customPositions[v.id]?.y ?? y,
        r: 25,
        data: v,
        type: "subsidiary",
        color: "#10b981",
      }
      processedNodes.push(node)
      processedEdges.push({ source: rootNode, target: node, weight: 3 })
    })

    const partners = vendors.filter((v) => v.tier === "partner")
    partners.forEach((v, i) => {
      const parent = findParent(v.parentId)
      const angleOffset = getFixedOffset(i, 3) * 0.3
      let baseAngle = Math.atan2(parent.y - centerY, parent.x - centerX)
      if (parent.id === "root") baseAngle = (i / Math.max(partners.length, 1)) * Math.PI * 2

      const angle = baseAngle + angleOffset
      const radius = 320 + getFixedOffset(i, 4) * 25
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius

      const offsetX = getFixedOffset(i, 5) * 15
      const offsetY = getFixedOffset(i, 6) * 15
      const node: Node = {
        id: v.id,
        x: customPositions[v.id]?.x ?? x + offsetX,
        y: customPositions[v.id]?.y ?? y + offsetY,
        r: 15,
        data: v,
        type: "partner",
        color: "#3b82f6",
      }
      processedNodes.push(node)
      processedEdges.push({ source: parent, target: node, weight: 2 })
    })

    const regularVendors = vendors.filter((v) => !v.tier || v.tier === "vendor")
    regularVendors.forEach((v, i) => {
      const parent = findParent(v.parentId)
      const baseAngle = Math.atan2(parent.y - centerY, parent.x - centerX)
      const angle = baseAngle + getFixedOffset(i, 7) * 0.6
      const radius = 450 + getFixedOffset(i, 8) * 60
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius

      const offsetX = getFixedOffset(i, 9) * 20
      const offsetY = getFixedOffset(i, 10) * 20
      const nodeRadius = 6 + Math.abs(getFixedOffset(i, 11)) * 4
      const node: Node = {
        id: v.id,
        x: customPositions[v.id]?.x ?? x + offsetX,
        y: customPositions[v.id]?.y ?? y + offsetY,
        r: nodeRadius,
        data: v,
        type: "vendor",
        color: "#71717a",
      }
      processedNodes.push(node)
      processedEdges.push({ source: parent, target: node, weight: 1 })
    })

    return { nodes: processedNodes, edges: processedEdges }
  }, [vendors, dimensions, userAddress, customPositions])

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

  useEffect(() => {
    if (initialSetupDone.current) return
    if (nodes.length === 0) return
    if (dimensions.width === 0 || dimensions.height === 0) return

    // Find root node
    const rootNode = nodes.find((n) => n.id === "root")
    if (rootNode) {
      // Auto-select root node to show details panel
      setSelectedNode(rootNode)
      if (rootNode.data && onSelectVendor) {
        onSelectVendor(rootNode.data)
      }

      // Center the graph on root node
      const centerX = dimensions.width * 0.35 // Offset left to account for right panel
      const centerY = dimensions.height / 2
      setTransform({
        x: centerX - rootNode.x,
        y: centerY - rootNode.y,
        k: 1.0,
      })

      initialSetupDone.current = true
    }
  }, [nodes, dimensions, onSelectVendor])

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const scaleAmount = -e.deltaY * 0.001
    const newScale = Math.min(Math.max(0.5, transform.k + scaleAmount), 4)
    setTransform((prev) => ({ ...prev, k: newScale }))
  }

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    const node = nodes.find((n) => n.id === nodeId)
    if (!node || nodeId === "root") return

    const svg = svgRef.current
    if (!svg) return

    const point = svg.createSVGPoint()
    point.x = e.clientX
    point.y = e.clientY
    const svgPoint = point.matrixTransform(svg.getScreenCTM()?.inverse())

    const transformedX = (svgPoint.x - transform.x) / transform.k
    const transformedY = (svgPoint.y - transform.y) / transform.k

    setDraggingNode(nodeId)
    setNodeDragOffset({
      x: transformedX - node.x,
      y: transformedY - node.y,
    })
  }

  const handleNodeMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingNode || !svgRef.current) return

      const svg = svgRef.current
      const point = svg.createSVGPoint()
      point.x = e.clientX
      point.y = e.clientY
      const svgPoint = point.matrixTransform(svg.getScreenCTM()?.inverse())

      const newX = (svgPoint.x - transform.x) / transform.k - nodeDragOffset.x
      const newY = (svgPoint.y - transform.y) / transform.k - nodeDragOffset.y

      setCustomPositions((prev) => ({
        ...prev,
        [draggingNode]: { x: newX, y: newY },
      }))
    },
    [draggingNode, transform, nodeDragOffset],
  )

  const handleNodeMouseUp = useCallback(async () => {
    if (!draggingNode) return

    const position = customPositions[draggingNode]
    if (position && userAddress) {
      await supabase.from("node_positions").upsert(
        {
          user_address: userAddress,
          vendor_id: draggingNode,
          x: position.x,
          y: position.y,
          node_type: nodes.find((n) => n.id === draggingNode)?.type || "vendor",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_address,vendor_id",
        },
      )
    }

    setDraggingNode(null)
  }, [draggingNode, customPositions, userAddress, supabase])

  useEffect(() => {
    if (draggingNode) {
      window.addEventListener("mousemove", handleNodeMouseMove)
      window.addEventListener("mouseup", handleNodeMouseUp)
      return () => {
        window.removeEventListener("mousemove", handleNodeMouseMove)
        window.removeEventListener("mouseup", handleNodeMouseUp)
      }
    }
  }, [draggingNode, handleNodeMouseMove, handleNodeMouseUp])

  const handleResetLayout = async () => {
    setCustomPositions({})
    if (userAddress) {
      await supabase.from("node_positions").delete().eq("user_address", userAddress)
    }
  }

  const handleMouseDown = (e: MouseEvent) => {
    if (draggingNode) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (draggingNode) return
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

  const handleNodeClick = (node: Node) => {
    if (node.data) {
      onSelectVendor?.(node.data)
      setSelectedNode(node)
    }
  }

  const handleInitiateTransfer = () => {
    if (selectedNode?.data) {
      onSelectVendor?.(selectedNode.data)
    }
  }

  // Handle search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }
    const query = searchQuery.toLowerCase()
    const results = nodes.filter((node) => {
      const name = (node.data?.company_name || node.data?.name || "").toLowerCase()
      const wallet = (node.data?.wallet_address || "").toLowerCase()
      return name.includes(query) || wallet.includes(query)
    })
    setSearchResults(results.slice(0, 5)) // Limit to 5 results
    setShowSearchResults(true)
  }, [searchQuery])

  const handleSearchSelect = (node: Node) => {
    setSelectedNode(node)
    if (node.data && onSelectVendor) {
      onSelectVendor(node.data)
    }
    setSearchQuery("")
    setShowSearchResults(false)
    // Center view on selected node
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      setTransform({
        x: centerX - node.x * transform.k,
        y: centerY - node.y * transform.k,
        k: transform.k,
      })
    }
  }

  useEffect(() => {
    if (!userAddress) return

    const loadPositions = async () => {
      const { data } = await supabase.from("node_positions").select("vendor_id, x, y").eq("user_address", userAddress)

      if (data && data.length > 0) {
        const positions: Record<string, { x: number; y: number }> = {}
        data.forEach((item) => {
          if (item.vendor_id) {
            positions[item.vendor_id] = { x: Number(item.x), y: Number(item.y) }
          }
        })
        setCustomPositions(positions)
      }
    }

    loadPositions()
  }, [userAddress, supabase])

  const showEmptyState = !isDemoMode && vendors.length === 0

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[800px] bg-[#0a0a0a] rounded-lg overflow-hidden">
      <div className="absolute top-6 left-6 z-20 space-y-2">
        <h3 className="text-2xl font-light tracking-tight text-white">Global Payment Mesh</h3>
        <div className="flex gap-4 text-xs text-zinc-500 font-mono pt-2">
          <div>
            NODES: <span className="text-zinc-300">{nodes.length}</span>
          </div>
        </div>
      </div>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <div className="relative">
          <div className="flex items-center bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg px-3 py-2 w-64">
            <Search className="w-4 h-4 text-zinc-500 mr-2" />
            <input
              type="text"
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && setShowSearchResults(true)}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
              className="bg-transparent text-sm text-white placeholder-zinc-500 outline-none w-full"
            />
          </div>
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-lg overflow-hidden">
              {searchResults.map((node) => (
                <button
                  key={node.id}
                  onClick={() => handleSearchSelect(node)}
                  className="w-full px-3 py-2 text-left hover:bg-zinc-800 transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm text-white">{node.data?.company_name || node.data?.name || "Unknown"}</div>
                    <div className="text-xs text-zinc-500 font-mono truncate max-w-[180px]">
                      {node.data?.wallet_address}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
                      node.type === "subsidiary"
                        ? "text-emerald-500 bg-emerald-500/10"
                        : node.type === "partner"
                          ? "text-blue-500 bg-blue-500/10"
                          : "text-zinc-400 bg-zinc-700/50"
                    }`}
                  >
                    {node.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showEmptyState ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
              <svg className="w-12 h-12 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Contacts Yet</h3>
            <p className="text-zinc-400 mb-6 max-w-sm">
              Add your first vendor, partner, or subsidiary to start visualizing your payment network.
            </p>
            <button
              onClick={() => {
                /* TODO: Open add contact modal */
              }}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
            >
              + Add First Contact
            </button>
          </div>
        </div>
      ) : (
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className={`${isDragging ? "cursor-grabbing" : draggingNode ? "cursor-grabbing" : "cursor-grab"}`}
          onMouseDown={(e) => handleMouseDown(e.nativeEvent)}
          onMouseMove={(e) => handleMouseMove(e.nativeEvent)}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
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
            {/* Edges */}
            {edges.map((edge, index) => {
              const sourceNode = nodes.find((n) => n.id === edge.source.id) || edge.source
              const targetNode = nodes.find((n) => n.id === edge.target.id) || edge.target

              const isHovered = hoveredNode && (hoveredNode.id === edge.source.id || hoveredNode.id === edge.target.id)
              const isSelected =
                selectedNode && (selectedNode.id === edge.source.id || selectedNode.id === edge.target.id)
              const active = isHovered || isSelected

              return (
                <g key={`edge-${index}`} className="pointer-events-none">
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)"}
                    strokeWidth={active ? 1.5 : 0.5}
                    className="transition-all duration-300"
                  />
                  <circle r="1.5" fill={active ? "#fff" : "rgba(255,255,255,0.5)"}>
                    <animateMotion
                      dur={`${2 + (index % 5)}s`}
                      repeatCount="indefinite"
                      path={`M${sourceNode.x},${sourceNode.y} L${targetNode.x},${targetNode.y}`}
                    />
                  </circle>
                  {edge.weight > 1 && (
                    <circle r="1" fill="rgba(255,255,255,0.4)">
                      <animateMotion
                        dur={`${3 + (index % 5)}s`}
                        begin="1s"
                        repeatCount="indefinite"
                        path={`M${sourceNode.x},${sourceNode.y} L${targetNode.x},${targetNode.y}`}
                      />
                    </circle>
                  )}
                </g>
              )
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id
              const isHovered = hoveredNode?.id === node.id
              const isBeingDragged = draggingNode === node.id

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  className={node.id === "root" ? "cursor-pointer" : "cursor-move"}
                >
                  {node.type === "subsidiary" && (
                    <circle cx={0} cy={0} r={node.r * 2.5} fill="url(#green-glow)" opacity="0.5" />
                  )}

                  {(isSelected || isHovered) && (
                    <circle cx={0} cy={0} r={node.r * 2} fill="url(#node-glow)" opacity="0.4" />
                  )}

                  <circle
                    cx={0}
                    cy={0}
                    r={node.r}
                    fill="#0a0a0a"
                    stroke={node.color}
                    strokeWidth={isSelected ? 3 : node.type === "vendor" ? 1 : 2}
                    className="transition-all duration-300"
                  />

                  {node.type === "subsidiary" && (
                    <circle
                      cx={0}
                      cy={0}
                      r={node.r - 4}
                      fill="none"
                      stroke={node.color}
                      strokeWidth={1}
                      opacity={0.5}
                    />
                  )}

                  {(node.r > 8 || isSelected || isHovered) && (
                    <text
                      x={0}
                      y={node.r + 14}
                      textAnchor="middle"
                      fill={isSelected || isHovered ? "#fff" : "#71717a"}
                      className="text-[10px] font-mono tracking-wider font-medium pointer-events-none select-none uppercase"
                    >
                      {node.data?.company_name || node.data?.name || "Unknown"}
                    </text>
                  )}

                  {isBeingDragged && (
                    <circle r={node.r * transform.k + 4} fill="none" stroke="#ffffff" strokeWidth={2} opacity={0.8} />
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      )}

      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        <button
          onClick={() => setTransform((prev) => ({ ...prev, k: Math.min(prev.k + 0.2, 4) }))}
          className="p-2 bg-zinc-900/80 rounded-lg hover:bg-zinc-800 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-zinc-400" />
        </button>
        <button
          onClick={() => setTransform((prev) => ({ ...prev, k: Math.max(prev.k - 0.2, 0.5) }))}
          className="p-2 bg-zinc-900/80 rounded-lg hover:bg-zinc-800 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 text-zinc-400" />
        </button>
        <button
          onClick={handleResetLayout}
          className="p-2 bg-zinc-900/80 rounded-lg hover:bg-zinc-800 transition-colors"
          title="Reset Layout"
        >
          <RotateCcw className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <div className="absolute top-6 right-6 bottom-6 z-20 w-80 bg-zinc-900/90 backdrop-blur-sm rounded-lg border border-zinc-800 overflow-auto">
        {selectedNode && selectedNode.data ? (
          <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${
                    selectedNode.type === "subsidiary"
                      ? "text-emerald-500 border-emerald-500/30"
                      : selectedNode.type === "partner"
                        ? "text-blue-500 border-blue-500/30"
                        : "text-zinc-500 border-zinc-700"
                  }`}
                >
                  {selectedNode.type.toUpperCase()}
                </span>
                <button
                  className="p-2 hover:bg-zinc-800 rounded transition-colors"
                  onClick={() => window.open(`/vendors/${selectedNode.id}`, "_blank")}
                >
                  <ExternalLink className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

              <h2 className="text-xl font-light text-white mb-2">
                {selectedNode.data?.company_name || selectedNode.data?.name || "Unknown"}
              </h2>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 bg-zinc-900 rounded px-2 py-1 w-fit">
                <span className="truncate max-w-[180px]">{selectedNode.data?.wallet_address}</span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Total Volume</p>
                  <p className="text-xl font-light text-white">
                    $
                    {(selectedNode.data.monthly_volume || selectedNode.data.totalReceived || 0).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 0 },
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Tx Count</p>
                  <p className="text-xl font-light text-white">
                    {selectedNode.data.transaction_count || selectedNode.data.transactionCount || 0}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Payment Flow (YTD)</p>
                  <p className="text-xs text-emerald-500">+12.4% vs prev</p>
                </div>
                <div className="h-16 flex items-end gap-0.5">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-zinc-700 hover:bg-zinc-500 transition-all rounded-t-sm"
                      style={{ height: `${20 + ((i * 17) % 80)}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono border-b border-zinc-800 pb-2">
                  Entity Details
                </p>
                <div className="grid grid-cols-[80px_1fr] gap-y-3 text-sm">
                  <span className="text-zinc-500">Category</span>
                  <span className="text-white">{selectedNode.data.category || "General"}</span>
                  <span className="text-zinc-500">Email</span>
                  <span className="text-zinc-300 truncate">{selectedNode.data.email || "N/A"}</span>
                  <span className="text-zinc-500">Contract</span>
                  <span className="text-zinc-300">{selectedNode.data.notes || "Standard Agreement"}</span>
                  <span className="text-zinc-500">Status</span>
                  <span className="flex items-center gap-2 text-emerald-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active Contract
                  </span>
                </div>
              </div>

              <button
                onClick={handleInitiateTransfer}
                className="w-full py-3 bg-white text-black font-medium rounded hover:bg-zinc-200 transition-colors"
              >
                INITIATE TRANSFER
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center p-6 text-zinc-500">
            <p className="text-sm">Select an entity to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
