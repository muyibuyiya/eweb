# EhWeb

<p align="center">
  <b>现代化、专为 iOS Safari 打造的免侧载多站点漫画 / 插画网页阅读器 (PWA)</b>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green" />
</p>

无需越狱、无需 AltStore / SideStore 侧载或每 7 天续签，通过 **iPhone Safari「添加到主屏幕」** 即可获得接近原生 iOS App 的浏览与阅读体验。支持 **Cloudflare Workers** 一键部署、**Docker (NAS/VPS)** 部署以及 **本机 Node.js** 启动。

---

## 核心特性

- **iOS 原生质感界面（PWA）**
  - 适配灵动岛 / 底部安全区、毛玻璃导航栏与底部标签栏。
  - 支持 **跟随系统 / 浅色 / 深色 / 纯黑 OLED** 四种主题。
  - 双列封面卡片与紧凑列表一键切换。
- **多站点集成与顶部胶囊快速切换**
  - 点击顶部站点胶囊弹窗，一键切换 **E-Hentai / ExHentai / Pixiv / 禁漫天堂 (18comic)**。
  - **E-Hentai / ExHentai**：分类筛选、标签搜索、预览雪碧图解析、官方登录接口与云端收藏同步。
  - **Pixiv**：每日 / 每周 / 每月排行、关键词搜索、多图作品阅读器、高清图片代理与官方收藏同步。
  - **禁漫天堂 (18comic)**：前端 Canvas 自动切片还原（反混淆）、多话章节列表、可自定义镜像域名。
- **现代化 iOS 漫画阅读器**
  - 支持 **竖屏条漫连续滚动**、**从左到右**、**从右到左（日漫）** 三种模式。
  - 左右滑屏、三区点击翻页、自动隐藏毛玻璃 HUD、底部进度条跳转、后台预加载、换源重试（`nl`）。
  - **长按图片保存**：弹出 iOS 操作菜单，调用系统原生分享面板一键 **存储到相册**（电脑端直接下载原图）。
- **中文标签翻译（EhTagTranslation）**
  - 内置常用分类与高频标签中文词库，并支持一键同步社区数万条完整中文标签（IndexedDB 本地缓存）。
- **离线演示模式**
  - 内置离线演示数据集，无需配置外网或代理即可完整体验全部 UI 与阅读器手势。

---

## 快速部署

### 方式一：Cloudflare Workers 一键部署（推荐，免费 HTTPS，无需电脑开机）

```bash
npm install
npx wrangler login
npm run cf:deploy
```

部署完成后会生成一个 `https://ehweb-ios.<你的子域名>.workers.dev` 地址，在 iPhone Safari 打开并选择 **分享 → 添加到主屏幕** 即可。

### 方式二：本机 Node.js 启动（局域网 / 代理直连）

```bash
npm install
npm run build
npm start
```

启动后终端会自动输出局域网地址（例如 `http://192.168.x.x:3000`），同 Wi-Fi 下用 iPhone Safari 打开即可。如需代理，可设置环境变量 `HTTPS_PROXY=http://127.0.0.1:7890` 或在页面设置中填写。

### 方式三：Docker 部署（适合 NAS / VPS）

```bash
docker build -t ehweb .
docker run -d -p 3000:3000 --name ehweb ehweb
```

---

## 免责声明

本项目仅为开源前端界面优化与自托管阅读器工具，**不托管、不存储、不分发任何第三方站点的图片或内容**。使用本项目时请自行遵守所在地法律法规以及目标站点的服务条款。本项目以个人自用与学习交流为主，欢迎提交 PR 改进。

## License

[MIT](./LICENSE)
