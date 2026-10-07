// Telegram bot webhook — plain-language Q&A about the live trading account.
//
// The owner texts the bot; this route assembles REAL data (Hyperliquid venue
// state + the durable ledger) and answers through the same provider chain as
// the poster (OpenRouter -> DeepSeek direct). It also doubles as the home of
// the outbound notification channel (TG_TOKEN/TG_CHAT_ID are the same bot).
//
// Security: optional secret-token header (set via setWebhook secret_token),
// and only the configured owner chat is answered.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const HL_INFO = 'https://api.hyperliquid.xyz/info'

async function venueSnapshot(wallet: string): Promise<string> {
  try {
    const r = await fetch(HL_INFO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: wallet }),
      cache: 'no-store',
    })
    if (!r.ok) return '(行情服务器暂时联系不上)'
    const j = (await r.json()) as {
      marginSummary?: { accountValue?: string }
      assetPositions?: Array<{ position: { coin: string; szi: string; entryPx?: string; unrealizedPnl?: string } }>
    }
    const positions = (j.assetPositions ?? []).filter((p) => Number(p.position.szi) !== 0)
    const lines = positions.map(
      (p) =>
        `${p.position.coin} ${Number(p.position.szi) > 0 ? '多' : '空'} ${Math.abs(Number(p.position.szi))} @ ${p.position.entryPx}，浮盈 ${p.position.unrealizedPnl}`,
    )
    return `交易所净值 $${j.marginSummary?.accountValue ?? '?'}；持仓：${positions.length ? '\n- ' + lines.join('\n- ') : '空仓'}`
  } catch {
    return '(行情服务器暂时联系不上)'
  }
}

async function ledgerSnapshot(): Promise<string> {
  try {
    const rows = await prisma.tradingAccount.findMany({
      where: { status: 'live' },
      select: { wallet_address: true, state_json: true, updated_at: true },
    })
    if (!rows.length) return '(没有 live 账户)'
    const out: string[] = []
    for (const row of rows) {
      const st = row.state_json as {
        cash?: number
        positions?: Array<{ symbol: string; side: string; size: number }>
        account?: { totalEquity?: number; allTimePnl?: number }
        activity?: Array<{ type: string; text: string }>
      } | null
      out.push(
        `账本（${row.wallet_address.slice(0, 10)}…，更新于 ${row.updated_at.toISOString()}）：`,
        `- 现金 $${st?.cash ?? '?'}｜权益 $${st?.account?.totalEquity ?? '?'}｜累计盈亏 $${st?.account?.allTimePnl ?? '?'}`,
        `- 持仓：${(st?.positions ?? []).length ? (st?.positions ?? []).map((p) => `${p.symbol} ${p.side} ${p.size}`).join('，') : '无'}`,
        '- 最近动态：',
      )
      for (const a of (st?.activity ?? []).slice(0, 8)) out.push(`  [${a.type}] ${a.text.slice(0, 140)}`)
    }
    return out.join('\n')
  } catch {
    return '(账本暂时读不到)'
  }
}

async function chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
  const providers: Array<{ url: string; key: string; model: string }> = []
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({ url: 'https://openrouter.ai/api/v1/chat/completions', key: process.env.OPENROUTER_API_KEY, model: 'deepseek/deepseek-v4-flash' })
  }
  if (process.env.DEEPSEEK_API_KEY) {
    providers.push({ url: 'https://api.deepseek.com/chat/completions', key: process.env.DEEPSEEK_API_KEY, model: 'deepseek-flash' })
  }
  let last = 'no provider'
  for (const p of providers) {
    try {
      const r = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({ model: p.model, messages, temperature: 0.4 }),
      })
      if (!r.ok) {
        last = `${p.url} -> ${r.status}`
        continue
      }
      const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const c = j.choices?.[0]?.message?.content
      if (c) return c
      last = 'empty completion'
    } catch (e) {
      last = e instanceof Error ? e.message : 'network error'
    }
  }
  throw new Error('all providers failed: ' + last)
}

async function send(chatId: string, text: string): Promise<void> {
  const token = process.env.TG_TOKEN
  if (!token) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3900), disable_web_page_preview: true }),
    })
  } catch {
    // swallow
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.TG_WEBHOOK_SECRET
  if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let update: { message?: { chat?: { id?: number }; text?: string } }
  try {
    update = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const chatId = update.message?.chat?.id ? String(update.message.chat.id) : ''
  const text = (update.message?.text ?? '').trim()
  const owner = process.env.TG_CHAT_ID ? String(process.env.TG_CHAT_ID) : ''
  if (!chatId || !text || (owner && chatId !== owner)) {
    return NextResponse.json({ ok: true }) // ignore strangers silently
  }

  try {
    const rows = await prisma.tradingAccount.findMany({ where: { status: 'live' }, select: { wallet_address: true }, take: 3 })
    const venueParts: string[] = []
    for (const w of rows) venueParts.push(await venueSnapshot(w.wallet_address))
    const venue = venueParts.join('\n') || '(没有 live 账户)'
    const ledger = await ledgerSnapshot()

    const system = [
      '你是 Protocol Bank 的交易助理，服务账户主人（就是正在和你聊天的人）。用中文、简洁、直接地回答。',
      '产品背景：这是 Protocol Bank 的 AI 自动交易账户 —— AI 在 Hyperliquid 上做永续合约（动量+资金费率信号），agent 钱包只有交易权、永远不能提款；最坏情况=账户里的钱；每仓 ±2.5% 止盈止损，日内 -5% 停新单、-8% 全平；每分钟自动运行。',
      '回答规则：只依据下面提供的实时数据，不编造数字；问进展就概括持仓/盈亏/最近动作；数据缺失就直说。不要用 markdown 表格，用短句或短列表。',
      '',
      '=== 实时数据 ===',
      '【交易所】' + venue,
      '【账本】',
      ledger,
    ].join('\n')

    const answer = await chat([
      { role: 'system', content: system },
      { role: 'user', content: text },
    ])
    await send(chatId, answer)
  } catch (e) {
    await send(chatId, `查询失败：${e instanceof Error ? e.message.slice(0, 200) : 'unknown'}`)
  }

  return NextResponse.json({ ok: true })
}
