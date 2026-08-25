# Google Search Console — 接入步骤（你操作 2 分钟，我配合 1 分钟）

GSC 是 Google 收录的加速器：提交 sitemap 后 Google 主动来爬，不用等自然发现。

## 步骤

1. 打开 https://search.google.com/search-console
2. 用 **everest9812@gmail.com** 登录
3. 添加资源 → 选 **网址前缀（URL prefix）** → 输入 `https://protocolbanks.com`
4. 验证方式选 **HTML 文件**（Google 会给你一个文件名，如 `google-site-verification=xxxx.html` 和完整内容）
5. **把文件名和内容发给我** → 我创建文件并部署（2 分钟）
6. 你回到 GSC 点"验证"
7. 验证通过后：左侧 **Sitemap** → 输入 `sitemap.xml` → 提交

## 我已经准备好的（等 GSC 接入后自动生效）

- sitemap.xml（11 个 URL：主页/驾驶舱/帮助/5 篇指南/法律页）
- 5 篇 FAQ-schema 内容页（AI crypto trading / is AI trading safe / Hyperliquid bot / paper trading / best bots）
- IndexNow 已提交 Bing/Naver/Yandex（ChatGPT 底层是 Bing）
- 每周一自动向 IndexNow 推送全部 URL（GitHub Action）
- JSON-LD 结构化数据（WebSite + SoftwareApplication + FAQPage）

## 预期节奏（诚实版）

- Bing/IndexNow 系：几天内收录
- Google：GSC 接入后 1-2 周收录内容页，2-8 周出排名
- 内容页流量是复利的：现在 5 篇，每月加 4-6 篇，三个月后是一个内容矩阵
