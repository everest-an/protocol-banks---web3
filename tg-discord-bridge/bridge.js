'use strict';
/**
 * Community agent — Telegram <-> Discord bridge + AI answers (with context) + owner commands
 *
 * 1) Relay: Telegram group <-> Discord channel (two-way)
 * 2) AI: when the group mentions the bot / uses AI_TRIGGER, answer with the LLM,
 *        INCLUDING a rolling per-chat conversation history (so it remembers the
 *        previous messages instead of answering statelessly).
 * 3) Owner DM commands: the group owner can DM the bot to manage the group.
 *
 * Config via environment variables (see .env.example).
 */
const { Client, GatewayIntentBits, Events } = require('discord.js');

const NAME = process.env.BRIDGE_NAME || 'bridge';
const TG_TOKEN = process.env.TG_TOKEN;
const TG_CHAT_ID = String(process.env.TG_CHAT_ID || '');
const DC_TOKEN = process.env.DISCORD_TOKEN;
const DC_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const OWNER_TG_ID = String(process.env.OWNER_TG_ID || '');

const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'doubao';
const LLM_SYSTEM = process.env.LLM_SYSTEM_PROMPT || 'You are the community assistant. Answer briefly and helpfully.';
const AI_TRIGGER = (process.env.AI_TRIGGER || '').trim();
const AI_AUTO = (process.env.AI_AUTO || 'mention').toLowerCase(); // mention | all | off
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY || '16', 10);
const HISTORY_TTL_MS = parseInt(process.env.HISTORY_TTL_MS || String(30 * 60 * 1000), 10);

// per-chat rolling conversation history (in memory)
const histories = new Map(); // chatId -> [{ role, content, ts }]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), `[${NAME}]`, ...a);

function need(name, val) {
  if (!val) { console.error(`Missing required env var: ${name}`); process.exit(1); }
}
need('TG_TOKEN', TG_TOKEN);
need('TG_CHAT_ID', TG_CHAT_ID);
need('DISCORD_TOKEN', DC_TOKEN);
need('DISCORD_CHANNEL_ID', DC_CHANNEL_ID);

const sanitize = (s) => String(s || '').replace(/@everyone/gi, '@ everyone').replace(/@here/gi, '@ here');

function pushHist(chatId, role, content) {
  if (!content) return;
  const now = Date.now();
  let h = histories.get(String(chatId)) || [];
  h = h.filter((m) => now - m.ts < HISTORY_TTL_MS);
  h.push({ role, content, ts: now });
  while (h.length > MAX_HISTORY) h.shift();
  histories.set(String(chatId), h);
}

async function post(url, headers, payload, tag) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (res.ok) return await res.json().catch(() => ({}));
      if (res.status === 429) {
        const j = await res.json().catch(() => ({}));
        await sleep((j.retry_after || 2) * 1000);
        continue;
      }
      log(tag, 'error', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return null;
    } catch (e) { log(tag, 'exception', e.message); await sleep(2000); }
  }
  return null;
}

const discordSend = (text) => post(
  `https://discord.com/api/v10/channels/${DC_CHANNEL_ID}/messages`,
  { Authorization: `Bot ${DC_TOKEN}`, 'Content-Type': 'application/json' },
  { content: sanitize(text).slice(0, 1990) }, 'discord:send');

const tgSend = (chatId, text, extra = {}) => post(
  `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
  { 'Content-Type': 'application/json' },
  Object.assign({ chat_id: chatId, text: sanitize(text).slice(0, 4000), disable_web_page_preview: true }, extra), 'tg:send');

const tgCall = (method, body) => post(
  `https://api.telegram.org/bot${TG_TOKEN}/${method}`,
  { 'Content-Type': 'application/json' }, body, 'tg:' + method);

