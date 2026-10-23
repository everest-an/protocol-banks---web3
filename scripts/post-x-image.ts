/**
 * Post an image with a caption, through the official API.
 *
 *   npx tsx -r dotenv/config scripts/post-x-image.ts --image docs/growth/x-agent/out/receipt.png
 *
 * The caption is read from `<image>.txt` (same basename + .txt) so multi-line
 * text never has to survive shell quoting. Refuses captions over 280 chars and
 * captions containing a URL (links cut reach on X).
 */
import crypto from "node:crypto"
import fs from "node:fs"

const CK = process.env.X_CONSUMER_KEY || ""
const CS = process.env.X_CONSUMER_SECRET || ""
const AT = process.env.X_ACCESS_TOKEN || ""
const AS = process.env.X_ACCESS_SECRET || ""

function oauth1(method: string, url: string, params: Record<string, string>): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: CK,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: AT,
    oauth_version: "1.0",
  }
  const enc = (s: string) =>
    encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
  const all = { ...params, ...oauth }
  const base = [method.toUpperCase(), enc(url), enc(Object.keys(all).sort().map((k) => `${enc(k)}=${enc(all[k])}`).join("&"))].join("&")
  oauth.oauth_signature = crypto.createHmac("sha1", `${enc(CS)}&${enc(AS)}`).update(base).digest("base64")
  return "OAuth " + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(", ")
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null
}

async function uploadMedia(bytes: Buffer): Promise<string | null> {
  const data = bytes.toString("base64")
  for (const host of ["https://upload.twitter.com", "https://upload.x.com", "https://api.x.com"]) {
    const url = `${host}/1.1/media/upload.json`
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: oauth1("POST", url, { media_data: data }),
        },
        body: `media_data=${encodeURIComponent(data)}`,
        signal: AbortSignal.timeout(60_000),
      })
      const body = (await res.json().catch(() => null)) as { media_id_string?: string } | null
      if (res.ok && body?.media_id_string) return body.media_id_string
      console.log(`${host} -> HTTP ${res.status} ${JSON.stringify(body ?? {}).slice(0, 120)}`)
    } catch (e) {
      console.log(`${host} -> ${e instanceof Error ? e.message.slice(0, 90) : e}`)
    }
  }
  return null
}

async function main() {
  const imagePath = arg("image")
  if (!imagePath) throw new Error("usage: --image <path.png> (caption from <path>.txt)")
  const text = fs.readFileSync(`${imagePath}.txt`, "utf8").trim()
  const bytes = fs.readFileSync(imagePath)

  console.log(`image ${(bytes.length / 1024).toFixed(0)} KB · caption ${text.length}/280`)
  if (text.length > 280) throw new Error("caption over 280 chars")
  if (/https?:\/\//.test(text)) throw new Error("captions with links get less reach - drop the link")

  const mediaId = await uploadMedia(bytes)
  if (!mediaId) throw new Error("media upload failed")

  const url = "https://api.x.com/2/tweets"
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: oauth1("POST", url, {}) },
    body: JSON.stringify({ text, media: { media_ids: [mediaId] } }),
  })
  const body = (await res.json().catch(() => null)) as { data?: { id?: string }; title?: string; detail?: string } | null
  if (!res.ok || !body?.data?.id) {
    throw new Error(`POST failed HTTP ${res.status} ${body?.title ?? ""} ${body?.detail ?? ""}`)
  }
  console.log(`posted https://x.com/0xPrococolBank/status/${body.data.id}`)
}

main().catch((e) => {
  console.error("FAILED", e instanceof Error ? e.message : e)
  process.exit(1)
})
