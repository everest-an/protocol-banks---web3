import Link from "next/link"

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="border-b border-[#E4E2DD] bg-[#F7F6F3]">
        <div className="mx-auto max-w-5xl px-4 py-3 font-mono text-[11px] leading-relaxed text-[#6F6B64]">
          [ note ] Protocol Bank is the control plane for agent money. The cockpit is a demo; build with the{" "}
          <Link href="/agent-api" className="text-primary underline underline-offset-2">
            Agent API
          </Link>
          .
        </div>
      </div>
      {children}
    </>
  )
}