let BOT_USERNAME = '';
async function loadBotIdentity() {
  try {
    const j = await (await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getMe`)).json();
    if (j.ok) BOT_USERNAME = j.result.username || '';
    log('bot username =', BOT_USERNAME);
  } catch (e) { log('getMe failed', e.message); }
}

async function llmAnswer(chatId, extraSystem) {
  if (!LLM_API_KEY) return null;
  const hist = (histories.get(String(chatId)) || []).map(({ role, content }) => ({ role, content }));
  if (!hist.length) return null;
  const messages = [
    { role: 'system', content: LLM_SYSTEM + (extraSystem ? '\n' + extraSystem : '') },
    ...hist,
  ];
  try {
    const res = await fetch(LLM_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_API_KEY}` },
      body: JSON.stringify({ model: LLM_MODEL, messages }),
    });
    if (!res.ok) { log('llm error', res.status, (await res.text().catch(() => '')).slice(0, 200)); return null; }
    const j = await res.json();
    return j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : null;
  } catch (e) { log('llm exception', e.message); return null; }
}

function isAiTriggered(text) {
  if (!LLM_API_KEY || AI_AUTO === 'off') return false;
  const t = (text || '').trim();
  if (AI_TRIGGER && t.toLowerCase().startsWith(AI_TRIGGER.toLowerCase())) return true;
  if (BOT_USERNAME && t.includes('@' + BOT_USERNAME)) return true;
  if (AI_AUTO === 'all') return true;
  return false;
}

// ---------------- Owner DM commands ----------------
const HELP = [
  '🤖 命令（仅群主私聊可用）：',
  '/ask <问题> — 用豆包回答（带上下文）',
  '/say <内容> — 发到群里',
  '/announce <内容> — 发到群里并置顶',
  '/pin <内容> — 同 announce',
  '/mute <user_id> [分钟] — 禁言',
  '/unmute <user_id> — 解除禁言',
  '/ban <user_id> — 封禁',
  '/unban <user_id> — 解封',
  '/kick <user_id> — 踢出',
  '/reset — 清空对话上下文',
  '/id — 显示群 ID / 我的 ID',
  '/help — 帮助'
].join('\n');

async function handleOwnerDM(text, dmChatId) {
  const raw = (text || '').trim();
  const reply = (m) => tgSend(dmChatId, m);
  if (!raw.startsWith('/')) { await reply('群主你好，发 /help 查看命令。'); return; }
  const sp = raw.split(/\s+/);
  const cmd = sp[0].toLowerCase().replace(/@[\w_]+$/, '');
  const rest = raw.slice(sp[0].length).trim();
  const G = TG_CHAT_ID;
  log('owner cmd', cmd);

  switch (cmd) {
    case '/start':
    case '/help':
      return reply(HELP);
    case '/id':
      return reply(`群 ID: ${G}\n你的 ID: ${dmChatId}`);
    case '/reset':
      histories.delete(String(G));
      histories.delete(String(dmChatId));
      return reply('✅ 已清空对话上下文');
    case '/ask': {
      if (!rest) return reply('用法：/ask 你的问题');
      pushHist(dmChatId, 'user', rest);
      const a = await llmAnswer(dmChatId, '你在私聊中为群主回答，简洁准确。');
      if (a) pushHist(dmChatId, 'assistant', a);
      return reply(a ? a : '（豆包没有返回内容，检查 sessionid 是否失效）');
    }
    case '/say': {
      if (!rest) return reply('用法：/say 内容');
      const r = await tgSend(G, rest);
      if (r && r.ok) pushHist(G, 'assistant', rest);
      return reply(r && r.ok ? '✅ 已发送到群' : '❌ 发送失败（检查 bot 是否在群内）');
    }
    case '/announce':
    case '/pin': {
      if (!rest) return reply('用法：/announce 内容');
      const r = await tgSend(G, rest);
      if (r && r.ok) {
        await tgCall('pinChatMessage', { chat_id: G, message_id: r.result.message_id, disable_notification: false });
        pushHist(G, 'assistant', rest);
        return reply('✅ 已发送并置顶');
      }
      return reply('❌ 发送失败（bot 需为管理员才能置顶）');
    }
    case '/mute': {
      const uid = sp[1]; const mins = parseInt(sp[2] || '60', 10);
      if (!uid) return reply('用法：/mute <user_id> [分钟]');
      const until = Math.floor(Date.now() / 1000) + mins * 60;
      const r = await tgCall('restrictChatMember', { chat_id: G, user_id: Number(uid), until_date: until, permissions: { can_send_messages: false } });
      return reply(r && r.ok ? `✅ 已禁言 ${uid} ${mins} 分钟` : `❌ 失败（bot 需管理员）：${r && r.description}`);
    }
    case '/unmute': {
      const uid = sp[1]; if (!uid) return reply('用法：/unmute <user_id>');
      const r = await tgCall('restrictChatMember', { chat_id: G, user_id: Number(uid), permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true } });
      return reply(r && r.ok ? `✅ 已解除禁言 ${uid}` : `❌ 失败：${r && r.description}`);
    }
    case '/ban': {
      const uid = sp[1]; if (!uid) return reply('用法：/ban <user_id>');
      const r = await tgCall('banChatMember', { chat_id: G, user_id: Number(uid) });
      return reply(r && r.ok ? `✅ 已封禁 ${uid}` : `❌ 失败：${r && r.description}`);
    }
    case '/unban': {
      const uid = sp[1]; if (!uid) return reply('用法：/unban <user_id>');
      const r = await tgCall('unbanChatMember', { chat_id: G, user_id: Number(uid), only_if_banned: true });
      return reply(r && r.ok ? `✅ 已解封 ${uid}` : `❌ 失败：${r && r.description}`);
    }
    case '/kick': {
      const uid = sp[1]; if (!uid) return reply('用法：/kick <user_id>');
      await tgCall('banChatMember', { chat_id: G, user_id: Number(uid) });
      const r = await tgCall('unbanChatMember', { chat_id: G, user_id: Number(uid), only_if_banned: true });
      return reply(r && r.ok ? `✅ 已踢出 ${uid}` : `❌ 失败：${r && r.description}`);
    }
    default:
      return reply('未知命令，发 /help 查看。');
  }
}

