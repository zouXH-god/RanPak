# Ran-Pak 项目结构与功能描述

> 一个基于 **Electron + Vue 3 + Node 本地 API** 的桌面工具应用，集成 DNS 云解析管理、文件管理、图片编辑和活动地图展示等功能。

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面端 | Electron | 窗口管理、启动内置 Node API、加载前端应用 |
| 前端 | Vue 3 + Vite + Element Plus + Tailwind CSS | SPA 界面 |
| App 内置 API | Express | 本地 HTTP API，默认 `127.0.0.1:8000` |
| 图片处理 | sharp | 图片工作流处理与导出 |
| 视频处理 | ffmpeg / ffprobe | 通过设置页配置外置二进制路径，留空时使用系统 PATH |
| Live2D | 外置资源包 + 本地 runtime | 模型、贴图、动作等大数据不进入仓库和安装包 |
| DNS SDK | 阿里云 SDK、腾讯云 SDK、Cloudflare、GoDaddy REST API | 多云 DNS 适配 |

## 原 Python 后端功能总结

旧版 `server/` FastAPI 后端主要承担三类能力：

- DNS 云解析管理：读取 `config.yaml`，适配阿里云、腾讯云、Cloudflare、GoDaddy，提供域名、解析记录 CRUD 与状态切换。
- 文件管理：浏览本机文件系统、读取文本文件、删除文件或目录、按正则批量重命名，并保留 Windows 盘符列表逻辑。
- 图片处理：上传图片、执行裁剪/旋转/缩放/滤镜/文字/贴纸等工作流、预览、导出、批处理、贴纸列表和临时图片读取。

这些能力已经迁入 Electron `app/` 内置 Node HTTP 服务，项目不再依赖 Python 运行时，也不再通过 Electron spawn Python。

## 项目结构

```text
ran-pak/
├── app/                              # Electron 桌面应用与内置 API
│   ├── main.js                       # 主进程：启动 Node API、创建窗口、加载前端
│   ├── preload.js                    # 预加载脚本：暴露平台与 API base URL
│   ├── config/
│   │   └── dns.yaml                  # DNS 访问配置，GoDaddy 支持 base_url
│   ├── services/
│   │   ├── api-server.js             # Express API 路由注册
│   │   ├── auth.js                   # 本地 API Token
│   │   ├── config.js                 # 配置与运行目录
│   │   ├── response.js               # 统一响应格式
│   │   ├── dns/                      # DNS provider 适配层
│   │   ├── files/                    # 文件管理能力
│   │   └── image/                    # sharp 图片工作流
│   ├── temp/uploads/                 # 临时上传目录
│   └── assets/stickers/              # 贴纸目录
│
├── web/                              # Vue 3 前端
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── router/
│       ├── utils/api/
│       ├── pages/
│       ├── components/
│       └── data/
│
└── docs/
    ├── ISSUES.md
    ├── make.md
    └── PROJECT.md
```

## 功能模块

### DNS 云解析管理

- 支持阿里云 DNS、腾讯云 DNSPod、Cloudflare、GoDaddy。
- 配置文件为 `app/config/dns.yaml`，字段保留 `name/type/access_key_id/access_key_secret`。
- GoDaddy 支持可选 `base_url`，默认 `https://api.godaddy.com`；如使用转发代理，只替换 base URL，路径仍按官方 Domains API。
- GoDaddy 官方 API 没有记录启停状态，接口与前端统一视为不支持状态切换。

### 文件管理

- 浏览文件目录，支持 Windows 根路径盘符检测。
- 读取文件内容、删除文件或目录。
- 正则批量重命名，支持捕获组引用和 `$i` 自增序号。

### 图片编辑

- 上传图片、读取原图、实时预览、导出、批量处理。
- 支持裁剪、旋转、缩放、翻转、亮度、对比度、饱和度、模糊、锐化、灰度、文字、贴纸。
- 使用 `sharp` 处理 PNG/JPEG/WebP/TIFF/GIF 等格式；HEIC/HEIF、ICO 等在当前环境不可用时返回结构化错误。

### 外置工具与资源

- 配置文件保存到 Electron `userData/config/tools.json`。
- FFmpeg 通过设置页配置 `ffmpegPath` 和 `ffprobePath`；字段为空时使用系统 PATH。
- Live2D 模型包不再放入 `web/public` 或安装包。设置页配置资源目录和 `model-catalog.json` 后，应用通过 `/live2d-assets/*` 托管模型文件，通过 `/api/live2d/catalog` 输出标准化 catalog。
- Live2D catalog 为数组，`paths` 和 `cover` 支持相对路径；相对路径以配置的资源目录为根。

## API 接口一览

### 鉴权

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/token` | 获取本地 API Token |

### DNS 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dns/access` | 获取 DNS 访问配置列表 |
| GET | `/api/dns/access/{name}/list` | 获取域名列表 |
| GET | `/api/dns/access/{name}/records` | 获取解析记录 |
| POST | `/api/dns/access/{name}/record` | 新增解析记录 |
| PUT | `/api/dns/access/{name}/record` | 修改解析记录 |
| PUT | `/api/dns/access/{name}/record/status` | 启用/暂停记录，GoDaddy 不支持 |
| DELETE | `/api/dns/access/{name}/record` | 删除解析记录 |

### 文件接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/files/list` | 获取文件列表 |
| GET | `/api/files/read` | 读取文件内容 |
| DELETE | `/api/files/delete` | 删除文件或目录 |
| PUT | `/api/files/rename` | 正则批量重命名 |

### 图片接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/image/upload` | 上传图片 |
| POST | `/api/image/preview` | 工作流预览 |
| POST | `/api/image/process` | 处理并导出图片 |
| POST | `/api/image/batch` | 批量处理图片 |
| GET | `/api/image/stickers` | 获取贴纸列表 |
| GET | `/api/image/file/{image_id}` | 获取已上传原图 |

### 工具配置接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tools/config` | 读取外置工具配置 |
| PUT | `/api/tools/config` | 保存外置工具配置 |
| POST | `/api/tools/ffmpeg/test` | 检测 ffmpeg / ffprobe 可用性 |
| GET | `/api/live2d/catalog` | 读取并标准化 Live2D catalog |
| GET | `/live2d-assets/*` | 读取外置 Live2D 资源文件 |

## 启动方式

```bash
# 1. 启动前端开发服务器
cd web
npm install
npm run dev                        # Vite 开发服务器（端口 5174）

# 2. 启动 Electron 桌面应用
cd app
npm install
npm start                          # 同时启动内置 Node API（端口 8000）
```

开发环境可直接运行根目录 `start.bat`。生产模式下 Electron 会通过内置 API 服务托管 `web/dist` 静态文件。

## 设计特点

- **本地 HTTP 服务**：业务接口迁入 Electron app 内部，保留 `/api/*` 调用形态。
- **统一响应封装**：JSON API 仍返回 `code/message/data`。
- **Provider 适配层**：DNS 服务商统一封装，前端页面不直接感知 SDK 差异。
- **前端低改动迁移**：`serverRequest` 仍作为统一请求入口，API base URL 从 Electron preload 或环境变量读取。
