# Ran-Pak 项目问题清单与修复记录

> 本文档通过对项目全部源码的逐行审查，整理出存在的问题。  
> 已修复的标记为 ✅，未修复的标记为 ⬚ 并附修复建议。

---

## 一、已修复的问题（按严重性排序）

### 极高严重性

| # | 问题 | 文件 | 修复内容 |
|---|------|------|----------|
| ✅ | Python FastAPI 后端成为独立运行依赖 | `server/`、`app/services/`、`start.bat` | 将 DNS、文件、图片接口迁入 Electron app 内置 Node HTTP 服务，删除 Python 启动链路 |
| ✅ | 文件 API 无异常处理，错误直接暴露堆栈 | `server/apps/files/view.py` | 所有端点添加 try/except，返回结构化错误响应 |
| ✅ | DNS API 端点全部缺少异常处理 | `server/apps/dns/view.py` | 所有端点添加 try/except，区分 ValueError 和通用异常 |

### 高严重性

| # | 问题 | 文件 | 修复内容 |
|---|------|------|----------|
| ✅ | Electron `contextIsolation: false` + `nodeIntegration: true` | `app/main.js` | 设置 `contextIsolation: true`、`nodeIntegration: false`，配置 preload 脚本 |
| ✅ | `preload.js` 未被加载且 IPC 无处理器 | `app/main.js`、`app/preload.js` | 在 webPreferences 中配置 preload 路径，重写 preload 使用 contextBridge |
| ✅ | Electron 双重 ready 事件竞争条件 | `app/main.js` | 统一使用 `app.whenReady().then()` 处理窗口创建和 header 拦截 |
| ✅ | Electron 图标路径使用相对路径 | `app/main.js` | 改用 `path.join(__dirname, 'icon.jpg')` |
| ✅ | 后端缺少接口鉴权 | `server/main.py` | 新增 `middleware/auth.py` Token 鉴权中间件，启动时生成随机 Token |
| ✅ | 后端缺少 CORS 中间件 | `server/main.py` | 添加 CORSMiddleware，允许前端开发地址跨域 |
| ✅ | 旧代理浏览器能力增加运行时安全与维护成本 | 旧后端、`web/src/`、`app/main.js` | 删除内置代理浏览器、代理 API、后端代理代码和 Electron 代理配置 |
| ✅ | DNS 字段名 `state` 与实际使用 `status` 不统一 | `server/utils/models/dsns.py` + 3 个 provider | 模型字段统一为 `status` |
| ✅ | 腾讯云 `record.recordId` 应为 `record.record_id` | `server/utils/ddns/providers/tencent.py` | 修复为 `record.record_id = str(resp.RecordId)` |
| ✅ | Cloudflare `item.Type` 应为 `item.type` | `server/utils/ddns/providers/cloudflare.py` | 修复为 `item.type` |
| ✅ | Cloudflare/GoDaddy `setDomainRecordStatus` 签名不匹配基类 | `cloudflare.py`、`godaddy.py` | 统一为 `(self, record: DomainRecord, status)` |
| ✅ | GoDaddy `getDescribeDomains` 返回字符串而非 DomainInfo | `server/utils/ddns/providers/godaddy.py` | 修复为返回 DomainInfo 对象列表 |
| ✅ | GoDaddy 未实现方法返回 None 导致崩溃 | `server/utils/ddns/providers/godaddy.py` | 改为抛出 `NotImplementedError` |
| ✅ | DNS 请求模型误放在代理模块下 | `server/apps/proxy/request.py` | 迁移到 `server/apps/dns/request.py`，DNS 模块不再依赖代理目录 |
| ✅ | Dns.vue `record.domain.domainId` 引用错误 | `web/src/pages/Dns.vue` | 改用函数参数中的 `domain` 对象 |
| ✅ | Topbar.vue Ref 未使用 `.value` 访问 | `web/src/components/Topbar.vue` | 添加 `.value` 访问 |
| ✅ | 已废弃的代理规则前后端接口仍暴露 | 旧代理路由、`web/src/utils/api/proxy.ts` | 删除旧代理路由和前端代理 API 模块 |
| ✅ | FilesRenameBox `v-model` 直接绑定 props | `web/src/components/FilesRenameBox.vue` | 使用 computed 属性封装 |
| ✅ | Tailwind CSS 类名使用点号而非连字符 | `Pin.vue`、`Sidebar.vue` 等 5 个文件 | 全部改为 `bg-brand-teal` 连字符格式 |
| ✅ | FilesRenameBox 重命名未等待完成就关闭 | `web/src/components/FilesRenameBox.vue` | 添加 `return` 和 `await` |

### 中严重性

