import { NextResponse, type NextRequest } from "next/server"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { createMcpServer } from "@/lib/mcp/server"
import { authenticateMcpRequest } from "@/lib/mcp/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function handle(request: NextRequest): Promise<Response> {
  if (process.env.MCP_SERVER_ENABLED === "false") {
    return NextResponse.json({ error: "MCP server is disabled" }, { status: 503 })
  }

  const authCtx = await authenticateMcpRequest(request.headers.get("authorization"))
  const server = createMcpServer(() => authCtx)
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true })
  await server.connect(transport)
  return transport.handleRequest(request)
}

export async function POST(request: NextRequest) {
  try {
    return await handle(request)
  } catch (error) {
    console.error("[MCP Route] Error:", error)
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null,
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function DELETE(request: NextRequest) {
  return handle(request)
}
