# Content Auto-Distributor

One content item → cross-posted to every **enabled** channel. Missing keys are skipped, so you can turn channels on one at a time.

```
node post.mjs content/sample-thread.json            # post everywhere enabled
node post.mjs content/sample-thread.json --dry-run  # preview, no network
```

## Channels & what they need

| Channel | Env | Notes |
|---|---|---|
| **Telegram** | `TG_TOKEN` + `TG_CHAT_ID` | works immediately with your bot |
| **Discord** | `DISCORD_TOKEN` + `DISCORD_CHANNEL_ID` | works immediately |
| **X / Twitter** | `X_CONSUMER_KEY/SECRET`, `X_ACCESS_TOKEN/SECRET` | API v2 user context (OAuth 1.0a). **Posting needs a paid X API plan.** |
| **Webhook** | `WEBHOOK_URL` | point at **Buffer / Typefully / Make / n8n** → fan out to IG / TikTok / YouTube / LinkedIn in one call |

> Only channels with env vars set will run. `--dry-run` never touches the network.

## Item format

```json
{
  "title": "short label",
  "text": "single post text (used for TG/Discord/webhook)",
  "thread": ["tweet 1", "tweet 2", "..."],
  "url": "https://...?utm_source=x&utm_medium=thread&utm_campaign=launch"
}
```

## Systemd timer (weekly auto-post)

```ini
# /etc/systemd/system/awareness-distribute.service
[Service]
WorkingDirectory=/opt/awareness/docs/growth/distribute
EnvironmentFile=/opt/awareness/docs/growth/distribute/.env
ExecStart=/usr/bin/node post.mjs content/sample-thread.json
```
```ini
# /etc/systemd/system/awareness-distribute.timer
[Timer]
OnCalendar=Mon 09:00
Persistent=true
[Install]
WantedBy=timers.target
```

## 合规红线

- 只发**你拥有/被授权**的账号；每个平台的**频率限制**要遵守。
- 社媒自动发帖 ≠ 自动获客：**内容质量 + 渠道**才是。别用同一段话刷屏。
- 想覆盖 IG/TikTok：**走 webhook → 排期工具**最省事（官方 API 要 app 审核）。
