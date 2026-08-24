import type { MetadataRoute } from "next"

/**
 * Sitemap for the public product surface.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://protocolbanks.com"
  const now = new Date()

  const routes = [
    { path: "", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/trading", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/help", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/guides/ai-crypto-trading", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/guides/is-ai-trading-safe", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/guides/hyperliquid-trading-bot", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/guides/crypto-paper-trading", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/guides/best-ai-trading-bots", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/guides/what-is-hyperliquid", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/guides/ai-trading-strategies", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/risk-disclosure", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/terms", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/privacy", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/security", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/products", priority: 0.6, changeFrequency: "weekly" as const },
    { path: "/contact", priority: 0.4, changeFrequency: "yearly" as const },
  ]

  return routes.map((r) => ({
    url: `${baseUrl}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))
}
