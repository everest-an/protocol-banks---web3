import type { Metadata } from "next"
import { DocsShell } from "@/components/docs/docs-shell"
import { getDocPage } from "@/lib/docs/content"

const page = getDocPage("en", "overview")!

export const metadata: Metadata = {
  title: "Agent API docs — the control plane for agent money",
  description: "Overview, quickstart, concepts, API reference and security for the Protocol Bank Agent API.",
  alternates: {
    canonical: "https://protocolbanks.com/docs",
    languages: {
      en: "https://protocolbanks.com/docs",
      zh: "https://protocolbanks.com/zh/docs",
    },
  },
}

export default function DocsHome() {
  return <DocsShell locale="en" page={page} />
}
