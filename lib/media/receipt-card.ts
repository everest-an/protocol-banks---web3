/**
 * The position receipt: one open position with the exact risk it carries -
 * entry, mark, size, margin, and the stop/target the platform enforces.
 * Every number comes from the venue or the agent's own ledger.
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

export interface ReceiptPosition {
  symbol: string
  side: "long" | "short"
  entry: number
  mark: number
  size: number
  allocated: number
  unrealizedPnl: number
  leverage: number
  stopPrice: number
  takeProfitPrice: number
  openedAt: string
  reason: string
}

export interface ReceiptOptions {
  position: ReceiptPosition
  equityUsd: number
  at?: Date
}

const W = 1600
const H = 900
const BG = "#0A0D14"
const UP = "#34D399"
const DOWN = "#F87171"
const TEXT = "#F5F6F7"
const MUTED = "rgba(245,246,247,0.45)"

function signedUsd(v: number): string {
  return `${v < 0 ? "-" : "+"}$${Math.abs(v).toFixed(2)}`
}

export function renderPositionReceipt(opts: ReceiptOptions): Uint8Array {
  ensureFont()
  const { position: p, equityUsd } = opts
  const at = opts.at ?? new Date()
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const long = p.side === "long"
  const accent = p.unrealizedPnl >= 0 ? UP : DOWN

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.5, -240, 60, W * 0.5, -240, 900)
  glow.addColorStop(0, long ? "rgba(52,211,153,0.13)" : "rgba(248,113,113,0.13)")
  glow.addColorStop(1, "rgba(10,13,20,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = "rgba(255,255,255,0.03)"
  for (let x = 0; x <= W; x += 80) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }

  const padX = 92

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
  ctx.fillText("/", padX + 26 + brandW + 14, 88)
  ctx.fillStyle = MUTED
  ctx.fillText("POSITION RECEIPT", padX + 26 + brandW + 36, 88)

  const stamp = `${at.toISOString().replace("T", " ").slice(0, 16)} UTC`
  ctx.font = `700 22px "${FONT}"`
  ctx.fillStyle = MUTED
  ctx.fillText(stamp, W - padX - ctx.measureText(stamp).width, 78)
  ctx.fillStyle = TEXT
  ctx.font = `700 30px "${FONT}"`
  const eq = `$${equityUsd.toFixed(2)}`
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

  ctx.font = `700 76px "${FONT}"`
  ctx.fillStyle = TEXT
  ctx.fillText(p.symbol, padX, 262)
  const symW = ctx.measureText(p.symbol).width
  ctx.font = `700 34px "${FONT}"`
  ctx.fillStyle = long ? UP : DOWN
  ctx.fillText(long ? "LONG" : "SHORT", padX + symW + 24, 258)

  const opened = new Date(p.openedAt).getTime()
  const hours = Math.max(0, Math.floor((at.getTime() - opened) / 3_600_000))
  const minutes = Math.max(0, Math.floor(((at.getTime() - opened) % 3_600_000) / 60_000))
  ctx.font = `700 22px "${FONT}"`
  ctx.fillStyle = MUTED
  const age = hours > 0 ? `open ${hours}h ${minutes}m` : `open ${minutes}m`
  ctx.fillText(age, W - padX - ctx.measureText(age).width, 250)

  const effectiveLeverage = p.allocated > 0 ? (p.size * p.mark) / p.allocated : p.leverage
  const rows: Array<[string, string, string]> = [
    ["entry", `$${p.entry.toFixed(2)}`, TEXT],
    ["mark", `$${p.mark.toFixed(2)}`, TEXT],
    ["size", `${p.size} ${p.symbol}`, TEXT],
    ["margin", `$${p.allocated.toFixed(2)} (${effectiveLeverage.toFixed(1)}x)`, TEXT],
    ["stop", `$${p.stopPrice.toFixed(2)}`, DOWN],
    ["target", `$${p.takeProfitPrice.toFixed(2)}`, UP],
  ]
  const colLeft = padX
  const colRight = padX + 620
  rows.forEach(([label, value, tone], i) => {
    const x = i % 2 === 0 ? colLeft : colRight
    const y = 360 + Math.floor(i / 2) * 108
    ctx.font = `700 20px "${FONT}"`
    ctx.fillStyle = MUTED
    ctx.fillText(label.toUpperCase(), x, y)
    ctx.font = `700 38px "${FONT}"`
    ctx.fillStyle = tone
    ctx.fillText(value, x, y + 44)
  })

  const pnlBoxX = padX + 1130
  ctx.font = `700 20px "${FONT}"`
  ctx.fillStyle = MUTED
  ctx.fillText("UNREALIZED", pnlBoxX, 360)
  ctx.font = `700 46px "${FONT}"`
  ctx.fillStyle = accent
  ctx.shadowColor = accent
  ctx.shadowBlur = 18
  ctx.fillText(signedUsd(p.unrealizedPnl), pnlBoxX, 412)
  ctx.shadowBlur = 0
  ctx.font = `700 22px "${FONT}"`
  ctx.fillStyle = MUTED
  const pct = p.allocated > 0 ? (p.unrealizedPnl / p.allocated) * 100 : 0
  ctx.fillText(`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% on margin`, pnlBoxX, 446)

  ctx.strokeStyle = "rgba(255,255,255,0.12)"
  ctx.beginPath()
  ctx.moveTo(padX, 640)
  ctx.lineTo(W - padX, 640)
  ctx.stroke()
  ctx.font = `700 24px "${FONT}"`
  ctx.fillStyle = MUTED
  ctx.fillText("SIGNAL", padX, 690)
  ctx.font = `700 26px "${FONT}"`
  ctx.fillStyle = TEXT
  ctx.fillText(p.reason.slice(0, 110), padX + 130, 690)

  ctx.font = `700 24px "${FONT}"`
  ctx.fillStyle = MUTED
  ctx.fillText("stops and targets are enforced by the platform, not by the model", padX, 790)
  ctx.fillStyle = "rgba(245,246,247,0.3)"
  ctx.font = `700 20px "${FONT}"`
  const note = "agent wallet: trade-only, never withdraw"
  ctx.fillText(note, W - padX - ctx.measureText(note).width, 788)

  return canvas.toBuffer("image/png")
}
