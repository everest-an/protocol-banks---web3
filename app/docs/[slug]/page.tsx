import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { DocsShell } from "@/components/docs/docs-shell"
import { DOC_PAGES, docHref, getDocPage } from "@/lib/docs/content"

export const dynamicParams = false

export function generateStaticParams() {
  return DOC_PAGES.en.filter((page) => page.id !== "overview").map((page) => ({ slug: page.id }))
}

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const page = getDocPage("en", slug)
  if (!page) notFound()
  const path = docHref("en", page.id)
  return {
    title: `${page.title} — Protocol Bank docs`,
    description: page.description,
    alternates: {
      canonical: `https://protocolbanks.com${path}`,
      languages: {
        en: `https://protocolbanks.com${path}`,
        zh: `https://protocolbanks.com${docHref("zh", page.id)}`,
      },
    },
  }
}

export default async function DocsPage({ params }: { params: Params }) {
  const { slug } = await params
  const page = getDocPage("en", slug)
  if (!page) notFound()
  return <DocsShell locale="en" page={page} />
}
