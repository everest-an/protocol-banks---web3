import type { Metadata } from "next"
import { DocsShell } from "@/components/docs/docs-shell"
import { getDocPage } from "@/lib/docs/content"

const page = getDocPage("zh", "overview")!

export const metadata: Metadata = {
  title: `${page.title} — Protocol Bank 文档`,
  description: page.description,
  alternates: {
    canonical: "https://protocolbanks.com/zh/docs",
    languages: {
      en: "https://protocolbanks.com/docs",
      zh: "https://protocolbanks.com/zh/docs",
    },
  },
}

export default function ZhDocsHome() {
  return <DocsShell locale="zh" page={page} />
}
