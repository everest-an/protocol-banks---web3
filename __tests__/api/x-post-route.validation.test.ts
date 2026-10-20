/**
 * The daily post gate. These rules exist because the feed spent thirteen days
 * publishing variations of one template (2026-10-07..20, 0-1 like each): the
 * generator needs to refuse internal jargon, star-count filler and repeats.
 */
import { validatePost, type RecentPost } from "@/app/api/cron/x-post/route"

const GOOD = [
  "Every AI trading agent eventually loses an order.",
  "",
  "Ours never retries a failed submit: it stamps a client order id, then asks the exchange whether that id exists. Found → adopt. Missing → release.",
  "",
  "One exchange outage, zero duplicates, 1 position.",
  "#Hyperliquid #AIAgents",
].join("\n")

const recent = (hook: string, cta: string): RecentPost[] => [{ id: "1", text: "", hook, cta, at: "" }]

describe("x-post validatePost", () => {
  it("accepts a specific, reader-useful post", () => {
    expect(validatePost(GOOD)).toEqual([])
  })

  it("rejects internal tooling and model A/B numbers", () => {
    const bad = [
      "6/7 agreement, 4B vs DeepSeek.",
      "",
      "We routed NL commands through a whitelist validator.",
      "",
      "47 calls, 6 agreed.",
      "#AI #Crypto",
    ].join("\n")
    expect(validatePost(bad)).toContain("names internal tooling or a model A/B the reader cannot know")
  })

  it("rejects repo star/fork filler", () => {
    const bad = [
      "Your agent can trade but never withdraw.",
      "",
      "Trading-only keys keep the worst case at your budget.",
      "",
      "3★, 1 fork on GitHub.",
      "#Hyperliquid #AIAgents",
    ].join("\n")
    expect(validatePost(bad)).toContain("repo star/fork filler instead of substance")
  })

  it("rejects a link (reach killer)", () => {
    const bad = GOOD.replace("One exchange outage", "Read https://example.com — one exchange outage")
    expect(validatePost(bad)).toContain("a link in the post kills reach")
  })

  it("rejects a hook that repeats a recent post", () => {
    const post = GOOD.replace("Every AI trading agent eventually loses an order.", "Every AI trading agent eventually loses an order")
    expect(validatePost(post, recent("Every AI trading agent eventually loses an order.", ""))).toContain(
      "hook repeats one of the last 8 posts",
    )
  })

  it("rejects a repeated closing line", () => {
    const post = [
      "Your agent can trade but never withdraw.",
      "",
      "Trading-only keys keep the worst case at your budget.",
      "",
      "3 failed retries taught us this.",
      "What would you gate?",
      "#Hyperliquid #AIAgents",
    ].join("\n")
    expect(validatePost(post, recent("Something unrelated entirely here", "What would you gate?"))).toContain(
      "CTA repeats a recent post — write a new closing line",
    )
  })

  it("still enforces the basics: length, hashtags, a concrete number", () => {
    expect(validatePost("x".repeat(281))).toContain("too long (281 chars)")
    expect(validatePost("No tags here, just words and 1 number.")).toContain("needs exactly 2 hashtags (has 0)")
    expect(validatePost("A post with no digits at all.\n\nSecond line.\n\nThird line.\n#AI #Crypto")).toContain(
      "missing a concrete number/proof",
    )
  })
})
