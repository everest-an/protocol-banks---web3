# Protocol Bank — milestone motion graphic (HyperFrames)

A cinematic 10.5 s motion graphic for milestone posts on X: brand sting →
kinetic headline → the live account's real PnL with a self-drawing equity curve.
Rendered from HTML with [HyperFrames](https://www.hyperframes.dev) (HTML → MP4).

`renders/protocol-bank-milestone.mp4` is the committed render.
`index.html` is the composition; `assets/` holds the brand font (Aeonik Bold) and
a vendored GSAP, so a render needs no network.

## Re-render with current numbers

```bash
npm install                                   # once
npx hyperframes check                         # lint + runtime + layout + contrast gate
npx hyperframes render --quality looks \
  --variables-file vars.json \
  --output renders/protocol-bank-milestone.mp4
```

`vars.json` holds the template variables (values, not defaults):

| Variable | Type   | Meaning                                            |
| -------- | ------ | -------------------------------------------------- |
| `pnl`    | number | Live account cumulative PnL in USD (drives count-up and the up/down colour) |
| `accent` | color  | Brand accent (default `#34D399`)                   |
| `label`  | string | Small line above the number                        |

Read the live value from the database with the same query the daily post uses
(`lib/trading` → `TradingAccount.state_json.account.allTimePnl`, `status: "live"`).

Requirements: Node ≥ 22, FFmpeg, and a local Chrome. Renders write temp frames —
if the system temp drive is small, pass `--frames-cache-dir <dir on a big drive>`.

## Editing

Studio preview (click anything, drag clips, export):

```bash
npx hyperframes preview --background   # then stop it with: preview --stop
```

`npx hyperframes lint` warns `nested_structure_needs_subcomposition` for the three
scenes — they are inlined deliberately (one file, easy to diff); the warning is
about Studio's timeline rows only and does not affect rendering.
