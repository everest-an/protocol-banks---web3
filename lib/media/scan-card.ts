/**
 * The daily "agent scan" card: what the AI actually looked at, what it scored,
 * and what it decided. This is the one thing no other account can post — it is
 * our agent's own reading of the market, not a feature list.
 */
import { createCanvas, GlobalFonts } from "@napi-rs/canvas"
import { AEONIK_BOLD_B64 } from "./aeonik-bold"

const FONT = "Aeonik"
let fontReady = false
function ensureFont(): void {
  if (fontReady) return
  GlobalFonts.register(Buffer.from(AEONIK_BOLD_B64, "base64"), FONT)
  fontReady = true
}

export type ScanDecision = "HOLD" | "SIGNAL" | "WATCH"

export interface ScanRow {
  coin: string
  side: "long" | "short"
  z: number
  funding: number
  score: number
  decision: ScanDecision
}

export interface ScanCardOptions {
  rows: ScanRow[]
  equityUsd: number
  openPositions: number
  marketsScanned: number
  signals: number
  shortBiased: number
  entryThreshold: number
  at?: Date
}

const W = 1600
const H = 900
const BG = "#0A0D14"
const UP = "#34D399"
const DOWN = "#F87171"
const TEXT = "#F5F6F7"
const MUTED = "rgba(245,246,247,0.45)"
const LINE = "rgba(255,255,255,0.07)"

export function renderScanCard(opts: ScanCardOptions): Uint8Array {
  ensureFont()
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const at = opts.at ?? new Date()

  // background + top glow + grid
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.5, -260, 60, W * 0.5, -260, 900)
  glow.addColorStop(0, "rgba(52,211,153,0.14)")
  glow.addColorStop(1, "rgba(10,13,20,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = "rgba(255,255,255,0.03)"
  ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 80) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }

  const padX = 92

  // header: brand + live dot
  ctx.beginPath()
  ctx.arc(padX + 7, 78, 7, 0, Math.PI * 2)
  ctx.fillStyle = UP
  ctx.shadowColor = UP
  ctx.shadowBlur = 14
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.font = `700 26px "${FONT}"`
  ctx.fillStyle = TEXT
  ctx.fillText("PROTOCOL BANK", padX + 26, 88)
  const brandW = ctx.measureText("PROTOCOL BANK").width
  ctx.fillStyle = "rgba(245,246,247,0.28)"
  ctx.fillText("·", padX + 26 + brandW + 16, 88)
  ctx.fillStyle = MUTED
  ctx.fillText("AGENT SCAN", padX + 26 + brandW + 38, 88)

  // header right: date + equity
  const stamp = at.toISOString().replace("T", " ").slice(0, 16) + " UTC"
  ctx.font = `700 22px "${FONT}"`
  ctx.fillStyle = MUTED
  const stampW = ctx.measureText(stamp).width
  ctx.fillText(stamp, W - padX - stampW, 78)
  ctx.fillStyle = TEXT
  ctx.font = `700 30px "${FONT}"`
  const eq = `$${opts.equityUsd.toFixed(2)}`
  const eqW = ctx.measureText(eq).width
  ctx.fillText(eq, W - padX - eqW, 116)
  ctx.font = `700 18px "${FONT}"`
  ctx.fillStyle = MUTED
  const eqLabel = "account value"
  ctx.fillText(eqLabel, W - padX - eqW - 14 - ctx.measureText(eqLabel).width, 114)

  ctx.strokeStyle = "rgba(255,255,255,0.12)"
  ctx.beginPath()
  ctx.moveTo(padX, 152)
  ctx.lineTo(W - padX, 152)
  ctx.stroke()

  // column layout
  const cols = [padX, padX + 310, padX + 520, padX + 780, padX + 1040, padX + 1210]
  const headerY = 200
  ctx.font = `700 18px "${FONT}"`
  ctx.fillStyle = MUTED
  ;["MARKET", "BIAS", "MOMENTUM z", "FUNDING /h", "SCORE", "DECISION"].forEach((label, i) => {
    ctx.fillText(label, cols[i], headerY)
  })

  const rowTop = 236
  const rowH = 100
  opts.rows.forEach((row, i) => {
    const y = rowTop + i * rowH
    const mid = y + rowH / 2

    ctx.strokeStyle = LINE
    ctx.beginPath()
    ctx.moveTo(padX, y)
    ctx.lineTo(W - padX, y)
    ctx.stroke()

    // market
    ctx.font = `700 34px "${FONT}"`
    ctx.fillStyle = TEXT
    ctx.fillText(row.coin, cols[0], mid + 12)

    // bias
    ctx.font = `700 22px "${FONT}"`
    ctx.fillStyle = row.side === "long" ? UP : DOWN
    ctx.fillText(row.side === "long" ? "LONG" : "SHORT", cols[1], mid + 8)

    // momentum z
    ctx.font = `700 30px "${FONT}"`
    ctx.fillStyle = TEXT
    ctx.fillText(`${row.z >= 0 ? "+" : ""}${row.z.toFixed(2)}`, cols[2], mid + 10)

    // funding
    const fp = row.funding * 100
    ctx.fillStyle = MUTED
    ctx.font = `700 26px "${FONT}"`
    ctx.fillText(`${fp >= 0 ? "+" : ""}${fp.toFixed(4)}%`, cols[3], mid + 9)

    // score
    ctx.font = `700 30px "${FONT}"`
    ctx.fillStyle = Math.abs(row.score) >= 0.45 ? (row.score >= 0 ? UP : DOWN) : TEXT
    ctx.fillText(`${row.score >= 0 ? "+" : ""}${row.score.toFixed(2)}`, cols[4], mid + 10)

    // decision badge
    const tone = row.decision === "SIGNAL" ? UP : row.decision === "HOLD" ? "#60A5FA" : MUTED
    ctx.font = `700 20px "${FONT}"`
    const labelW = ctx.measureText(row.decision).width
    const bw = labelW + 34
    ctx.strokeStyle = tone
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cols[5], mid - 20, bw, 40, 20)
    ctx.stroke()
    ctx.fillStyle = tone
    ctx.fillText(row.decision, cols[5] + 17, mid + 7)
  })

  // footer summary
  const fy = rowTop + opts.rows.length * rowH
  ctx.strokeStyle = "rgba(255,255,255,0.12)"
  ctx.beginPath()
  ctx.moveTo(padX, fy)
  ctx.lineTo(W - padX, fy)
  ctx.stroke()

  ctx.font = `700 24px "${FONT}"`
  ctx.fillStyle = MUTED
  const summary = `${opts.marketsScanned} markets scanned · ${opts.shortBiased}/${opts.marketsScanned} short-biased · ${opts.signals} signal${opts.signals === 1 ? "" : "s"} · ${opts.openPositions} position${opts.openPositions === 1 ? "" : "s"} open`
  ctx.fillText(summary, padX, fy + 58)

  ctx.fillStyle = "rgba(245,246,247,0.3)"
  ctx.font = `700 20px "${FONT}"`
  const note = `entry needs |score| ≥ ${opts.entryThreshold.toFixed(2)} · every decision logged`
  ctx.fillText(note, W - padX - ctx.measureText(note).width, fy + 56)

  return canvas.toBuffer("image/png")
}
