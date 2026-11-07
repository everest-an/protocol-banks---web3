import Link from "next/link"
import { ArrowLeft, Clock, Mail } from "lucide-react"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"

export function ComingSoon({ feature, description }: { feature: string; description: string }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-16">
        <GlassCard className="w-full border-dashed">
          <GlassCardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <Badge variant="outline">Coming soon</Badge>
            </div>
            <GlassCardTitle className="mt-4 text-2xl">{feature}</GlassCardTitle>
            <GlassCardDescription>{description}</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent className="space-y-5">
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Why it is not live yet</p>
              <p className="mt-1">
                Provider onboarding, compliance review and end-to-end settlement tests must be complete before this
                feature can accept real funds. We will not show a quote or a working control that no provider backs.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/agent-api" className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background">
                Use the live Agent API
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium dark:border-white/15">
                <Mail className="h-4 w-4" /> Ask about early access
              </Link>
              <Link href="/" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>
    </main>
  )
}
