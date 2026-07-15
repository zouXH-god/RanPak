/**
 * Vue Router 路由配置
 */
import { createRouter, createWebHistory } from 'vue-router'

const Home = () => import('../pages/Home.vue')
const Dns = () => import('../pages/Dns.vue')
const JsonEditor = () => import('../pages/JsonEditor.vue')
const BaseStringConvert = () => import('../pages/BaseStringConvert.vue')
const HttpRequestTool = () => import('../pages/HttpRequestTool.vue')
const SshTool = () => import('../pages/SshTool.vue')
const RandomStringTool = () => import('../pages/RandomStringTool.vue')
const SslCertificateTool = () => import('../pages/SslCertificateTool.vue')
const UuidTool = () => import('../pages/UuidTool.vue')
const JwtTool = () => import('../pages/JwtTool.vue')
const UrlCodecTool = () => import('../pages/UrlCodecTool.vue')
const TimestampTool = () => import('../pages/TimestampTool.vue')
const HashHmacTool = () => import('../pages/HashHmacTool.vue')
const RegexTestTool = () => import('../pages/RegexTestTool.vue')
const QrCodeTool = () => import('../pages/QrCodeTool.vue')
const TypingPractice = () => import('../pages/TypingPractice.vue')
const Game2048 = () => import('../pages/Game2048.vue')
const SudokuGame = () => import('../pages/SudokuGame.vue')
const DinoRunner = () => import('../pages/DinoRunner.vue')
const Files = () => import('../pages/Files.vue')
const Standups = () => import('../pages/Standups.vue')
const Calendar = () => import('../pages/Calendar.vue')
const Settings = () => import('../pages/Settings.vue')
const ImageEditor = () => import('../pages/ImageEditor.vue')
const ImageCompress = () => import('../pages/ImageCompress.vue')
const ImageConvert = () => import('../pages/ImageConvert.vue')
const TextToImage = () => import('../pages/TextToImage.vue')
const BadgePrint = () => import('../pages/BadgePrint.vue')
const PerlerBeads = () => import('../pages/PerlerBeads.vue')
const VideoTools = () => import('../pages/VideoTools.vue')
const ClockWindow = () => import('../pages/ClockWindow.vue')
const OverlayClock = () => import('../pages/OverlayClock.vue')
const OverlayLive2D = () => import('../pages/OverlayLive2D.vue')
const OverlayChildWindow = () => import('../pages/OverlayChildWindow.vue')
const ReminderWindow = () => import('../pages/ReminderWindow.vue')
const TimeTools = () => import('../pages/TimeToolsRuntime.vue')
const TimerDisplayWindow = () => import('../pages/TimerDisplayWindow.vue')
const Clicker = () => import('../pages/Clicker.vue')
const TaskFlow = () => import('../pages/TaskFlow.vue')
const TaskFlowOverlay = () => import('../pages/TaskFlowOverlay.vue')
const FinalShellActive = () => import('../pages/FinalShellActive.vue')
const MemeMaker = () => import('../pages/MemeMaker.vue')
const ImageViewerWindow = () => import('../pages/ImageViewerWindow.vue')
const CloudManagement = () => import('../pages/CloudManagement.vue')
const NovelReader = () => import('../pages/NovelReader.vue')

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', name: 'home', component: Home, meta: { title: '首页' } },
    { path: '/pic', redirect: '/home' },
    { path: '/dns', name: 'dns', component: Dns, meta: { title: 'Dns' } },
    { path: '/json-editor', name: 'jsonEditor', component: JsonEditor, meta: { title: 'JSON 编辑器' } },
    { path: '/base-string-convert', name: 'baseStringConvert', component: BaseStringConvert, meta: { title: 'Base 字符串转换' } },
    { path: '/http-request', name: 'httpRequestTool', component: HttpRequestTool, meta: { title: 'HTTP 请求工具' } },
    { path: '/ssh-tool', name: 'sshTool', component: SshTool, meta: { title: 'SSH 工具' } },
    { path: '/random-string', name: 'randomStringTool', component: RandomStringTool, meta: { title: '随机字符串生成' } },
    { path: '/ssl-certificate', name: 'sslCertificateTool', component: SslCertificateTool, meta: { title: 'SSL 证书查询' } },
    { path: '/uuid-tool', name: 'uuidTool', component: UuidTool, meta: { title: 'UUID 生成' } },
    { path: '/jwt-tool', name: 'jwtTool', component: JwtTool, meta: { title: 'JWT 工具' } },
    { path: '/url-codec', name: 'urlCodecTool', component: UrlCodecTool, meta: { title: 'URL 编解码' } },
    { path: '/timestamp-tool', name: 'timestampTool', component: TimestampTool, meta: { title: '时间戳转换' } },
    { path: '/hash-hmac', name: 'hashHmacTool', component: HashHmacTool, meta: { title: '哈希 / HMAC' } },
    { path: '/regex-test', name: 'regexTestTool', component: RegexTestTool, meta: { title: '正则测试' } },
    { path: '/qr-code', name: 'qrCodeTool', component: QrCodeTool, meta: { title: '二维码生成' } },
    { path: '/typing-practice', name: 'typingPractice', component: TypingPractice, meta: { title: '打字练习' } },
    { path: '/game-2048', name: 'game2048', component: Game2048, meta: { title: '2048' } },
    { path: '/sudoku', name: 'sudokuGame', component: SudokuGame, meta: { title: '数独' } },
    { path: '/dino-runner', name: 'dinoRunner', component: DinoRunner, meta: { title: '恐龙跑酷' } },
    { path: '/files', name: 'files', component: Files, meta: { title: 'Files' } },
    { path: '/image-editor', name: 'imageEditor', component: ImageEditor, meta: { title: '图片编辑' } },
    { path: '/image-compress', name: 'imageCompress', component: ImageCompress, meta: { title: '图片压缩' } },
    { path: '/image-convert', name: 'imageConvert', component: ImageConvert, meta: { title: '图片格式转换' } },
    { path: '/text-to-image', name: 'textToImage', component: TextToImage, meta: { title: '文本转图片' } },
    { path: '/badge-print', name: 'badgePrint', component: BadgePrint, meta: { title: '吧唧打印' } },
    { path: '/perler-beads', name: 'perlerBeads', component: PerlerBeads, meta: { title: '拼豆工具' } },
    { path: '/meme-maker', name: 'memeMaker', component: MemeMaker, meta: { title: '表情包制作' } },
    { path: '/video-tools', name: 'videoTools', component: VideoTools, meta: { title: '视频工具' } },
    { path: '/child-window', name: 'childWindowConfig', component: ClockWindow, meta: { title: '子窗口配置' } },
    { path: '/child-window-clock', name: 'childWindowClock', component: ClockWindow, meta: { title: '时钟' } },
    { path: '/child-window-live2d', name: 'childWindowLive2d', component: ClockWindow, meta: { title: '看板娘' } },
    { path: '/child-window-weather', name: 'childWindowWeather', component: ClockWindow, meta: { title: '天气' } },
    { path: '/child-window-alarm', redirect: '/time-tools-alarm' },
    { path: '/time-tools', redirect: '/time-tools-alarm' },
    { path: '/time-tools-alarm', name: 'timeToolsAlarm', component: TimeTools, meta: { title: '闹钟' } },
    { path: '/time-tools-timer', name: 'timeToolsTimer', component: TimeTools, meta: { title: '定时器' } },
    { path: '/time-tools-pomodoro', name: 'timeToolsPomodoro', component: TimeTools, meta: { title: '番茄钟' } },
    { path: '/clock-window', redirect: '/child-window' },
    { path: '/overlay-clock', name: 'overlayClock', component: OverlayClock, meta: { title: '悬浮时钟', overlay: true } },
    { path: '/live2d-window', redirect: '/child-window-live2d' },
    { path: '/overlay-live2d', name: 'overlayLive2d', component: OverlayLive2D, meta: { title: 'Live2D 子窗口', overlay: true } },
    { path: '/overlay-child-window', name: 'overlayChildWindow', component: OverlayChildWindow, meta: { title: '桌面部件', overlay: true } },
    { path: '/preview-child-window', name: 'previewChildWindow', component: OverlayChildWindow, meta: { title: '桌面部件预览', overlay: true } },
    { path: '/reminder-window', name: 'reminderWindow', component: ReminderWindow, meta: { title: '提醒', overlay: true } },
    { path: '/timer-display-window', name: 'timerDisplayWindow', component: TimerDisplayWindow, meta: { title: '定时器展示', overlay: true } },
    { path: '/finalshell-active', name: 'finalshellActive', component: FinalShellActive, meta: { title: 'FinalShell Active' } },
    { path: '/task-flow', name: 'taskFlow', component: TaskFlow, meta: { title: '任务流助手' } },
    { path: '/task-flow-overlay', name: 'taskFlowOverlay', component: TaskFlowOverlay, meta: { title: '任务流', overlay: true } },
    { path: '/image-viewer', name: 'imageViewer', component: ImageViewerWindow, meta: { title: '图片查看', overlay: true } },
    { path: '/clicker', name: 'clicker', component: Clicker, meta: { title: '模拟点击' } },
    { path: '/standups', name: 'standups', component: Standups, meta: { title: 'Standups' } },
    { path: '/calendar', name: 'calendar', component: Calendar, meta: { title: 'My Calendar' } },
    { path: '/settings', name: 'settings', component: Settings, meta: { title: 'Settings' } },
    { path: '/cloud-management', name: 'cloudManagement', component: CloudManagement, meta: { title: '云端管理' } },
    { path: '/novel-reader', name: 'novelReader', component: NovelReader, meta: { title: '小说阅读器' } },
    { path: '/:pathMatch(.*)*', redirect: '/home' },
  ]
})
