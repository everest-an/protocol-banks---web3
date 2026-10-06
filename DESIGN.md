# DESIGN.md — Protocol Bank landing (paper-terminal direction)

Direction chosen by the owner: **paper-terminal** (reference: aptoslabs.com) — warm paper canvas, visible 1px rules, mono meta-labels, one accent, no gradients, no glass, no AI-gradient decoration. Reference for restraint + real proof: frax.com (type + partner marks, zero ornament).

## 0. Research log

- **Skill route (frontend):** `redesign-skill.md` (existing-UI audit workflow) + `minimalist-skill.md` (Layer A style: editorial, warm monochrome, 1px rules, mono meta, Phosphor/Radix-style icons; no Inter, no gradients, no pills, no heavy shadows).
- **Live references (runtime extraction, 2026-10-06):**
  - `frax.com` — near-black canvas, one huge grotesque headline, one mint sub-line, one blue action, a partner-logo wall under the fold. No ornament.
  - `aptoslabs.com` — paper-white canvas with a visible ruled frame, condensed uppercase display type, terminal labels `[ … ]`, version tag `V1.01`, vertical scroll rails, a real technical wireframe as the hero object.
- **Our audit:** copy is specific (Hyperliquid, PnL, paper mode, 20% profit share) — keep it. Problems were visual: blue radial-dot WebGL ornament, blue gradients in headings/sections, glassmorphism cards everywhere, perfectly symmetric 3/4-card template stacks, no trust marks, uppercase-tracked labels in title case.

## 1. Direction statement

A **research-catalog for a trading agent**: warm paper, hairline rules, mono labels that read like terminal headings, ink-black type, and **real artifacts** (a terminal window with the agent's log + a live market strip) instead of decorative graphics. The page should read like documentation for a machine that trades — precise, calm, verifiable. One signature moment: the terminal window in the hero.

## 2. Color tokens

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F7F6F3` | page canvas (warm bone) |
| `--surface` | `#FFFFFF` | cards / terminal window body |
| `--ink` | `#111111` | headings, primary text |
| `--ink-2` | `#6F6B64` | secondary text (warm gray) |
| `--rule` | `#E4E2DD` | all 1px borders / section rules |
| `--accent` | existing product blue (`text-primary` / `bg-primary`) | single accent: links, active dot, one word in the hero |
| `--ok` | `#1F7A4D` | checklist statuses (desaturated green) |
| `--warn` | `#8A6116` | "max loss" figures (desaturated amber) |

No other hues. No gradients. No `backdrop-blur` on the landing.

## 3. Typography

- **Sans** — the app's existing stack (Geist-family / system). Headings: tight tracking (`tracking-tight`), tight leading (`leading-[1.05]`–`[1.15]`), sentence case; hero may set uppercase.
- **Mono** — `font-[family-name:var(--font-mono)]`/`font-mono` for: section labels, numbers, wallet addresses, timestamps, version tag, ticker figures.
- Scale: display `text-5xl→7xl`; h2 `text-3xl→4xl`; body `text-base→lg` (`--ink-2`, `leading-relaxed`, `max-w-[65ch]`); labels `text-[11px] tracking-[0.08em]`.
- Tabular numbers (`tabular-nums`) on every figure.

## 4. Space & layout

- Frame: content in `mx-auto max-w-6xl` with **1px side rules** visible on ≥md (catalog look); sections separated by full-width 1px `--rule` lines, `py-24`.
- Bento/asymmetry over symmetry: grids of 3 → 2-col rows (steps), 4 → checklist rows. No three-equal-cards feature rows.
- No `h-screen`; use `min-h-[100dvh]` where full-height is needed.

## 5. Primitives

- `[ label ]` — mono, lowercase, `--ink-2`, brackets literal: `[ how it works ]`.
- **Rule card** — `rounded-lg border border-[--rule] bg-white p-6`, no shadow, no blur.
- **Terminal window** — white body, 1px rule, a title bar with three 6px gray dots + mono title (`agent — live`), mono log rows.
- **Primary CTA** — near-black (`bg-neutral-900 text-neutral-50`), `rounded-md`, hover `bg-neutral-800`, active `scale-[0.98]`. Secondary — 1px rule outline on paper.
- **Brand chip** — official mark (SVG/PNG from `public/brands/`) + wordmark in mono, `--ink-2`.

## 6. Iconography

- Integration marks: **official assets** (`public/brands/metamask.svg`, `walletconnect.svg`, `hyperliquid.png`).
- System icons: minimal inline SVG / existing lucide only where unavoidable; no icon-per-bullet decoration.

## 7. Motion

Subtle only: fade + `translateY(12px)` on section entry (IntersectionObserver, 600ms, `cubic-bezier(.16,1,.3,1)`), transform/opacity only. No scroll-jacking, no parallax, no decorative loops except the existing status dot pulse.

## 8. Accessibility & accepted debt

- Contrast: `--ink` on paper ≥ 15:1; `--ink-2` ≥ 4.6:1; focus-visible rings preserved on all interactive elements.
- **Accepted debt:** brand font not yet swapped (no new font requested); reveal-on-scroll currently applied to major sections only; `UnicornHero` component left in the repo unused (delete in a later pass).
