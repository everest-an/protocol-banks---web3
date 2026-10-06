# ProtocolBank — Telegram ⇄ Discord 双向同步桥

把 **ProtocolBank Telegram 群** 和 **Protocol Bank Discord 频道** 打通：
- TG 群新消息 → 转发到 Discord 频道
- Discord 频道新消息 → 转发回 TG 群
- （可选）TG 群里 @机器人 / 触发词 → LLM 自动回答

> ⚠️ **重要：本 bot 不能部署到 Vercel。**
> Vercel 是 Serverless，无法维持 Discord 网关的常驻 WebSocket。
> 本项目网站部署在 Vercel，但**这个桥要放到一台 VPS 上跑**（可直接复用 Awareness 那台 Vultr，作为第二个容器）。

---

## 0. 前置条件

### Telegram
1. 机器人 **@Gavis0bot** 已加入 ProtocolBank 群。
2. 机器人是**群管理员**（已确认：status=administrator）。若新建群，需重新设置。

### Discord
1. Developer Portal → App **ProtocolBank AI** → Bot → 打开 **Message Content Intent**。
2. 机器人已加入 Protocol Bank 服务器，对目标频道有发送消息权限。

---

## 1. 本地测试

```bash
cd tg-discord-bridge
npm install
npm start        # 读取同目录 .env
```

---

## 2. 部署到 VPS（复用 Awareness 的 Vultr）

```bash
# 传到服务器
scp -r "tg-discord-bridge" root@YOUR_VULTR_IP:/opt/protocolbank-bridge
ssh root@YOUR_VULTR_IP
cd /opt/protocolbank-bridge
nano .env        # 确认 token / 群ID / 频道ID
docker compose up -d --build
docker compose logs -f
```

同一台 VPS 上可以同时跑 Awareness 和 ProtocolBank 两个桥（容器名不同，互不影响）：

```bash
docker ps
# awareness-tg-discord-bridge
# protocolbank-tg-discord-bridge
```

### 或用 pm2
```bash
npm i -g pm2
npm install
pm2 start bridge.js --name protocolbank-bridge --node-args="--env-file=.env"
pm2 save && pm2 startup
```

---

## 3. 环境变量

| 变量 | 说明 |
|---|---|
| `BRIDGE_NAME` | 日志名 |
| `TG_TOKEN` | Gavis bot token |
| `TG_CHAT_ID` | ProtocolBank 群 ID（`-1003720412874`） |
| `DISCORD_TOKEN` | ProtocolBank AI bot token |
| `DISCORD_CHANNEL_ID` | 目标频道 ID（如 `#general-chat`） |
| `LLM_API_KEY` | 可选，填了才启用 AI 自动回答 |
| `AI_TRIGGER` | 可选触发词 |

---

## 4. 常见问题

| 现象 | 解决 |
|---|---|
| `Used disallowed intents` | Portal 打开 Message Content Intent |
| 收不到普通群消息 | bot 需为管理员（或 BotFather 关 privacy） |
| 部署到 Vercel 后无反应 | Vercel 跑不了常驻 bot → 改用 VPS |
| 国内 VPS 连不上 | 必须用**境外** VPS |

---

## 5. 豆包 AI（自动回答）+ 群主命令

### 5.1 同机启动 doubao-free-api
```bash
cd /opt/doubao-free-api
npm install && npm run build
pm2 start dist/index.js --name doubao-free-api   # 监听 8000
```
`.env` 设置：
```
LLM_API_KEY=<DOUBAO_SESSIONID>     # 豆包 sessionid，不是官方 key
LLM_BASE_URL=http://127.0.0.1:8000/v1/chat/completions
LLM_MODEL=doubao
AI_AUTO=mention     # mention | all | off
```
⚠️ sessionid 约 30 天过期，失效后更新 `.env`。

### 5.2 群主私聊命令
群主（`OWNER_TG_ID`）私聊 `@Gavis0bot`：
```
/help /ask /say /announce /pin /mute /unmute /ban /unban /kick /id
```
（Gavis 已是 ProtocolBank 群管理员，管理命令可直接用。）

---

## 5.5 邀请激励（Referrals）—— 让成员帮你拉人

- 群成员发 **`/invite`** → 专属邀请链接；**`/top`** 看邀请榜。
- 归因靠 `chat_member` 更新（已在 `allowed_updates` 里）。
- 计数写入 **`referrals.json`**；Docker **必须挂卷**（compose 已配 `./data:/app/data`）。
- `REF_REWARD_AT=5`：邀请满 5 人自动播报达标。
- 前置：bot 是**管理员**且有 **"邀请用户"** 权限。

> ⚠️ 平台不允许 bot 主动加人；"自动加人"唯一合规落地 = **自动归因 + 自动激励**，拉人交给人。

---

## 6. 安全

- `.env` 含密钥，**已 gitignore，勿提交**。
- 泄露请立刻在 BotFather / Developer Portal 重置。
