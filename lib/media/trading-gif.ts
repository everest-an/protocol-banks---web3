/**
 * Procedural animated-GIF generator for the daily X post.
 *
 * Runs anywhere (pure JS, no canvas/ffmpeg/chromium — it draws into RGBA
 * buffers and encodes with gifenc), so it works inside the Vercel cron. The
 * animation: a glowing equity curve drawing itself over a dark grid, live
 * ticker dots, and the day's number popping in — a self-contained motion
 * graphic, not a screenshot.
 */

import { GIFEncoder, quantize, applyPalette } from "gifenc"

// 5x7 bitmap font — digits + the symbols the number needs.
const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
}

interface Frame {
  data: Uint8ClampedArray
  width: number
  height: number
}

function blendPixel(f: Frame, x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= f.width || y >= f.height || a <= 0) return
  const i = (y * f.width + x) * 4
  const inv = 1 - a
  f.data[i] = f.data[i] * inv + r * a
  f.data[i + 1] = f.data[i + 1] * inv + g * a
  f.data[i + 2] = f.data[i + 2] * inv + b * a
  f.data[i + 3] = 255
}

function fill(f: Frame, r: number, g: number, b: number): void {
  for (let i = 0; i < f.data.length; i += 4) {
    f.data[i] = r
    f.data[i + 1] = g
    f.data[i + 2] = b
    f.data[i + 3] = 255
  }
}

function drawDot(f: Frame, cx: number, cy: number, radius: number, r: number, g: number, b: number, a = 1): void {
  const r2 = radius * radius
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy)
      if (d2 <= r2) {
        const falloff = 1 - Math.sqrt(d2) / (radius + 0.0001)
        blendPixel(f, x, y, r, g, b, a * Math.min(1, 0.25 + falloff))
      }
    }
  }
}

function drawLine(f: Frame, x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, a: number, thickness = 1): void {
  // Bounding-box + distance-to-segment: orders of magnitude faster than
  // stamping a dot per line pixel (the first version timed out the render).
  const t2 = Math.max(1, thickness)
  const half = t2 / 2
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - half - 1))
  const maxX = Math.min(f.width - 1, Math.ceil(Math.max(x0, x1) + half + 1))
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - half - 1))
  const maxY = Math.min(f.height - 1, Math.ceil(Math.max(y0, y1) + half + 1))
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy || 1
  const glow = t2 > 3
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2))
      const px = x0 + t * dx
      const py = y0 + t * dy
      const dist = Math.hypot(x - px, y - py)
      if (dist > half) continue
      const alpha = glow ? a * (0.25 + 0.75 * (1 - dist / half)) : a
      blendPixel(f, x, y, r, g, b, alpha)
    }
  }
}

function drawText(f: Frame, text: string, x: number, y: number, scale: number, r: number, g: number, b: number, alpha = 1): number {
  let cursor = x
  for (const ch of text) {
    const glyph = GLYPHS[ch.toUpperCase()] ?? GLYPHS[" "]
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (glyph[gy][gx] === "1") {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              blendPixel(f, cursor + gx * scale + sx, y + gy * scale + sy, r, g, b, alpha)
            }
          }
        }
      }
    }
    cursor += 6 * scale
  }
  return cursor
}

function measureText(text: string, scale: number): number {
  return text.length * 6 * scale - scale
}

