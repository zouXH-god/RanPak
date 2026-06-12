export const featureGroups = [
  {
    key: 'system',
    title: '系统工具',
    tone: 'pink',
    icon: 'Tools',
    items: [
      { label: '文件管理', description: '浏览文件、批量重命名和清理目录。', icon: 'FolderOpened', to: '/files', keywords: ['file', '文件'] },
      { label: '模拟点击', description: '录制鼠标轨迹并按规则自动回放。', icon: 'Pointer', to: '/clicker', keywords: ['click', 'auto'] },
    ],
  },
  {
    key: 'dev',
    title: '开发工具',
    tone: 'slate',
    icon: 'Paperclip',
    items: [
      { label: '域名管理', description: '管理 DNS 账号、域名解析和记录状态。', icon: 'Paperclip', to: '/dns', keywords: ['dns', 'domain'] },
      { label: 'JSON 编辑器', description: '编辑、格式化、校验和导入导出 JSON。', icon: 'Document', to: '/json-editor', keywords: ['json'] },
      { label: 'Base 字符串转换', description: '将字符串或文件转换为 Base64、Base32、Base58 等编码。', icon: 'Connection', to: '/base-string-convert', keywords: ['base64', 'base32', 'base58', '编码'] },
      { label: 'HTTP 请求', description: '发送接口请求，支持 curl 导入、Headers、Body 和响应查看。', icon: 'Promotion', to: '/http-request', keywords: ['http', 'request', 'curl', 'api'] },
      { label: 'SSH 工具', description: '管理 SSH 连接、SFTP 文件和本地/远程端口映射。', icon: 'Connection', to: '/ssh-tool', keywords: ['ssh', 'sftp', 'tunnel', 'port', '端口映射'] },
      { label: 'SSL 证书查询', description: '查询 TLS 证书、有效期、签发者和 SAN。', icon: 'Lock', to: '/ssl-certificate', keywords: ['ssl', 'tls', 'certificate', '证书'] },
      { label: '随机字符串', description: '按长度、数量和字符集生成随机字符串。', icon: 'Key', to: '/random-string', keywords: ['random', 'password', '随机'] },
      { label: 'UUID 生成', description: '批量生成 UUID v4。', icon: 'Tickets', to: '/uuid-tool', keywords: ['uuid', 'guid'] },
      { label: 'JWT 工具', description: '解码 JWT，并可校验 HMAC 签名。', icon: 'Postcard', to: '/jwt-tool', keywords: ['jwt', 'token'] },
      { label: 'URL 编解码', description: 'URL 编码、解码、Query 解析和重组。', icon: 'Link', to: '/url-codec', keywords: ['url', 'encode', 'decode'] },
      { label: '时间戳转换', description: '秒/毫秒时间戳、本地时间和 ISO 时间互转。', icon: 'Timer', to: '/timestamp-tool', keywords: ['timestamp', 'time', '时间戳'] },
      { label: '哈希/HMAC', description: '生成 SHA 哈希或 HMAC 签名。', icon: 'Finished', to: '/hash-hmac', keywords: ['hash', 'sha', 'hmac'] },
      { label: '正则测试', description: '测试正则表达式、匹配项、捕获组和索引。', icon: 'Search', to: '/regex-test', keywords: ['regex', 'regexp', '正则'] },
      { label: '二维码生成', description: '生成二维码 PNG，支持颜色、大小和纠错级别。', icon: 'Grid', to: '/qr-code', keywords: ['qr', 'qrcode', '二维码'] },
    ],
  },
  {
    key: 'time',
    title: '时间工具',
    tone: 'green',
    icon: 'Clock',
    items: [
      { label: '闹钟', description: '配置提醒时间、重复规则和提示内容。', icon: 'Bell', to: '/time-tools-alarm', keywords: ['alarm', '提醒'] },
      { label: '定时器', description: '设置倒计时并可打开展示窗口。', icon: 'Timer', to: '/time-tools-timer', keywords: ['timer', '倒计时'] },
      { label: '番茄钟', description: '配置专注和休息时长。', icon: 'CoffeeCup', to: '/time-tools-pomodoro', keywords: ['pomodoro', '番茄'] },
      { label: '任务流助手', description: '创建任务流并逐步执行节点。', icon: 'List', to: '/task-flow', keywords: ['task', 'flow', '任务', '流程', '步骤'] },
    ],
  },
  {
    key: 'game',
    title: '小游戏',
    tone: 'violet',
    icon: 'Grid',
    items: [
      { label: '打字练习', description: '随机散文打字训练，实时统计速度和准确率。', icon: 'EditPen', to: '/typing-practice', keywords: ['打字', 'typing', '练习', '小游戏', '散文'] },
      { label: '2048', description: '滑动数字方块，合成更高分数。', icon: 'Grid', to: '/game-2048', keywords: ['2048', '数字', '合成', '小游戏'] },
      { label: '数独', description: '生成数独题目，支持候选、检查和提示。', icon: 'Finished', to: '/sudoku', keywords: ['sudoku', '数独', '逻辑', '小游戏'] },
      { label: '恐龙跑酷', description: '复刻 Chrome 离线恐龙跑酷体验。', icon: 'Promotion', to: '/dino-runner', keywords: ['dino', 'runner', '恐龙', '跑酷', 'chrome', '小游戏'] },
    ],
  },
  {
    key: 'child',
    title: '子窗口',
    tone: 'green',
    icon: 'Monitor',
    items: [
      { label: '子窗口配置', description: '统一配置桌面部件窗口和显示顺序。', icon: 'Setting', to: '/child-window', keywords: ['widget', '桌面部件'] },
      { label: '时钟', description: '打开并调整桌面时钟部件。', icon: 'Clock', to: '/child-window-clock', keywords: ['clock'] },
      { label: '看板娘', description: '选择 Live2D 看板娘和透明度。', icon: 'MagicStick', to: '/child-window-live2d', keywords: ['live2d'] },
      { label: '天气', description: '配置天气位置、刷新和显示字段。', icon: 'MostlyCloudy', to: '/child-window-weather', keywords: ['weather'] },
    ],
  },
  {
    key: 'image',
    title: '图片工具',
    tone: 'cyan',
    icon: 'Picture',
    items: [
      { label: '图片编辑', description: '裁剪、旋转、调色、文字和水印处理。', icon: 'EditPen', to: '/image-editor', keywords: ['image', 'edit'] },
      { label: '图片压缩', description: '按质量、尺寸和格式批量压缩图片。', icon: 'Picture', to: '/image-compress', keywords: ['compress'] },
      { label: '格式转换', description: '在 PNG、JPEG、WebP 等格式间转换。', icon: 'Switch', to: '/image-convert', keywords: ['convert'] },
      { label: '文本转图片', description: '把文字或代码排版成可导出的图片。', icon: 'Document', to: '/text-to-image', keywords: ['text'] },
      { label: '吧唧打印', description: '生成吧唧排版与打印导出画布。', icon: 'Collection', to: '/badge-print', keywords: ['print'] },
      { label: '拼豆工具', description: '把图片转换为拼豆网格和色号方案。', icon: 'Grid', to: '/perler-beads', keywords: ['perler'] },
    ],
  },
  {
    key: 'video',
    title: '视频工具',
    tone: 'violet',
    icon: 'VideoCamera',
    items: [
      { label: '视频转换', description: '转换 MP4、WebM、MKV 等常见格式。', icon: 'RefreshRight', to: { path: '/video-tools', query: { tool: 'convert' } }, keywords: ['video', 'convert'] },
      { label: '视频压缩', description: '减小视频体积，适合上传和分享。', icon: 'VideoCamera', to: { path: '/video-tools', query: { tool: 'compress' } }, keywords: ['compress'] },
      { label: '时长裁剪', description: '输入开始和结束时间截取片段。', icon: 'Clock', to: { path: '/video-tools', query: { tool: 'trim' } }, keywords: ['trim'] },
      { label: '提取音频', description: '从视频中导出 MP3、AAC 或 Opus。', icon: 'Headset', to: { path: '/video-tools', query: { tool: 'extract-audio' } }, keywords: ['audio'] },
      { label: '视频截图', description: '按指定时间点导出清晰画面。', icon: 'Camera', to: { path: '/video-tools', query: { tool: 'snapshot' } }, keywords: ['snapshot'] },
      { label: '合并视频', description: '按选择顺序合并多个视频文件。', icon: 'Files', to: { path: '/video-tools', query: { tool: 'concat' } }, keywords: ['concat'] },
      { label: '添加水印', description: '为视频添加文字水印并调整位置。', icon: 'MagicStick', to: { path: '/video-tools', query: { tool: 'watermark' } }, keywords: ['watermark'] },
      { label: '视频信息', description: '读取编码、分辨率、音轨和字幕。', icon: 'DataAnalysis', to: { path: '/video-tools', query: { tool: 'probe' } }, keywords: ['probe', 'info'] },
      { label: '字幕处理', description: '烧录字幕或保留字幕轨道。', icon: 'Microphone', to: { path: '/video-tools', query: { tool: 'subtitle' } }, keywords: ['subtitle'] },
      { label: '旋转缩放', description: '调整尺寸、帧率和旋转角度。', icon: 'Crop', to: { path: '/video-tools', query: { tool: 'resize-rotate' } }, keywords: ['resize', 'rotate'] },
      { label: '去除音频', description: '快速导出无声音视频文件。', icon: 'Mute', to: { path: '/video-tools', query: { tool: 'remove-audio' } }, keywords: ['mute'] },
      { label: 'GIF/倍速/批量', description: '制作 GIF、调速或批量处理。', icon: 'Picture', to: { path: '/video-tools', query: { tool: 'gif-speed-batch' } }, keywords: ['gif', 'speed', 'batch'] },
    ],
  },
  {
    key: 'other',
    title: '其他',
    tone: 'pink',
    icon: 'Tools',
    items: [
      { label: 'Standups', description: '查看和整理站会记录。', icon: 'Tools', to: '/standups', keywords: ['standup'] },
      { label: 'My Calendar', description: '打开日历视图和日程安排。', icon: 'Calendar', to: '/calendar', keywords: ['calendar'] },
      { label: 'Settings', description: '调整应用通用设置。', icon: 'Setting', to: '/settings', keywords: ['settings'] },
    ],
  },
]

export function routePath(to) {
  return typeof to === 'string' ? to : to?.path || ''
}

export function matchesFeatureQuery(item, query) {
  const text = String(query || '').trim().toLowerCase()
  if (!text) return true
  return [
    item.label,
    item.description,
    routePath(item.to),
    ...(item.keywords || []),
  ].join(' ').toLowerCase().includes(text)
}

export function filterFeatureGroups(query) {
  return featureGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => matchesFeatureQuery(item, query)),
    }))
    .filter((group) => group.items.length > 0)
}

export function isFeatureActive(to, route) {
  const path = routePath(to)
  if (route.path !== path) return false
  const query = typeof to === 'object' ? to?.query : null
  if (!query) return true
  return Object.entries(query).every(([key, value]) => String(route.query[key] || '') === String(value))
}

export function isGroupActive(group, route) {
  return group.items.some((item) => isFeatureActive(item.to, route))
}
