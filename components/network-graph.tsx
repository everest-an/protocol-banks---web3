"use client"

import { useState, useMemo, useEffect, useRef, type MouseEvent, type WheelEvent } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Share2, ExternalLink, Copy, Check, Calendar } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getSupabase } from "@/lib/supabase"

interface Vendor {
  id: string
  name: string
  wallet_address: string
  totalReceived?: number
  transactionCount?: number
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
  id: string
  source: string
  target: string
  type: string
  isStreaming?: boolean
  isPending?: boolean
}

interface NetworkGraphProps {
  vendors: Vendor[]
  userAddress?: string
  onPaymentRequest?: (vendor: Vendor) => void
}

export function NetworkGraph({ vendors, userAddress, onPaymentRequest }: NetworkGraphProps) {
  console.log("[v0] NetworkGraph received vendors:", vendors?.length || 0)

  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 0.75 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [hasInitialized, setHasInitialized] = useState(false)
  const [filter, setFilter] = useState<"all" | "subsidiary" | "partner" | "vendor">("all")
  const [timeRange, setTimeRange] = useState([75])
  const [copied, setCopied] = useState(false)
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 3)),
    end: new Date(),
  })
  const [showDatePicker, setShowDatePicker] = useState(false)

  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({})
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const GRAPH_WIDTH = 1200
  const GRAPH_HEIGHT = 800

  const { initialNodes, edges } = useMemo(() => {
    console.log("[v0] Calculating nodes, vendors:", vendors?.length || 0)

    if (!vendors.length) {
      console.log("[v0] No vendors, returning empty nodes")
      return { initialNodes: [], edges: [] }
    }

    const centerX = GRAPH_WIDTH / 2
    const centerY = GRAPH_HEIGHT / 2

    const rootNode: Node = {
      id: "root",
      x: centerX,
      y: centerY,
      r: 40,
      data: { name: "MY ORGANIZATION", wallet_address: userAddress || "0x..." } as Vendor,
      type: "root",
      color: "#ffffff",
    }

    const processedNodes: Node[] = [rootNode]
    const processedEdges: Edge[] = []

    const findParentId = (id?: string) => {
      const parent = processedNodes.find((n) => n.id === id)
      return parent ? parent.id : "root"
    }

    const filteredVendors = filter === "all" ? vendors : vendors.filter((v) => v.tier === filter)

    // 1. Process Subsidiaries (Inner Ring)
    const subsidiaries = filteredVendors.filter((v) => v.tier === "subsidiary")
    subsidiaries.forEach((v, i) => {
      const angle = (i / Math.max(subsidiaries.length, 1)) * Math.PI * 2 - Math.PI / 2
      const radius = 180
      const node: Node = {
        id: v.id,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        r: 28,
        data: v,
        type: "subsidiary",
        color: "#10b981",
      }
      processedNodes.push(node)
      processedEdges.push({
        id: `root-${v.id}`,
        source: "root",
        target: v.id,
        type: "subsidiary",
        isStreaming: i === 0 || i === 2,
        isPending: i === 1,
      })
    })

    // 2. Process Partners (Middle Ring)
    const partners = filteredVendors.filter((v) => v.tier === "partner")
    partners.forEach((v, i) => {
      const parentId = findParentId(v.parentId)
      const parentNode = processedNodes.find((n) => n.id === parentId) || rootNode
      const angleOffset = (Math.random() - 0.5) * 0.4
      let baseAngle = Math.atan2(parentNode.y - centerY, parentNode.x - centerX)
      if (parentId === "root") baseAngle = (i / Math.max(partners.length, 1)) * Math.PI * 2 - Math.PI / 2

      const angle = baseAngle + angleOffset
      const radius = 320 + Math.random() * 40

      const node: Node = {
        id: v.id,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        r: 18,
        data: v,
        type: "partner",
        color: "#3b82f6",
      }
      processedNodes.push(node)
      processedEdges.push({
        id: `${parentId}-${v.id}`,
        source: parentId,
        target: v.id,
        type: "partner",
        isStreaming: i % 4 === 0,
        isPending: i % 3 === 0,
      })
    })

    // 3. Process Vendors (Outer Cloud)
    const regularVendors = filteredVendors.filter((v) => !v.tier || v.tier === "vendor")
    regularVendors.forEach((v, i) => {
      const parentId = findParentId(v.parentId)
      const parentNode = processedNodes.find((n) => n.id === parentId) || rootNode
      const baseAngle = Math.atan2(parentNode.y - centerY, parentNode.x - centerX)
      const angle = baseAngle + (Math.random() - 0.5) * 1.0
      const radius = 460 + Math.random() * 80

      const node: Node = {
        id: v.id,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        r: 10 + Math.random() * 4,
        data: v,
        type: "vendor",
        color: "#71717a",
      }
      processedNodes.push(node)
      processedEdges.push({
        id: `${parentId}-${v.id}`,
        source: parentId,
        target: v.id,
        type: "vendor",
        isPending: i % 5 === 0,
      })
    })

    console.log("[v0] Calculated nodes:", processedNodes.length, "edges:", processedEdges.length)

    return { initialNodes: processedNodes, edges: processedEdges }
  }, [vendors, userAddress, filter])

  const nodes = useMemo(() => {
    return initialNodes.map((node) => {
      const customPos = nodePositions[node.id]
      if (customPos) {
        return { ...node, x: customPos.x, y: customPos.y }
      }
      return node
    })
  }, [initialNodes, nodePositions])

  const getNodeById = (id: string) => nodes.find((n) => n.id === id)

  // Calculate stats
  const stats = useMemo(() => {
    const totalFlow = vendors.reduce((sum, v) => sum + (v.totalReceived || 0), 0)
    return {
      nodes: nodes.length,
      links: edges.length,
      flow: (totalFlow / 1000000).toFixed(2),
    }
  }, [nodes, edges, vendors])

  const [transactionHistory, setTransactionHistory] = useState<
    Array<{ date: string; amount: number; type: "sent" | "received" }>
  >([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current
        setDimensions({ width: clientWidth, height: clientHeight })

        if (!hasInitialized && clientWidth > 0 && clientHeight > 0) {
          const scale = 0.7
          const offsetX = (clientWidth - GRAPH_WIDTH * scale) / 2
          const offsetY = (clientHeight - GRAPH_HEIGHT * scale) / 2
          setTransform({ x: offsetX, y: offsetY, k: scale })
          setHasInitialized(true)
        }
      }
    }
    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [hasInitialized])

  useEffect(() => {
    if (nodes.length > 0 && !selectedNode) {
      const firstSubsidiary = nodes.find((n) => n.type === "subsidiary")
      if (firstSubsidiary) {
        setSelectedNode(firstSubsidiary)
      }
    }
  }, [nodes, selectedNode])

  useEffect(() => {
    if (!selectedNode?.data?.wallet_address) {
      setTransactionHistory([])
      return
    }

    const loadHistory = async () => {
      setLoadingHistory(true)
      try {
        const supabase = getSupabase()
        if (!supabase) {
          // Demo mode - generate realistic demo data
          const demoData = generateDemoHistory(selectedNode.data.wallet_address)
          setTransactionHistory(demoData)
          setLoadingHistory(false)
          return
        }

        // Real mode - fetch from database
        const { data: payments } = await supabase
          .from("payments")
          .select("timestamp, amount, amount_usd, to_address, from_address")
          .or(`to_address.eq.${selectedNode.data.wallet_address},from_address.eq.${selectedNode.data.wallet_address}`)
          .order("timestamp", { ascending: true })

        if (payments && payments.length > 0) {
          const history = payments.map((p) => ({
            date: p.timestamp,
            amount: Number.parseFloat(p.amount_usd || p.amount || "0"),
            type: (p.to_address === selectedNode.data.wallet_address ? "received" : "sent") as "sent" | "received",
          }))
          setTransactionHistory(history)
        } else {
          // No data, use demo
          const demoData = generateDemoHistory(selectedNode.data.wallet_address)
          setTransactionHistory(demoData)
        }
      } catch (error) {
        console.error("[v0] Failed to load transaction history:", error)
        // Fallback to demo data
        const demoData = generateDemoHistory(selectedNode.data.wallet_address)
        setTransactionHistory(demoData)
      } finally {
        setLoadingHistory(false)
      }
    }

    loadHistory()
  }, [selectedNode])

  const generateDemoHistory = (address: string) => {
    const now = new Date()
    const history: Array<{ date: string; amount: number; type: "sent" | "received" }> = []

    // Generate 12 months of data
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const baseAmount = 50000 + Math.random() * 100000
      const count = Math.floor(5 + Math.random() * 15)

      for (let j = 0; j < count; j++) {
        history.push({
          date: date.toISOString(),
          amount: baseAmount / count + Math.random() * 10000,
          type: Math.random() > 0.5 ? "received" : "sent",
        })
      }
    }

    return history
  }

  const paymentFlowData = useMemo(() => {
    if (transactionHistory.length === 0) {
      // Fallback to random data if no history
      return Array.from({ length: 12 }, () => 20 + Math.random() * 80)
    }

    // Group by month and sum amounts
    const monthlyData: Record<string, number> = {}
    const now = new Date()

    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      monthlyData[key] = 0
    }

    // Sum transactions by month
    transactionHistory.forEach((tx) => {
      const date = new Date(tx.date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      if (key in monthlyData) {
        monthlyData[key] += tx.amount
      }
    })

    // Convert to array and normalize to percentages
    const values = Object.values(monthlyData)
    const max = Math.max(...values, 1)

    return values.map((v) => (v / max) * 80 + 10) // Scale to 10-90% range
  }, [transactionHistory])

  const ytdGrowth = useMemo(() => {
    if (transactionHistory.length === 0) return "+12.4%"

    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    const yearAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1)

    const recent = transactionHistory
      .filter((tx) => new Date(tx.date) >= sixMonthsAgo)
      .reduce((sum, tx) => sum + tx.amount, 0)

    const previous = transactionHistory
      .filter((tx) => {
        const d = new Date(tx.date)
        return d >= yearAgo && d < sixMonthsAgo
      })
      .reduce((sum, tx) => sum + tx.amount, 0)

    if (previous === 0) return "+100%"
    const growth = ((recent - previous) / previous) * 100
    return `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`
  }, [transactionHistory])

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const scaleAmount = -e.deltaY * 0.001
    const newScale = Math.min(Math.max(0.3, transform.k + scaleAmount), 3)
    setTransform((prev) => ({ ...prev, k: newScale }))
  }

  const handleCanvasMouseDown = (e: MouseEvent) => {
    if (draggingNode) return
    setIsPanning(true)
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (draggingNode) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = (e.clientX - rect.left - transform.x) / transform.k - dragOffset.x
      const y = (e.clientY - rect.top - transform.y) / transform.k - dragOffset.y
      setNodePositions((prev) => ({
        ...prev,
        [draggingNode]: { x, y },
      }))
    } else if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }))
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
    setDraggingNode(null)
  }

  const handleNodeMouseDown = (e: MouseEvent, node: Node) => {
    e.stopPropagation()
    setSelectedNode(node)
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mouseX = (e.clientX - rect.left - transform.x) / transform.k
    const mouseY = (e.clientY - rect.top - transform.y) / transform.k
    setDragOffset({ x: mouseX - node.x, y: mouseY - node.y })
    setDraggingNode(node.id)
  }

  const resetView = () => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      const scale = 0.7
      const offsetX = (dimensions.width - GRAPH_WIDTH * scale) / 2
      const offsetY = (dimensions.height - GRAPH_HEIGHT * scale) / 2
      setTransform({ x: offsetX, y: offsetY, k: scale })
      setNodePositions({}) // Reset custom positions
    }
  }

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      {/* Top Filter Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-[#0c0c12]">
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Filters:</span>
          <div className="flex items-center gap-1">
            {[
              { key: "all", label: "All" },
              { key: "vendor", label: "Suppliers" },
              { key: "partner", label: "Partners" },
              { key: "subsidiary", label: "Subsidiaries" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as typeof filter)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  filter === f.key ? "bg-white text-black" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              className="bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs w-40 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 text-zinc-500 hover:text-white">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            </button>
            <button className="p-1.5 text-zinc-500 hover:text-white">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="1" y="7" width="14" height="2" rx="0.5" />
                <rect x="1" y="12" width="14" height="2" rx="0.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Time Range Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/50 bg-[#0c0c12]/50">
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Time Range</span>
          <div className="w-40">
            <Slider
              value={timeRange}
              onValueChange={setTimeRange}
              max={100}
              step={1}
              className="[&_[role=slider]]:bg-cyan-500 [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"
            />
          </div>
          <span className="text-xs text-zinc-400">Range</span>

          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded hover:border-zinc-600 transition-colors">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-zinc-300">
                  {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 bg-zinc-900 border border-zinc-800" align="start">
              <div className="space-y-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Select Date Range</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Start Date</label>
                    <input
                      type="date"
                      value={dateRange.start.toISOString().split("T")[0]}
                      onChange={(e) => setDateRange((prev) => ({ ...prev, start: new Date(e.target.value) }))}
                      className="w-full px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">End Date</label>
                    <input
                      type="date"
                      value={dateRange.end.toISOString().split("T")[0]}
                      onChange={(e) => setDateRange((prev) => ({ ...prev, end: new Date(e.target.value) }))}
                      className="w-full px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {["7D", "30D", "90D", "1Y", "ALL"].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        const end = new Date()
                        let start = new Date()
                        if (preset === "7D") start.setDate(end.getDate() - 7)
                        else if (preset === "30D") start.setDate(end.getDate() - 30)
                        else if (preset === "90D") start.setDate(end.getDate() - 90)
                        else if (preset === "1Y") start.setFullYear(end.getFullYear() - 1)
                        else start = new Date("2020-01-01")
                        setDateRange({ start, end })
                      }}
                      className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Graph Area */}
        <div className="relative flex-1 min-h-[400px]">
          {/* Technical Grid Background */}
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <svg width="100%" height="100%">
              <pattern id="tech-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1a2e" strokeWidth="0.5" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#tech-grid)" />
            </svg>
          </div>

          {/* Header Overlay */}
          <div className="absolute top-4 left-4 z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">System Online</span>
            </div>
            <h2 className="text-2xl font-light text-white tracking-wide">Global Payment Mesh</h2>
            <div className="flex items-center gap-4 mt-2 text-xs font-mono">
              <span className="text-zinc-500">
                NODES: <span className="text-zinc-300">{stats.nodes}</span>
              </span>
              <span className="text-zinc-500">
                LINKS: <span className="text-zinc-300">{stats.links}</span>
              </span>
              <span className="text-zinc-500">
                FLOW: <span className="text-zinc-300">{stats.flow}M</span>
              </span>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800"
              onClick={() => setTransform((prev) => ({ ...prev, k: Math.min(prev.k + 0.15, 3) }))}
            >
              +
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800"
              onClick={() => setTransform((prev) => ({ ...prev, k: Math.max(prev.k - 0.15, 0.3) }))}
            >
              -
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800"
              onClick={resetView}
            >
              ⟲
            </Button>
          </div>

          <div
            ref={containerRef}
            className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <svg width="100%" height="100%" style={{ overflow: "visible" }}>
              <defs>
                <radialGradient id="node-glow-green" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="node-glow-blue" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="node-glow-white" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>
              </defs>

              <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
                {/* Render Edges */}
                {edges.map((edge) => {
                  const sourceNode = getNodeById(edge.source)
                  const targetNode = getNodeById(edge.target)
                  if (!sourceNode || !targetNode) return null

                  const isHighlighted =
                    selectedNode &&
                    (edge.source === selectedNode.id ||
                      edge.target === selectedNode.id ||
                      (selectedNode.data?.parentId && edge.source === selectedNode.data.parentId))

                  return (
                    <g key={edge.id}>
                      {/* Base line */}
                      <line
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke={isHighlighted ? "#ffffff" : "rgba(60,60,80,0.4)"}
                        strokeWidth={isHighlighted ? 2 : 1}
                        style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
                      />

                      {edge.isStreaming && (
                        <g>
                          <line
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke="#10b981"
                            strokeWidth="4"
                            strokeDasharray="10 15"
                            strokeLinecap="round"
                            opacity="0.9"
                          >
                            <animate
                              attributeName="stroke-dashoffset"
                              from="0"
                              to="-50"
                              dur="0.8s"
                              repeatCount="indefinite"
                            />
                          </line>
                          {/* Multiple flowing particles for better visibility */}
                          <circle r="6" fill="#10b981" opacity="0.95">
                            <animateMotion
                              dur="1.5s"
                              repeatCount="indefinite"
                              path={`M${sourceNode.x},${sourceNode.y} L${targetNode.x},${targetNode.y}`}
                            />
                          </circle>
                          <circle r="3" fill="#ffffff">
                            <animateMotion
                              dur="1.5s"
                              repeatCount="indefinite"
                              begin="0.75s"
                              path={`M${sourceNode.x},${sourceNode.y} L${targetNode.x},${targetNode.y}`}
                            />
                          </circle>
                          {/* Second particle offset */}
                          <circle r="5" fill="#10b981" opacity="0.8">
                            <animateMotion
                              dur="1.5s"
                              repeatCount="indefinite"
                              begin="0.75s"
                              path={`M${sourceNode.x},${sourceNode.y} L${targetNode.x},${targetNode.y}`}
                            />
                          </circle>
                        </g>
                      )}

                      {edge.isPending && !edge.isStreaming && (
                        <line
                          x1={sourceNode.x}
                          y1={sourceNode.y}
                          x2={targetNode.x}
                          y2={targetNode.y}
                          stroke="#f59e0b"
                          strokeWidth="3"
                          strokeDasharray="6 10"
                          strokeLinecap="round"
                          opacity="0.8"
                        >
                          <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" />
                        </line>
                      )}
                    </g>
                  )
                })}

                {/* Render Nodes */}
                {nodes.map((node) => {
                  const isRoot = node.type === "root"
                  const isSelected = selectedNode?.id === node.id
                  const isHovered = hoveredNode?.id === node.id
                  const isDragging = draggingNode === node.id
                  const dimmed =
                    (selectedNode || hoveredNode) &&
                    !isSelected &&
                    !isHovered &&
                    !edges.some(
                      (e) =>
                        (e.source === node.id && e.target === (selectedNode?.id || hoveredNode?.id)) ||
                        (e.target === node.id && e.source === (selectedNode?.id || hoveredNode?.id)),
                    )

                  const glowId =
                    node.type === "subsidiary"
                      ? "node-glow-green"
                      : node.type === "partner"
                        ? "node-glow-blue"
                        : "node-glow-white"

                  return (
                    <g
                      key={node.id}
                      onMouseDown={(e) => handleNodeMouseDown(e, node)}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      style={{
                        opacity: dimmed ? 0.3 : 1,
                        transition: "opacity 0.2s ease",
                        cursor: isDragging ? "grabbing" : "pointer",
                      }}
                    >
                      {/* Glow Effect */}
                      {(isSelected || isHovered || isRoot) && (
                        <circle cx={node.x} cy={node.y} r={node.r * 2.5} fill={`url(#${glowId})`} opacity="0.5" />
                      )}

                      {/* Main Node Body */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.r}
                        fill={isRoot ? "#ffffff" : node.type === "subsidiary" ? "#0a0a0f" : "#0a0a0f"}
                        stroke={
                          isSelected
                            ? "#3b82f6"
                            : isDragging
                              ? "#f59e0b"
                              : isRoot
                                ? "#ffffff"
                                : node.type === "subsidiary"
                                  ? "#10b981"
                                  : node.type === "partner"
                                    ? "#3b82f6"
                                    : "#4a4a5a"
                        }
                        strokeWidth={isSelected || isDragging ? 3 : isRoot ? 0 : 2}
                      />

                      {/* Node Icon/Letter for non-root */}
                      {!isRoot && (
                        <text
                          x={node.x}
                          y={node.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={
                            node.type === "subsidiary" ? "#10b981" : node.type === "partner" ? "#3b82f6" : "#71717a"
                          }
                          fontSize={node.r * 0.8}
                          fontWeight="600"
                          style={{ pointerEvents: "none" }}
                        >
                          {node.data?.name?.charAt(0).toUpperCase()}
                        </text>
                      )}

                      {/* Node Label - always visible */}
                      <text
                        x={node.x}
                        y={node.y + node.r + 14}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.8)"
                        fontSize="10"
                        fontWeight="500"
                        className="uppercase tracking-wider"
                        style={{ pointerEvents: "none" }}
                      >
                        {node.data?.name && node.data.name.length > 12
                          ? node.data.name.slice(0, 12) + "..."
                          : node.data?.name}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>

          {/* Payment Status Legend */}
          <div className="absolute bottom-4 right-4 z-10 bg-zinc-900/90 border border-zinc-800 rounded-lg p-3">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Payment Status</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-zinc-600" />
                <span className="text-xs text-zinc-400">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-emerald-500 rounded animate-pulse" />
                <span className="text-xs text-zinc-400">Streaming</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-0.5"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, #f59e0b 0px, #f59e0b 3px, transparent 3px, transparent 6px)",
                  }}
                />
                <span className="text-xs text-zinc-400">Pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* Entity Inspector Panel */}
        {selectedNode && selectedNode.data && (
          <div className="w-72 flex-shrink-0 border-l border-zinc-800/50 bg-[#0c0c12] p-4 overflow-y-auto overflow-x-hidden">
            <div className="flex items-center justify-between mb-4">
              <Badge
                variant="outline"
                className={`uppercase text-[10px] tracking-wider ${
                  selectedNode.type === "subsidiary"
                    ? "border-emerald-500/50 text-emerald-400"
                    : selectedNode.type === "partner"
                      ? "border-blue-500/50 text-blue-400"
                      : "border-zinc-600 text-zinc-400"
                }`}
              >
                {selectedNode.type}
              </Badge>
              <button className="text-zinc-500 hover:text-white">
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-lg font-medium text-white mb-2 truncate">{selectedNode.data.name}</h3>

            <div className="flex items-center gap-2 mb-6">
              <code className="text-xs text-zinc-500 font-mono truncate max-w-[180px]">
                {selectedNode.data.wallet_address?.slice(0, 10)}...
                {selectedNode.data.wallet_address?.slice(-6)}
              </code>
              <button
                onClick={() => copyAddress(selectedNode.data?.wallet_address || "")}
                className="text-zinc-500 hover:text-white flex-shrink-0"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Total Volume</div>
                <div className="text-xl font-semibold text-white">
                  ${((selectedNode.data.totalReceived || 0) / 1000).toFixed(0)}K
                </div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">TX Count</div>
                <div className="text-xl font-semibold text-white">{selectedNode.data.transactionCount || 0}</div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Payment Flow (YTD)</div>
                <span className="text-xs text-emerald-400">{ytdGrowth}</span>
              </div>
              <div className="flex items-end gap-1 h-16">
                {paymentFlowData.map((value, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-zinc-700 rounded-sm transition-all hover:bg-zinc-600"
                    style={{ height: `${value}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">Entity Details</div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500">Category</span>
                  <span className="text-xs text-white">{selectedNode.data.category || "Internal"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500">Email</span>
                  <span className="text-xs text-white truncate max-w-[140px]">{selectedNode.data.email || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500">Contract</span>
                  <span className="text-xs text-white">Internal Transfer</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Status</span>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>
              </div>
            </div>

            {onPaymentRequest && (
              <Button
                className="w-full mt-6 bg-white text-black hover:bg-zinc-200"
                onClick={() => onPaymentRequest(selectedNode.data!)}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Send Payment
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