// ---------------- Telegram poller ----------------
async function tgPoller() {
  let offset = 0;
  const base = `https://api.telegram.org/bot${TG_TOKEN}`;
  log('telegram poller started');
  for (;;) {
    try {
      const j = await (await fetch(`${base}/getUpdates?timeout=30&offset=${offset}`)).json();
      if (!j.ok) { await sleep(3000); continue; }
      for (const u of j.result) {
        offset = u.update_id + 1;
        const m = u.message || u.channel_post;
        if (!m || !m.text) continue;
        if (m.from && m.from.is_bot) continue;
        const chatId = String(m.chat.id);

        if (m.chat.type === 'private') {
          if (OWNER_TG_ID && chatId === OWNER_TG_ID) await handleOwnerDM(m.text, chatId);
          else await tgSend(chatId, '本机器人仅服务社群。群主如需帮助请私聊 /help。');
          continue;
        }
        if (chatId !== TG_CHAT_ID) continue;

        const who = m.from ? `${m.from.first_name || ''}${m.from.last_name ? ' ' + m.from.last_name : ''}`.trim() : 'TG';
        const uname = m.from && m.from.username ? ` (@${m.from.username})` : '';
        pushHist(chatId, 'user', `${who}${uname}: ${m.text}`);
        await discordSend(`**[TG] ${who}${uname}:** ${m.text}`);

        if (isAiTriggered(m.text)) {
          const a = await llmAnswer(chatId);
          if (a) {
            await tgSend(TG_CHAT_ID, a, m.message_id ? { reply_to_message_id: m.message_id } : {});
            pushHist(chatId, 'assistant', a);
          }
        }
      }
    } catch (e) { log('tg poll', e.message); await sleep(3000); }
  }
}

// ---------------- Discord -> Telegram ----------------
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once(Events.ClientReady, (c) => log('discord ready as', c.user.tag));
client.on(Events.MessageCreate, async (msg) => {
  try {
    if (msg.author.bot) return;
    if (String(msg.channelId) !== String(DC_CHANNEL_ID)) return;
    if (!msg.content) return;
    pushHist(TG_CHAT_ID, 'user', `[Discord] ${msg.author.username}: ${msg.content}`);
    await tgSend(TG_CHAT_ID, `[Discord] ${msg.author.username}: ${msg.content}`);
  } catch (e) { log('discord->tg', e.message); }
});

(async () => {
  await loadBotIdentity();
  client.login(DC_TOKEN).catch((e) => log('discord login failed', e.message));
  tgPoller();
  log('agent started');
})();