/** Deterministic pseudo-random walk for the curve (seeded by the number). */
function buildCurve(pnl: number, points: number, seed: number): number[] {
  const vals: number[] = [0]
  let s = seed % 2147483647
  const rand = () => {
    s = (s * 48271) % 2147483647
    return s / 2147483647
  }
  const drift = Math.max(-1, Math.min(1, pnl / 25)) // ends where the number does
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

export interface TradingGifOptions {
  /** The number that pops in (e.g. cumulative PnL in USD). */
  pnl: number
  /** Optional line under/above, e.g. "$19.60" or "3 trades". Rendered below the big number. */
  sub?: string
  width?: number
  height?: number
  frames?: number
}

/**
 * Render the animated card. ~1.5s loop, dark theme, drawing equity curve,
 * pulsing live dot and the number popping in.
 */
export function renderTradingGif(opts: TradingGifOptions): Uint8Array {
  const width = opts.width ?? 960
  const height = opts.height ?? 600
  const frames = opts.frames ?? 20
  const up = opts.pnl >= 0
  const accent: [number, number, number] = up ? [52, 211, 153] : [248, 113, 113]
  const number = `${up ? "+" : "-"}$${Math.abs(opts.pnl).toFixed(2)}`
  const curve = buildCurve(opts.pnl, 80, Math.round(Math.abs(opts.pnl) * 1000) + 7)

  const pad = 64
  const plotTop = 150
  const plotBottom = height - 120
  const plotLeft = pad
  const plotRight = width - pad
  const mid = (plotTop + plotBottom) / 2
  const amplitude = (plotBottom - plotTop) / 2

  const pointAt = (i: number): [number, number] => {
    const x = plotLeft + ((plotRight - plotLeft) * i) / (curve.length - 1)
    const y = mid - curve[i] * amplitude * 0.85
    return [x, y]
  }

  const encoder = GIFEncoder()
  for (let f = 0; f < frames; f++) {
    const frame: Frame = { data: new Uint8ClampedArray(width * height * 4), width, height }
    const progress = (f + 1) / frames

    // Background + grid
    fill(frame, 10, 13, 20)
    for (let x = plotLeft; x <= plotRight; x += 64) drawLine(frame, x, plotTop - 20, x, plotBottom + 20, 255, 255, 255, 0.04)
    for (let y = plotTop - 20; y <= plotBottom + 20; y += 64) drawLine(frame, plotLeft, y, plotRight, y, 255, 255, 255, 0.04)
    drawLine(frame, plotLeft, mid, plotRight, mid, 255, 255, 255, 0.08)

    // Curve drawing itself
    const drawn = Math.max(2, Math.floor(curve.length * Math.min(1, progress * 1.25)))
    for (let i = 1; i < drawn; i++) {
      const [x0, y0] = pointAt(i - 1)
      const [x1, y1] = pointAt(i)
      drawLine(frame, x0, y0, x1, y1, accent[0], accent[1], accent[2], 0.18, 7) // glow
      drawLine(frame, x0, y0, x1, y1, accent[0], accent[1], accent[2], 0.95, 2) // core
    }
    // Head dot with pulse
    const [hx, hy] = pointAt(drawn - 1)
    const pulse = 5 + Math.sin(f * 0.9) * 1.6
    drawDot(frame, hx, hy, pulse + 4, accent[0], accent[1], accent[2], 0.25)
    drawDot(frame, hx, hy, pulse, accent[0], accent[1], accent[2], 1)

    // Live indicator (blinking)
    if (f % 10 < 6) drawDot(frame, pad + 6, 56, 5, 52, 211, 153, 1)
    drawLine(frame, pad + 20, 52, pad + 20, 60, 255, 255, 255, 0.6, 2)
    drawLine(frame, pad + 20, 52, pad + 26, 52, 255, 255, 255, 0.6, 2)
    drawLine(frame, pad + 20, 60, pad + 26, 60, 255, 255, 255, 0.6, 2)

    // The number pops in near the end with a tiny overshoot (mirrors the curve)
    if (progress > 0.55) {
      const t = Math.min(1, (progress - 0.55) / 0.25)
      const scale = t < 0.8 ? 9 + t * 3 : 11.4 - (t - 0.8) * 0.5
      const s = Math.max(6, Math.round(scale * 0.75))
      const w = measureText(number, s)
      const x = plotLeft
      const y = 74
      for (let gy = 0; gy < 8; gy++) {
        for (let gx = 0; gx < 6; gx++) {
          // cheap glow behind the glyphs
          drawDot(frame, x + gx * s * 2, y + gy * s * 2, s, accent[0], accent[1], accent[2], 0.05 * t)
        }
      }
      drawText(frame, number, x, y, s, 255, 255, 255, Math.min(1, t * 1.4))
      if (opts.sub) {
        drawText(frame, opts.sub.slice(0, 24), x, y + 7 * s + 16, 3, 160, 170, 190, Math.min(1, t * 1.2))
      }
      void w
    }

    const palette = quantize(frame.data, 128, { format: "rgb565" })
    const indexed = applyPalette(frame.data, palette)
    encoder.writeFrame(indexed, width, height, { palette, delay: 70 })
  }
  encoder.finish()
  return encoder.bytes()
}