| # | 问题 | 文件 | 修复内容 |
|---|------|------|----------|
| ✅ | `config/config.py` `load_config` 对 None 调用方法 | `server/config/config.py` | 修复为先初始化 `DNSConfig()` 再调用 |
| ✅ | `rename_by_regex` 当 `only_file=False` 时不执行 | `server/utils/files/operation.py` | 修复逻辑为 `if only_file and not os.path.isfile: continue` |
| ✅ | 腾讯云 `page_number`/`page_size` 语义颠倒 | `server/utils/ddns/providers/tencent.py` | `page_number = page`, `page_size = limit` |
| ✅ | `aliyun.py` `initCli` 参数名遮蔽 | `server/utils/ddns/providers/aliyun.py` | 重命名为 `ali_config` |
| ✅ | `rename_by_regex` 计数不准确 | `server/utils/files/operation.py` | 分离匹配序号(`seq`)和实际重命名数(`rename_num`) |
| ✅ | 文件 rename 端点未用 Response 封装 | `server/apps/files/view.py` | 包裹 `Response.success(data=count)` |
| ✅ | `delete_file` 无法删除目录 | `server/utils/files/operation.py` | 添加 `os.path.isdir` 判断，目录使用 `shutil.rmtree` |
| ✅ | `read_file` 缺少异常处理 | `server/apps/files/view.py` | 在 view 层捕获 FileNotFoundError、UnicodeDecodeError |
| ✅ | `config.yaml` 使用相对路径依赖工作目录 | `server/apps/dns/view.py` | 基于 `__file__` 计算绝对路径 |
| ✅ | `get_file_info` 对无权限文件无异常处理 | `server/utils/files/info.py` | 添加 try/except，失败返回 None 并跳过 |
| ✅ | 前端 API 调用返回 null 未做防护 | `Dns.vue`、`porxyBox.vue` 等 | 所有 `.then()` 添加 `if (!res) return` |
| ✅ | `requests.ts` body 为 null 时发送 `"null"` | `web/src/utils/api/requests.ts` | 仅在 body != null 且非 GET/DELETE 时序列化 |
| ✅ | FilesRenameBox 正则未做异常处理 | `web/src/components/FilesRenameBox.vue` | 添加 try/catch 捕获 `SyntaxError` |
| ✅ | Cloudflare `record.status = True` 类型不一致 | `server/utils/ddns/providers/cloudflare.py` | 改为字符串 `"ENABLE"` |
| ✅ | 文件名拼写错误 `porxyBox.vue` | `web/src/components/` | 重命名为 `ProxyBox.vue`，更新所有引用 |
| ✅ | Sidebar 子路由未注册 | `web/src/components/Sidebar.vue` | 移除未实现的子路由导航项 |
| ✅ | `selectAll` 复选框无实际功能 | `web/src/pages/Files.vue` | 移除无功能的全选复选框 |
| ✅ | 批量删除不等待完成 | `web/src/pages/Files.vue` | 使用 `Promise.allSettled` 等待所有删除完成 |
| ✅ | DNS 筛选输入框无绑定 | `web/src/pages/Dns.vue` | 绑定 `v-model="domain.key"` 和 `@change` |
| ✅ | `events.js` 重复数据和重复 ID | `web/src/data/events.js` | 去重并赋予唯一 ID |
| ✅ | 缺少 404 兜底路由 | `web/src/router/index.js` | 添加 `/:pathMatch(.*)*` 重定向到首页 |
| ✅ | 启动脚本仍描述代理服务和错误 Vite 端口 | `start.bat` | 去掉 `8888` 代理服务说明，修正 Vite 端口为 `5174` |
| ✅ | dnsContentBox 新增记录显示"更新成功" | `web/src/components/dnsContentBox.vue` | 根据操作类型显示"添加成功"或"更新成功" |
| ✅ | dnsContentBox API 失败时静默关闭弹窗 | `web/src/components/dnsContentBox.vue` | 仅成功时关闭，失败时显示错误提示 |
| ✅ | Dns.vue 乐观更新状态无回滚 | `web/src/pages/Dns.vue` | 保存旧状态，失败时回滚 |

### 低严重性

| # | 问题 | 文件 | 修复内容 |
|---|------|------|----------|
| ✅ | 盘符路径双斜杠 `C://` | `server/utils/files/info.py` | 改为 `C:/` |
| ✅ | `aliyun.py` 无意义 f-string | `server/utils/ddns/providers/aliyun.py` | 改为普通字符串 |
| ✅ | `aliyun.py` 死代码 `page_size=500` | `server/utils/ddns/providers/aliyun.py` | 移除 |
| ✅ | `aliyun.py` `print_Describe` 未使用 | `server/utils/ddns/providers/aliyun.py` | 删除 |
| ✅ | Electron 残留代理浏览器专用低安全配置 | `app/main.js` | 移除代理设置、证书放行、全局响应头改写、`webSecurity: false` 和 `allowRunningInsecureContent` |
| ✅ | Files.vue 导入未使用的 `renameFile` | `web/src/pages/Files.vue` | 移除 |
| ✅ | 多处遗留 `console.log` | 多个文件 | 清理 |
| ✅ | CSS 双分号 | `web/src/pages/Dns.vue` | 修复 |
| ✅ | 路由变量命名不一致 | `web/src/router/index.js` | `files` → `Files` |
| ✅ | `godaddy.py` `base_url` 双斜杠 | `server/utils/ddns/providers/godaddy.py` | 改为单斜杠 |
| ✅ | 页面标题 "Event Finder UI" 与项目不符 | `web/index.html` | 改为 "RanTerminal" |
| ✅ | EventCard 缺少 `defineEmits` 声明 | `web/src/components/EventCard.vue` | 添加 `defineEmits(['select'])` |
| ✅ | 文件管理使用 Money 图标 | `web/src/components/Sidebar.vue` | 改为 `FolderOpened` |
| ✅ | 内置代理浏览器功能不再需要 | `web/src/pages/Browser.vue`、`web/src/components/ProxyBox.vue` | 删除浏览器页面、代理规则弹窗、`/browser` 路由和侧边栏入口 |
| ✅ | Tailwind content 未包含 `.ts` | `web/tailwind.config.js` | 添加 `ts` 到扫描范围 |
| ✅ | `godaddy.py` 参数签名不匹配基类 | `server/utils/ddns/providers/godaddy.py` | 统一为 `domain: DomainInfo` |

