# Listening

[![Vue 3](https://img.shields.io/badge/Vue.js-3.5-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socketdotio&logoColor=white)](https://socket.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Listening 是一款支持多人实时同步播放音乐的 Web 应用程序。房主可以控制播放进度、切歌和更改播放模式，房间内的其他成员可以实时同步收听，体验如临现场的“一起听”功能。

## 核心特性 (Features)

- **实时音乐同步播放**：基于类似 NTP 的时钟同步机制与 Socket.IO，实现客户端与服务端的精准毫秒级播放同步。
- **房间权限管理**：
  - **房主特权**：支持控制播放、暂停、进度调节、切歌、更改播放模式（列表循环、单曲循环、随机播放），并可进行权限转移和撤销。
  - **听众模式**：普通成员仅能调节本地音量，无法干扰房主播放状态。
- **国际化支持 (i18n)**：内置中英文（zh/en）双语切换。
- **现代化 UI**：采用 TailwindCSS v4 构建的类 Spotify 风格暗黑主题音乐播放器界面。
- **用户认证与安全**：基于 `better-sqlite3` 和 `bcrypt` 本地存储用户信息，使用 JWT (JSON Web Token) 进行状态保持和 Socket 鉴权。
- **多音源聚合**：内置定制 API 接口，支持聚合解析多个主流平台的音源。

## 技术栈 (Tech Stack)

### 前端 (Frontend)
- **核心框架**: Vue 3 (Composition API) + TypeScript
- **构建工具**: Vite
- **样式**: TailwindCSS v4
- **路由与状态**: Vue Router + Vue I18n
- **实时通信**: Socket.IO Client

### 后端 (Backend)
- **服务框架**: Express.js + Node.js
- **实时通信**: Socket.IO
- **数据库**: SQLite3 (`better-sqlite3`)
- **认证加密**: JWT (`jsonwebtoken`) + `bcrypt`
- **开发工具**: `ts-node` + `nodemon`

## 安装与运行 (Installation & Usage)

### 环境要求 (Prerequisites)
- [Node.js](https://nodejs.org/) (推荐 >= 18.x)
- npm 

### 1. 克隆项目
```bash
git clone https://github.com/your-username/Listening.git
cd Listening
```

### 2. 安装依赖
项目使用了 npm workspaces 机制，可以在根目录一次性安装所有前后端依赖：
```bash
npm install
```

### 3. 本地开发与运行
根目录的 `package.json` 提供了便捷的启动脚本。运行以下命令将通过 `concurrently` 同时启动前端开发服务器和后端 API 服务：
```bash
npm run dev
```
- 前端服务默认运行在：`http://localhost:5173`
- 后端服务默认运行在：`http://localhost:3000`

### 4. 构建生产版本
同时构建前端和后端代码：
```bash
npm run build
```
运行生产环境后端（注意：生产环境通常需要通过 Nginx/Caddy 等代理前端静态文件和后端接口）：
```bash
npm run start
```

## 项目结构 (Project Structure)

```text
Listening/
├── frontend/                # 前端 Vue3 项目代码
│   ├── src/
│   │   ├── assets/          # 静态资源 (图片、图标等)
│   │   ├── components/      # Vue 核心组件
│   │   ├── utils/           # 工具函数 (包括 lx-engine 音源引擎)
│   │   ├── App.vue          # 根组件
│   │   ├── i18n.ts          # 国际化配置
│   │   └── main.ts          # 前端入口文件
│   ├── index.html           # HTML 模板
│   └── vite.config.ts       # Vite 配置文件
│
├── backend/                 # 后端 Express 项目代码
│   ├── src/
│   │   ├── auth.ts          # 认证逻辑与路由
│   │   ├── db.ts            # SQLite 数据库配置与初始化
│   │   ├── playlist.ts      # 播放列表与房间逻辑
│   │   └── index.ts         # 后端入口与 Socket.IO 服务端逻辑
│   └── LXMUSIC.js           # 自定义音乐 API 逻辑
│
├── package.json             # Root Workspace 配置
└── TODO.md                  # 开发待办与进度记录
```

## 核心同步机制说明

为了保证多端播放的精确同步，本系统采用了时间同步漂移修正机制：
1. **时间偏移计算**：客户端通过与服务端进行 ping-pong 事件交互，计算出网络延迟与时间偏移量 (`serverTimeOffset`)。
2. **精确时间戳**：客户端不直接使用 `Date.now()`，而是通过 `getSyncedTime()` 获取修正后的服务器基准时间。
3. **播放动作下发**：房主进行任何播放操作时，均带有服务器时间戳，其他客户端根据基准时间自动修正漂移并执行播放指令，实现多端无缝协同。

## 许可证 (License)

[MIT License](./LICENSE)
