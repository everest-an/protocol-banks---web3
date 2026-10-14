/**
 * Daily animated GIF for the X post — canvas renderer (brand font Aeonik Bold).
 *
 * Design language taken from high-engagement crypto/fintech motion graphics:
 * dark UI, one bold kinetic headline revealing word-by-word, a glowing equity
 * curve drawing itself, and an odometer-style count-up of the day's number.
 * Runs in the Vercel cron: @napi-rs/canvas ships prebuilt binaries and the
 * brand font is embedded as base64 (no filesystem dependency).
 */
import { createCanvas, GlobalFonts } from "@napi-rs/canvas"
import { GIFEncoder, quantize, applyPalette } from "gifenc"
import { AEONIK_BOLD_B64 } from "./aeonik-bold"

const FONT = "Aeonik"
let fontReady = false
function ensureFont(): void {
  if (fontReady) return
  GlobalFonts.register(Buffer.from(AEONIK_BOLD_B64, "base64"), FONT)
  fontReady = true
}

/** Deterministic pseudo-random walk seeded by the number. */
function buildCurve(pnl: number, points: number, seed: number): number[] {
  const vals: number[] = [0]
  let s = seed % 2147483647
  const rand = () => {
    s = (s * 48271) % 2147483647
    return s / 2147483647
  }
  const drift = Math.max(-1, Math.min(1, pnl / 25))
  for (let i = 1; i < points; i++) {
    const progress = i / (points - 1)
    const noise = (rand() - 0.5) * 0.9
    const target = drift * progress * (0.6 + 0.4 * progress)
    const prev = vals[i - 1]
    vals.push(prev + (target - prev) * 0.25 + noise * 0.35)
  }
  vals[points - 1] = drift
  return vals
}

type Ctx = ReturnType<ReturnType<typeof createCanvas>["getContext"]>

function wrapText(ctx: Ctx, text: string, maxWidth: number, maxLines = 2): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    const probe = line ? `${line} ${w}` : w
    if (ctx.measureText(probe).width > maxWidth && line) {
      lines.push(line)
      line = w
      if (lines.length === maxLines - 1 && words.indexOf(w) < words.length - 1) {
        let last = words.slice(words.indexOf(w)).join(" ")
        while (last.length > 4 && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1)
        lines.push(last.trimEnd() + "…")
        return lines
      }
    } else {
      line = probe
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, maxLines)
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export interface TradingGifOptions {
  /** The number that counts up (e.g. cumulative PnL in USD). */
  pnl: number
  /** Bold headline revealed word-by-word (usually the post's hook line). */
  headline?: string
  /** Small line under the number. */
  sub?: string
  /** Rendered as PAPER instead of LIVE in the corner tag. */
  paper?: boolean
  width?: number
  height?: number
  frames?: number
}

