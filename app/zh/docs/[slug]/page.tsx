import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { DocsShell } from "@/components/docs/docs-shell"
import { DOC_PAGES, docHref, getDocPage } from "@/lib/docs/content"

export const dynamicParams = false

export function generateStaticParams() {
  return DOC_PAGES.zh.filter((page) => page.id !== "overview").map((page) => ({ slug: page.id }))
}

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const page = getDocPage("zh", slug)
  if (!page) notFound()
  const path = docHref("zh", page.id)
  return {
    title: `${page.title} — Protocol Bank 文档`,
    description: page.description,
    alternates: {
      canonical: `https://protocolbanks.com${path}`,
      languages: {
        en: `https://protocolbanks.com${docHref("en", page.id)}`,
        zh: `https://protocolbanks.com${path}`,
      },
    },
  }
}

export default async function ZhDocsPage({ params }: { params: Params }) {
  const { slug } = await params
  const page = getDocPage("zh", slug)
  if (!page) notFound()
  return <DocsShell locale="zh" page={page} />
}