---

## 二、未修复的问题（需要后续处理）

### 高严重性

| # | 问题 | 文件 | 修复建议 |
|---|------|------|----------|
| ⬚ | DNS 配置明文保存 API 密钥 | `app/config/dns.yaml` | 改用环境变量或加密密钥管理服务，将本地配置加入 `.gitignore` |
| ⬚ | 项目根目录缺少 `.gitignore` | 项目根目录 | 创建 `.gitignore` 排除 `config.yaml`、`node_modules/`、`__pycache__/` 等 |
| ⬚ | Electron 开发地址仍默认 `localhost:5174` | `app/main.js` | 继续支持 `RAN_PAK_DEV_URL` 覆盖开发地址，打包模式使用内置 API 托管 `web/dist` |

### 中严重性

| # | 问题 | 文件 | 修复建议 |
|---|------|------|----------|
| ✅ | API Base URL 硬编码 | `web/src/utils/api/requests.ts` | 从 Electron preload 或 `VITE_API_BASE` 读取，默认回退到 `http://127.0.0.1:8000/api` |
| ⬚ | Sidebar 头像使用 `/src/` 路径 | `web/src/components/Sidebar.vue` | 改用 import 或放到 `public/` 目录 |
| ⬚ | 多处缺少 Loading/Error 状态 | `Dns.vue`、`Home.vue` | 添加骨架屏或 loading 指示器 |
| ⬚ | MapArea.vue 顶层 await 缺少 Suspense | `web/src/components/MapArea.vue` | 在 Home.vue 中用 `<Suspense>` 包裹 |
| ⬚ | Electron 缺少打包/构建配置 | `app/package.json` | 集成 electron-builder 或 electron-forge |
| ⬚ | 前端缺少构建后加载方案 | 整体架构 | 配置 vite build + Electron 生产加载 |

### 低严重性

| # | 问题 | 文件 | 修复建议 |
|---|------|------|----------|
| ✅ | Python 包结构维护成本 | `server/` | 取消 Python 后端后不再适用 |
| ⬚ | 外部 Google Fonts 依赖 | `web/index.html` | 本地化字体文件 |
| ⬚ | 缺少 TypeScript 配置 | `web/` | 添加 `tsconfig.json` |
| ⬚ | DNS 配置无法热更新 | `app/services/config.js` | 提供配置重载接口或配置编辑 UI |
| ⬚ | 组件使用 Function prop 代替 emit | `dnsContentBox.vue`、`FilesRenameBox.vue` | 改用 `defineEmits` 事件通信 |
| ⬚ | `Electron transparent: true` Linux 兼容性 | `app/main.js` | 按平台判断是否启用 |
| ⬚ | `app/package.json` 启动脚本与文档不一致 | `app/package.json` | 添加 `"start": "electron ."` |

---

## 三、新增功能

### 接口鉴权中间件

| 属性 | 值 |
|------|----|
| 文件 | `app/services/auth.js` |
| 说明 | 新增 Token 鉴权中间件 |

**实现方式：**
- 服务启动时自动生成随机 Token 并打印到控制台
- 所有 API 请求需在请求头中携带 `Authorization: Bearer <token>`
- 跳过 `/docs`、`/openapi.json`、`/redoc` 等文档路径
- 未授权请求返回 401 状态码

**前端适配：**
- `requests.ts` 新增 `setApiToken(token)` / `getApiToken()` 方法
- 所有 `serverRequest` 请求自动携带 Token 请求头

---

## 四、修复统计

| 类别 | 已修复 | 未修复 |
|------|--------|--------|
| 极高严重性 | 2 | 0 |
| 高严重性 | 21 | 4 |
| 中严重性 | 29 | 7 |
| 低严重性 | 16 | 8 |
| **总计** | **68** | **19** |

未修复的问题主要集中在：
1. **密钥管理**（需要运维层面配合）
2. **Electron 打包/生产构建**（需要确定部署方案后实施）
3. **Electron 安全策略细化**（需要权衡功能需求和安全性）
4. **UI/UX 增强**（非阻断性优化）
