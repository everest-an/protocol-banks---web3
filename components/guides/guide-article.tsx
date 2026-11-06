import Link from "next/link"

export interface GuideSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export interface GuideFaq {
  q: string
  a: string
}

export function GuideArticle({
  title,
  lead,
  sections,
  faq,
}: {
  title: string
  lead: string
  sections: GuideSection[]
  faq: GuideFaq[]
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Protocol Bank
        </Link>

        <article className="mt-6">
          <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground">[ guide ]</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 font-mono text-xs text-muted-foreground">Last updated: November 2026 · 6 min read</p>
          <p className="mt-6 max-w-[68ch] text-lg leading-relaxed text-muted-foreground">{lead}</p>

          <div className="mt-10 space-y-10">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="mb-3 text-2xl font-bold">{section.heading}</h2>
                <div className="max-w-[68ch] space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {section.paragraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
                {section.bullets ? (
                  <ul className="mt-4 max-w-[68ch] space-y-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {section.bullets.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-lg border border-[#E4E2DD] bg-white p-6">
            <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground">[ build with it ]</p>
            <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
              One API key per agent, server-enforced caps, a trading-only wallet and audit receipts. The cockpit is a
              demo; the Agent API is the product.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/agent-api"
                className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-neutral-50 transition hover:bg-neutral-800"
              >
                Build with the Agent API
              </Link>
              <Link
                href="/docs/quickstart"
                className="inline-flex items-center justify-center rounded-md border border-[#E4E2DD] px-5 py-2.5 text-sm transition hover:bg-[#F7F6F3]"
              >
                Read the quickstart
              </Link>
            </div>
            <p className="mt-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
              For agents:{" "}
              <a href="/llms.txt" className="text-primary underline underline-offset-2">
                /llms.txt
              </a>{" "}
              ·{" "}
              <a href="/.well-known/agent.json" className="text-primary underline underline-offset-2">
                /.well-known/agent.json
              </a>{" "}
              ·{" "}
              <a href="/api/agent.openapi.json" className="text-primary underline underline-offset-2">
                /api/agent.openapi.json
              </a>
            </p>
          </div>

          <section className="mt-12">
            <h2 className="mb-4 text-2xl font-bold">FAQ</h2>
            <div className="space-y-4">
              {faq.map((item) => (
                <div key={item.q} className="rounded-lg border border-[#E4E2DD] bg-white p-5">
                  <h3 className="mb-1.5 font-semibold">{item.q}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="mt-10 text-sm text-muted-foreground">
            Educational content, not financial advice. Read the{" "}
            <Link href="/risk-disclosure" className="underline underline-offset-2 hover:text-foreground">
              Risk Disclosure
            </Link>{" "}
            before enabling live mode.
          </p>
        </article>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />
    </div>
  )
}
