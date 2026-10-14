// Minimal ambient types for gifenc (ships no declarations).
declare module "gifenc" {
  interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: unknown; delay?: number; repeat?: number; transparent?: boolean },
    ): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    reset(): void
  }
  export function GIFEncoder(opts?: Record<string, unknown>): GIFEncoderInstance
  export function quantize(
    rgba: Uint8ClampedArray | Uint8Array,
    maxColors: number,
    opts?: { format?: "rgb565" | "rgb444" | "rgba4444"; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
  ): number[][]
  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array,
    palette: number[][],
    format?: "rgb565" | "rgb444" | "rgba4444",
  ): Uint8Array
}
