/**
 * The gate for the daily post. These rules exist because the feed spent
 * thirteen days publishing variations of one template (2026-10-07..20, 0-1
 * like each): internal jargon, star-count filler and repeats have to be
 * refused before anything is sent.
 */
export interface RecentPost {
  id: string
  text: string
  hook: string
  cta: string
  at: string
}

/** A reader cannot care about our A/B numbers, model names or star counts. */
const BANNED_PATTERNS: Array<{ re: RegExp; why: string }> = [
  {
    re: /\b(a\/b|ab harness|6\/7|nl routing|whitelist validator|confirmation gate|velvetflash|deepseek|4b)\b/i,
    why: 'names internal tooling or a model A/B the reader cannot know',
  },
  { re: /[★⭐]|\b\d+\s+stars?\b|\b\d+\s+forks?\b/i, why: 'repo star/fork filler instead of substance' },
  { re: /https?:\/\//i, why: 'a link in the post kills reach' },
]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/** True when a hook reuses a recent hook's wording. */
function repeatsRecentHook(hook: string, recent: RecentPost[]): boolean {
  const words = new Set(norm(hook).split(' ').filter(Boolean))
  if (!words.size) return false
  const prefix = norm(hook).split(' ').slice(0, 4).join(' ')
  return recent.some((r) => {
    const old = new Set(norm(r.hook).split(' ').filter(Boolean))
    if (!old.size) return false
    if (prefix && prefix === norm(r.hook).split(' ').slice(0, 4).join(' ')) return true
    const shared = [...words].filter((w) => old.has(w)).length
    return shared / Math.max(words.size, old.size) > 0.8
  })
}

function lastCta(text: string): string {
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  return lines.length >= 2 ? lines[lines.length - 2] : ''
}

/** Enforced, not just prompted — same checks as the local poster. */
export function validatePost(p: string, recent: RecentPost[] = []): string[] {
  const t = String(p || '').trim()
  const issues: string[] = []
  if (t.length > 280) issues.push(`too long (${t.length} chars)`)
  const tags = t.match(/#[\w-]+/g) || []
  if (tags.length !== 2) issues.push(`needs exactly 2 hashtags (has ${tags.length})`)
  const firstLine = t.split('\n')[0].trim()
  if (firstLine.split(/\s+/).length > 12) issues.push('hook is longer than 12 words')
  if (/^(we|i|our|awareness|protocol)\b/i.test(firstLine)) issues.push('hook must not start with We/I/the product name')
  if (/\b\d+\s+commits?\b|we shipped|we built/i.test(t)) issues.push('reads like a changelog')
  if (/it'?s not .+,\s*it'?s|not because .+because|the result\?/i.test(t)) issues.push('contains an AI-tell')
  if (!/\d/.test(t)) issues.push('missing a concrete number/proof')
  for (const { re, why } of BANNED_PATTERNS) if (re.test(t)) issues.push(why)
  if (recent.length) {
    if (repeatsRecentHook(firstLine, recent)) issues.push('hook repeats one of the last 8 posts')
    const cta = norm(lastCta(t))
    if (cta && recent.some((r) => norm(r.cta) === cta)) issues.push('CTA repeats a recent post — write a new closing line')
  }
  return issues
}
