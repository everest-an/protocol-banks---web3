"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { encodeFunctionData, erc20Abi, isAddress, parseUnits } from "viem"
import { Check, Copy, ExternalLink, Loader2, RefreshCw, Send, Wallet } from "lucide-react"
import { AEVUM, explorerAddress, explorerTx } from "@/lib/aevum/config"

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
}

function getProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum ?? null
}

function short(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

const AEVUM_CHAIN_PARAMS = {
  chainId: AEVUM.chainIdHex,
  chainName: AEVUM.name,
  nativeCurrency: AEVUM.nativeCurrency,
  rpcUrls: [AEVUM.rpcUrl],
  blockExplorerUrls: [AEVUM.explorer],
}

export default function AevumPayPage() {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("25")
  const [reference, setReference] = useState("")
  const [memo, setMemo] = useState("")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [verifyHash, setVerifyHash] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "pending" | "confirmed" | "error">("idle")
  const [message, setMessage] = useState("")
  const [receipt, setReceipt] = useState<Record<string, unknown> | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    setReference(`PB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
  }, [])

  useEffect(() => {
    const provider = getProvider()
    if (!provider) return

    void provider.request({ method: "eth_accounts" }).then((value) => {
      const accounts = value as string[]
      if (accounts?.[0]) setAccount(accounts[0])
    })
    void provider.request({ method: "eth_chainId" }).then((value) => setChainId(Number.parseInt(String(value), 16)))

    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[]
      setAccount(accounts?.[0] ?? null)
    }
    const onChain = (...args: unknown[]) => setChainId(Number.parseInt(String(args[0]), 16))
    provider.on?.("accountsChanged", onAccounts)
    provider.on?.("chainChanged", onChain)
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts)
      provider.removeListener?.("chainChanged", onChain)
    }
  }, [])

  const connect = async () => {
    const provider = getProvider()
    if (!provider) {
      setMessage("MetaMask was not found. Install MetaMask to continue.")
      return
    }
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[]
      setAccount(accounts?.[0] ?? null)
      setMessage("")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect wallet")
    }
  }

  const ensureAevum = async (provider: EthereumProvider) => {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: AEVUM.chainIdHex }],
      })
    } catch (error) {
      const code = (error as { code?: number })?.code
      if (code !== 4902) throw error
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [AEVUM_CHAIN_PARAMS],
      })
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: AEVUM.chainIdHex }],
      })
    }
    setChainId(AEVUM.chainId)
  }

  const verify = useCallback(async (hash: string) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch("/api/aevum/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: hash, recipient, amount }),
      })
      const body = await response.json()
      if (response.status === 202) {
        setStatus("pending")
        setMessage("Transaction is on Aevum; waiting for the receipt...")
        await new Promise((resolve) => setTimeout(resolve, 3000))
        continue
      }
      if (!response.ok) throw new Error(body?.error || `Verification failed (${response.status})`)
      setReceipt(body)
      setStatus("confirmed")
      setMessage("Payment confirmed on Aevum Testnet.")
      return
    }
    setStatus("pending")
    setMessage("Transaction submitted. Open the explorer to check confirmation.")
  }, [amount, recipient])

  const send = async () => {
    const provider = getProvider()
    if (!provider || !account) {
      await connect()
      return
    }
    if (!isAddress(recipient)) {
      setMessage("Enter a valid recipient address.")
      return
    }
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      setMessage("Enter a positive tUSD8 amount.")
      return
    }

    setStatus("sending")
    setMessage("Confirm the tUSD8 transfer in MetaMask.")
    setReceipt(null)
    try {
      await ensureAevum(provider)
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient as `0x${string}`, parseUnits(amount, AEVUM.token.decimals)],
      })
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: AEVUM.token.address, data }],
      })) as string
      setTxHash(hash)
      setStatus("pending")
      setMessage("Transaction submitted to Aevum. Verifying the tUSD8 transfer...")
      await verify(hash)
    } catch (error) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "Payment failed")
    }
  }

  const units = useMemo(() => {
    try {
      return parseUnits(amount || "0", AEVUM.token.decimals)
    } catch {
      return 0n
    }
  }, [amount])

  const paymentUri = isAddress(recipient)
    ? `ethereum:${AEVUM.token.address}@${AEVUM.chainId}/transfer?address=${recipient}&uint256=${units.toString()}`
    : ""

  const verifyExisting = async () => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(verifyHash.trim())) {
      setStatus("error")
      setMessage("Enter a valid Aevum transaction hash.")
      return
    }
    setStatus("pending")
    setMessage("Checking the Aevum receipt...")
    setReceipt(null)
    setTxHash(verifyHash.trim())
    try {
      await verify(verifyHash.trim())
    } catch (error) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "Could not verify the transaction")
    }
  }

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      setMessage("Clipboard permission was denied.")
    }
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Aevum Payment Rail</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Create a tUSD8 payment request on QDay Aevum Testnet, pay from MetaMask, and verify the
            on-chain receipt. Testnet only — tUSD8 has no monetary value.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Chain {AEVUM.chainId}</span>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{AEVUM.token.symbol}</span>
          <button
            onClick={() => void connect()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Wallet className="h-3.5 w-3.5" />
            {account ? short(account) : "Connect MetaMask"}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Payment request</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-xs text-muted-foreground">Recipient / merchant</span>
              <input
                value={recipient}
                onChange={(event) => setRecipient(event.target.value.trim())}
                placeholder="0x..."
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              />
            </label>
            <label>
              <span className="text-xs text-muted-foreground">Amount (tUSD8)</span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <label>
              <span className="text-xs text-muted-foreground">Reference</span>
              <div className="mt-1 flex gap-2">
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setReference(`PB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)}
                  className="rounded-lg border border-border px-2 text-muted-foreground hover:bg-muted"
                  title="Generate a new reference"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs text-muted-foreground">Memo (optional)</span>
              <input
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="Invoice, order or service reference"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void send()}
              disabled={status === "sending" || status === "pending"}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {status === "sending" || status === "pending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {status === "sending" ? "Confirm in MetaMask" : status === "pending" ? "Verifying..." : "Pay tUSD8"}
            </button>
            <span className="text-xs text-muted-foreground">
              Network: {chainId === AEVUM.chainId ? "Aevum Testnet" : chainId ? `chain ${chainId}` : "not connected"}
            </span>
          </div>

          {message ? (
            <div
              className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                status === "error"
                  ? "border-red-500/30 bg-red-500/5 text-red-600"
                  : status === "confirmed"
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600"
                    : "border-border bg-muted/30 text-muted-foreground"
              }`}
            >
              {message}
            </div>
          ) : null}

          <div className="mt-5 rounded-lg border border-dashed border-border p-3">
            <p className="text-xs font-medium">Already paid? Verify a receipt</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Paste an Aevum transaction hash; the server checks the tUSD8 contract log against the
              recipient and amount above.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                value={verifyHash}
                onChange={(event) => setVerifyHash(event.target.value.trim())}
                placeholder="0x transaction hash"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => void verifyExisting()}
                disabled={status === "pending"}
                className="rounded-lg border border-border px-3 text-xs hover:bg-muted disabled:opacity-50"
              >
                Verify
              </button>
            </div>
          </div>

          {txHash ? (
            <div className="mt-4 rounded-lg border border-border p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Transaction</span>
                <a
                  href={explorerTx(txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-primary underline underline-offset-2"
                >
                  {short(txHash)} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {receipt ? (
                <div className="mt-2 space-y-1 text-muted-foreground">
                  <p>From: {String(receipt.from ?? "—")}</p>
                  <p>To: {String(receipt.to ?? recipient)}</p>
                  <p>
                    Amount: {String(receipt.amount ?? amount)} {AEVUM.token.symbol}
                  </p>
                  <p>Block: {String(receipt.blockNumber ?? "—")}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <h2 className="text-sm font-semibold">Scan to pay</h2>
            <p className="mt-1 text-xs text-muted-foreground">ERC-681 request, pinned to Aevum chain 44005.</p>
            <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-3">
              {paymentUri ? (
                <QRCodeSVG value={paymentUri} size={190} />
              ) : (
                <div className="flex h-[190px] w-[190px] items-center justify-center text-xs text-neutral-500">
                  Enter a valid recipient
                </div>
              )}
            </div>
            <p className="mx-auto mt-3 max-w-full break-all font-mono text-[10px] text-muted-foreground">
              {paymentUri || "—"}
            </p>
            <button
              type="button"
              disabled={!paymentUri}
              onClick={() => void copy("uri", paymentUri)}
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary disabled:opacity-40"
            >
              {copied === "uri" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied === "uri" ? "Copied" : "Copy payment link"}
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 text-xs text-muted-foreground">
            <h2 className="text-sm font-semibold text-foreground">What gets verified</h2>
            <ul className="mt-2 space-y-1.5">
              <li>• Receipt status is successful on QDay Aevum.</li>
              <li>• Log address is the official tUSD8 contract.</li>
              <li>• Transfer recipient and exact 6-decimal amount match.</li>
              <li>• Explorer receipt is linked for independent verification.</li>
            </ul>
            <p className="mt-3">
              tUSD8 contract:{" "}
              <a
                href={explorerAddress(AEVUM.token.address)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-primary underline underline-offset-2"
              >
                {short(AEVUM.token.address)}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
