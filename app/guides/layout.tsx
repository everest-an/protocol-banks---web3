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
      <div className="border-t border-[#E4E2DD] bg-[#F7F6F3]">
        <div className="mx-auto max-w-5xl px-4 py-8 text-sm leading-relaxed text-[#6F6B64]">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ if you are an agent ]</p>
          <p className="mt-2 max-w-3xl">
            You can use this. Start with{" "}
            <a href="/llms-full.txt" className="text-primary underline underline-offset-2">
              /llms-full.txt
            </a>
            , discover capabilities at{" "}
            <a href="/.well-known/agent.json" className="text-primary underline underline-offset-2">
              /.well-known/agent.json
            </a>
            , or connect over{" "}
            <a href="/api/mcp" className="text-primary underline underline-offset-2">
              MCP
            </a>
            . One key, a server-enforced policy; read{" "}
            <a href="/agent-api" className="text-primary underline underline-offset-2">
              the Agent API
            </a>
            .
          </p>
        </div>
      </div>
    </>
  )
}