export function renderTradingGif(opts: TradingGifOptions): Uint8Array {
  ensureFont()
  const W = opts.width ?? 960
  const H = opts.height ?? 600
  const N = opts.frames ?? 30
  const up = opts.pnl >= 0
  const accent = up ? "#34D399" : "#F87171"
  const accentSoft = up ? "rgba(52,211,153," : "rgba(248,113,113,"
  const headline = (opts.headline || "AI trading, minus the withdrawal risk").slice(0, 96)
  const curve = buildCurve(opts.pnl, 90, Math.round(Math.abs(opts.pnl) * 1000) + 11)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  ctx.font = `700 44px "${FONT}"`
  const headlineLines = wrapText(ctx, headline, W - 2 * 72, 2)

  const plot = { left: 72, right: W - 72, top: H - 250, bottom: H - 64 }
  const mid = (plot.top + plot.bottom) / 2
  const amp = (plot.bottom - plot.top) / 2

  const encoder = GIFEncoder()
  for (let f = 0; f < N; f++) {
    const p = f / (N - 1)
    ctx.clearRect(0, 0, W, H)

    // Background: near-black + top glow + faint grid
    ctx.fillStyle = "#0A0D14"
    ctx.fillRect(0, 0, W, H)
    const glow = ctx.createRadialGradient(W * 0.5, -80, 40, W * 0.5, -80, 620)
    glow.addColorStop(0, accentSoft + "0.10)")
    glow.addColorStop(1, "rgba(10,13,20,0)")
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = "rgba(255,255,255,0.035)"
    ctx.lineWidth = 1
    for (let x = plot.left; x <= plot.right; x += 80) {
      ctx.beginPath()
      ctx.moveTo(x, plot.top - 40)
      ctx.lineTo(x, plot.bottom + 20)
      ctx.stroke()
    }
    for (let y = plot.top - 40; y <= plot.bottom + 20; y += 60) {
      ctx.beginPath()
      ctx.moveTo(plot.left, y)
      ctx.lineTo(plot.right, y)
      ctx.stroke()
    }

    // Corner tag: pulsing live dot + PROTOCOL BANK · LIVE/PAPER
    if (Math.sin(f * 0.7) > -0.2) {
      ctx.beginPath()
      ctx.arc(74, 44, 5, 0, Math.PI * 2)
      ctx.fillStyle = accent
      ctx.shadowColor = accent
      ctx.shadowBlur = 12
      ctx.fill()
      ctx.shadowBlur = 0
    }
    ctx.font = `700 17px "${FONT}"`
    ctx.fillStyle = "rgba(255,255,255,0.55)"
    ctx.fillText("PROTOCOL BANK · " + (opts.paper ? "PAPER" : "LIVE"), 92, 50)

    // Kinetic headline: word-by-word reveal (frames 2..14)
    const words = headlineLines.join(" ").split(" ")
    const perWord = 12 / Math.max(1, words.length)
    const revealed = Math.max(0, Math.min(words.length, Math.floor((f - 1.5) / perWord) + 1))
    ctx.font = `700 44px "${FONT}"`
    ctx.fillStyle = "#F5F6F7"
    let drawn = 0
    headlineLines.forEach((line, li) => {
      let x = 72
      const y = 112 + li * 56
      for (const w of line.split(" ")) {
        if (drawn < revealed) ctx.fillText(w, x, y)
        x += ctx.measureText(w + " ").width
        drawn++
      }
    })

    // Chart: gradient area + glowing line drawing itself
    const drawnPts = Math.max(2, Math.floor(curve.length * Math.min(1, (p - 0.18) / 0.55)))
    const ptAt = (i: number): [number, number] => [
      plot.left + ((plot.right - plot.left) * i) / (curve.length - 1),
      mid - curve[i] * amp * 0.8,
    ]
    ctx.beginPath()
    ctx.moveTo(plot.left, plot.bottom)
    for (let i = 0; i < drawnPts; i++) {
      const [x, y] = ptAt(i)
      ctx.lineTo(x, y)
    }
    ctx.lineTo(ptAt(drawnPts - 1)[0], plot.bottom)
    ctx.closePath()
    const area = ctx.createLinearGradient(0, plot.top, 0, plot.bottom)
    area.addColorStop(0, accentSoft + "0.22)")
    area.addColorStop(1, accentSoft + "0)")
    ctx.fillStyle = area
    ctx.fill()
    ctx.beginPath()
    for (let i = 0; i < drawnPts; i++) {
      const [x, y] = ptAt(i)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = accent
    ctx.lineWidth = 3.5
    ctx.lineJoin = "round"
    ctx.shadowColor = accent
    ctx.shadowBlur = 16
    ctx.stroke()
    ctx.shadowBlur = 0
    const [hx, hy] = ptAt(drawnPts - 1)
    ctx.beginPath()
    ctx.arc(hx, hy, 12 + Math.sin(f * 0.8) * 2.5, 0, Math.PI * 2)
    ctx.fillStyle = accentSoft + "0.18)"
    ctx.fill()
    ctx.beginPath()
    ctx.arc(hx, hy, 5.5, 0, Math.PI * 2)
    ctx.fillStyle = accent
    ctx.shadowColor = accent
    ctx.shadowBlur = 10
    ctx.fill()
    ctx.shadowBlur = 0

    // Odometer count-up of the number (frames 15..27)
    if (f >= 15) {
      const t = Math.min(1, (f - 15) / 12)
      const shown = Math.abs(opts.pnl) * easeOutCubic(t)
      const text = `${up ? "+" : "−"}$${shown.toFixed(2)}`
      ctx.font = `700 62px "${FONT}"`
      ctx.fillStyle = accent
      ctx.shadowColor = accentSoft + "0.5)"
      ctx.shadowBlur = 18
      ctx.fillText(text, W - 72 - ctx.measureText(text).width, 132)
      ctx.shadowBlur = 0
      if (opts.sub) {
        ctx.font = `700 19px "${FONT}"`
        ctx.fillStyle = "rgba(255,255,255,0.45)"
        const sw = ctx.measureText(opts.sub).width
        ctx.fillText(opts.sub.slice(0, 34), W - 72 - sw, 164)
      }
    }

    const rgba = ctx.getImageData(0, 0, W, H).data
    const palette = quantize(rgba, 128, { format: "rgb565" })
    const indexed = applyPalette(rgba, palette)
    encoder.writeFrame(indexed, W, H, { palette, delay: 60 })
  }
  encoder.finish()
  return encoder.bytes()
}
