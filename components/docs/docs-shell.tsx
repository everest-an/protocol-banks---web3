import Link from "next/link"
import { DocBody } from "@/components/docs/doc-body"
import { DOC_PAGES, docHref, otherLocale, type DocLocale, type DocPage } from "@/lib/docs/content"

const LABELS: Record<DocLocale, Record<string, string>> = {
  en: {
    overview: "Overview",
    quickstart: "Quickstart",
    concepts: "Concepts",
    api: "API reference",
    security: "Security",
    docs: "[ docs ]",
    switch: "中文",
    apiLink: "Agent API",
    pricing: "Pricing",
    start: "Create a key",
  },
  zh: {
    overview: "总览",
    quickstart: "快速开始",
    concepts: "概念",
    api: "API 参考",
    security: "安全模型",
    docs: "[ 文档 ]",
    switch: "English",
    apiLink: "Agent API",
    pricing: "价格",
    start: "创建 Key",
  },
}

export function DocsShell({ locale, page }: { locale: DocLocale; page: DocPage }) {
  const labels = LABELS[locale]
  const pages = DOC_PAGES[locale]
  const other = otherLocale(locale)
  const otherHref = docHref(other, page.id)

  return (
    <main className="min-h-screen bg-[#F7F6F3] text-[#111111]">
      <div className="mx-auto w-full max-w-6xl md:border-x border-[#E4E2DD] px-6 md:px-10 py-12 sm:py-16">
        <div className="flex items-center justify-between">
          <Link href={docHref(locale, "overview")} className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">
            {labels.docs}
          </Link>
          <div className="flex items-center gap-4 font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">
            <Link href="/agent-api" className="hover:text-[#111111] transition-colors">
              {labels.apiLink}
            </Link>
            <Link href="/pricing" className="hover:text-[#111111] transition-colors">
              {labels.pricing}
            </Link>
            <Link href={otherHref} className="hover:text-[#111111] transition-colors">
              {labels.switch}
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-10 lg:flex-row">
          <aside className="lg:w-56 lg:shrink-0">
            <nav className="flex flex-wrap gap-x-5 gap-y-2 lg:flex-col lg:gap-1">
              {pages.map((entry) => (
                <Link
                  key={entry.id}
                  href={docHref(locale, entry.id)}
                  className={`rounded-md px-3 py-2 text-sm transition-colors ${
                    entry.id === page.id
                      ? "bg-white font-medium text-[#111111]"
                      : "text-[#6F6B64] hover:text-[#111111]"
                  }`}
                >
                  {labels[entry.id] ?? entry.id}
                </Link>
              ))}
            </nav>
            <Link
              href="/settings/api-keys"
              className="mt-6 hidden lg:inline-flex w-full items-center justify-center rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-50 hover:bg-neutral-800 transition"
            >
              {labels.start}
            </Link>
          </aside>

          <article className="min-w-0 flex-1">
            <h1 className="max-w-[30ch] text-3xl sm:text-4xl font-bold tracking-tight leading-[1.1]">{page.title}</h1>
            <p className="mt-5 max-w-[62ch] text-base leading-relaxed text-[#6F6B64]">{page.description}</p>
            <DocBody blocks={page.blocks} />
          </article>
        </div>
      </div>
    </main>
  )
}
