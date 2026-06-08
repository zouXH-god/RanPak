const { app, BrowserWindow, nativeImage, dialog, ipcMain, shell, screen, globalShortcut } = require('electron');
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const { ClickerRuntime } = require('./services/clicker');

let win;
let apiRuntime;
let clockWin;
let live2dWin;
let childWin;
let reminderWin;
let timerDisplayWin;
let reminderPayload = null;
let timerDisplayPayload = null;
let clickerRuntime;
let appQuitting = false;
let childShortcutSignature = '';
const registeredChildShortcuts = new Set();
const weatherCache = new Map();
const WEATHER_CACHE_TTL = 15 * 60 * 1000;
const APP_ICON_PATH = path.join(__dirname, 'assets', 'icons', 'icon.png');

if (process.platform === 'win32') {
    app.setAppUserModelId('com.ranpak.app');
}

function getAppIcon() {
    return nativeImage.createFromPath(APP_ICON_PATH);
}

const DEFAULT_CLOCK_CONFIG = {
    visible: false,
    locked: false,
    bounds: { width: 360, height: 140 },
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backgroundColorInput: 'rgba(0, 0, 0, 0)',
    backgroundOpacity: 0,
    fontColor: '#111827',
    fontFamily: 'system',
    fontWeight: 700,
    fontStyle: 'normal',
    fontSize: 48,
    letterSpacing: 0,
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    rotate: 0,
    textShadowEnabled: true,
    textShadowColor: 'rgba(15, 23, 42, 0.16)',
    textShadowX: 0,
    textShadowY: 10,
    textShadowBlur: 28,
    format: '24',
    showDate: false,
    showLunarDate: false,
};

const DEFAULT_LIVE2D_CONFIG = {
    visible: false,
    locked: false,
    bounds: { width: 360, height: 520 },
    widgetUrl: "/vendor/live2d-widget/local-autoload.js",
    backgroundColor: "rgba(0, 0, 0, 0)",
    opacity: 100,
    modelId: 0,
    textureId: 0,
};

const DEFAULT_CHILD_COMMON_CONFIG = {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backgroundColorInput: 'rgba(0, 0, 0, 0)',
    backgroundOpacity: 0,
    fontColor: '#111827',
    fontFamily: 'system',
    fontWeight: 700,
    fontStyle: 'normal',
    fontSize: 48,
};

const DEFAULT_CHILD_SHORTCUTS = {
    toggleLocked: '',
    switchLive2d: '',
};

const DEFAULT_WEATHER_CONFIG = {
    locationName: '北京',
    latitude: 39.9042,
    longitude: 116.4074,
    nmcStationId: 'Wqsps',
    refreshMinutes: 15,
    position: 'top-left',
    showApparent: true,
    showHumidity: true,
    showWind: true,
    showDailyRange: true,
    style: {
        fontColor: '',
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
        backgroundOpacity: 72,
        shadowEnabled: true,
        shadowColor: 'rgba(15, 23, 42, 0.12)',
        shadowX: 0,
        shadowY: 16,
        shadowBlur: 42,
    },
};

const DEFAULT_ALARM_CONFIG = {
    enabled: false,
    time: '08:00',
    message: '闹钟时间到',
    items: [{ time: '08:00', note: '闹钟时间到', repeat: 'daily', date: '', weekdays: [1, 2, 3, 4, 5], dayOfMonth: 1, soundPath: '' }],
    soundEnabled: true,
    soundPath: '',
};

const DEFAULT_STOPWATCH_CONFIG = {
    enabled: false,
    autoStart: false,
    durationSeconds: 300,
    message: '秒表时间到',
    soundEnabled: true,
    soundPath: '',
    showWindow: false,
};

const DEFAULT_POMODORO_CONFIG = {
    workSeconds: 25 * 60,
    breakSeconds: 5 * 60,
    message: '番茄钟阶段完成',
    soundEnabled: true,
    soundPath: '',
    showWindow: false,
};

const DEFAULT_TIME_TOOLS_CONFIG = {
    alarm: { ...DEFAULT_ALARM_CONFIG },
    timer: { ...DEFAULT_STOPWATCH_CONFIG },
    pomodoro: { ...DEFAULT_POMODORO_CONFIG },
};

const DEFAULT_CHILD_COMPONENTS = [
    { type: 'clock', height: 112 },
    { type: 'live2d', height: 360 },
];

const DEFAULT_CHILD_CONFIG = {
    visible: false,
    locked: false,
    showClock: true,
    showLive2d: true,
    showWeather: false,
    showAlarm: false,
    showStopwatch: false,
    components: DEFAULT_CHILD_COMPONENTS.map((component) => ({ ...component })),
    bounds: { width: 420, height: 560 },
    common: { ...DEFAULT_CHILD_COMMON_CONFIG },
    clock: { ...DEFAULT_CLOCK_CONFIG },
    live2d: { ...DEFAULT_LIVE2D_CONFIG },
    weather: { ...DEFAULT_WEATHER_CONFIG },
    alarm: { ...DEFAULT_ALARM_CONFIG },
    stopwatch: { ...DEFAULT_STOPWATCH_CONFIG },
    shortcuts: { ...DEFAULT_CHILD_SHORTCUTS },
};

function audioMimeType(filePath) {
    const ext = path.extname(String(filePath || '')).toLowerCase();
    if (ext === '.mp3') return 'audio/mpeg';
    if (ext === '.wav') return 'audio/wav';
    if (ext === '.ogg') return 'audio/ogg';
    if (ext === '.m4a') return 'audio/mp4';
    if (ext === '.aac') return 'audio/aac';
    if (ext === '.flac') return 'audio/flac';
    return 'application/octet-stream';
}

function clockConfigPath() {
    return path.join(app.getPath('userData'), 'config', 'clock-window.json');
}

function live2dConfigPath() {
    return path.join(app.getPath('userData'), 'config', 'live2d-window.json');
}

function childWindowConfigPath() {
    return path.join(app.getPath('userData'), 'config', 'child-window.json');
}

function timeToolsConfigPath() {
    return path.join(app.getPath('userData'), 'config', 'time-tools.json');
}

function devToolsStorePath() {
    return path.join(app.getPath('userData'), 'config', 'dev-tools.json');
}

function normalizeChildComponents(config = {}) {
    const labels = {
        clock: { min: 64, max: 260, fallback: 112 },
        live2d: { min: 160, max: 900, fallback: 360 },
        weather: { min: 96, max: 360, fallback: 150 },
    };
    const source = Array.isArray(config.components)
        ? config.components
        : [
            ...(config.showClock !== false ? [{ type: 'clock', height: 112 }] : []),
            ...(config.showLive2d !== false ? [{ type: 'live2d', height: 360 }] : []),
            ...(config.showWeather ? [{ type: 'weather', height: 150 }] : []),
        ];
    const seen = new Set();
    return source
        .map((component) => {
            const type = typeof component === 'string' ? component : component?.type;
            if (!labels[type] || seen.has(type)) return null;
            seen.add(type);
            const rule = labels[type];
            const height = Math.min(Math.max(Number(component?.height || rule.fallback), rule.min), rule.max);
            return { type, height };
        })
        .filter(Boolean);
}

function readTimeToolsConfig() {
    try {
        const raw = fs.readFileSync(timeToolsConfigPath(), 'utf-8');
        const parsed = JSON.parse(raw) || {};
        return {
            ...DEFAULT_TIME_TOOLS_CONFIG,
            ...parsed,
            alarm: { ...DEFAULT_ALARM_CONFIG, ...(parsed.alarm || {}) },
            timer: { ...DEFAULT_STOPWATCH_CONFIG, ...(parsed.timer || parsed.stopwatch || {}) },
            pomodoro: { ...DEFAULT_POMODORO_CONFIG, ...(parsed.pomodoro || {}) },
        };
    } catch {
        const childConfig = readChildWindowConfig();
        return {
            ...DEFAULT_TIME_TOOLS_CONFIG,
            alarm: { ...DEFAULT_ALARM_CONFIG, ...(childConfig.alarm || {}) },
            timer: { ...DEFAULT_STOPWATCH_CONFIG, ...(childConfig.stopwatch || {}) },
            pomodoro: { ...DEFAULT_POMODORO_CONFIG },
        };
    }
}

function writeTimeToolsConfig(nextConfig = {}) {
    const current = readTimeToolsConfig();
    const merged = {
        ...current,
        ...nextConfig,
        alarm: { ...(current.alarm || {}), ...(nextConfig.alarm || {}) },
        timer: { ...(current.timer || {}), ...(nextConfig.timer || {}) },
        pomodoro: { ...(current.pomodoro || {}), ...(nextConfig.pomodoro || {}) },
    };
    fs.mkdirSync(path.dirname(timeToolsConfigPath()), { recursive: true });
    fs.writeFileSync(timeToolsConfigPath(), JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
}

function readDevToolStore() {
    try {
        const raw = fs.readFileSync(devToolsStorePath(), 'utf-8');
        return JSON.parse(raw) || {};
    } catch {
        return {};
    }
}

function writeDevToolStore(nextStore = {}) {
    fs.mkdirSync(path.dirname(devToolsStorePath()), { recursive: true });
    fs.writeFileSync(devToolsStorePath(), JSON.stringify(nextStore || {}, null, 2), 'utf-8');
    return nextStore || {};
}

function normalizeHeaderRows(headers = []) {
    if (!Array.isArray(headers)) return {};
    return headers.reduce((acc, item) => {
        const key = String(item?.key || '').trim();
        if (!key) return acc;
        acc[key] = String(item?.value ?? '');
        return acc;
    }, {});
}

function normalizeQueryRows(query = []) {
    if (!Array.isArray(query)) return [];
    return query
        .map((item) => ({
            key: String(item?.key || '').trim(),
            value: String(item?.value ?? ''),
        }))
        .filter((item) => item.key);
}

function buildHttpRequestBody(payload = {}, headers = {}) {
    const bodyType = String(payload.bodyType || 'none');
    if (bodyType === 'none') return undefined;
    if (bodyType === 'json') {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        const raw = String(payload.body || '').trim();
        return raw || '';
    }
    if (bodyType === 'form') {
        headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded';
        const params = new URLSearchParams();
        normalizeQueryRows(payload.formRows).forEach((item) => params.append(item.key, item.value));
        return params.toString();
    }
    headers['Content-Type'] = headers['Content-Type'] || 'text/plain;charset=utf-8';
    return String(payload.body || '');
}

async function performDevHttpRequest(payload = {}) {
    const startedAt = Date.now();
    try {
        const method = String(payload.method || 'GET').toUpperCase();
        const requestUrl = new URL(String(payload.url || '').trim());
        normalizeQueryRows(payload.queryRows).forEach((item) => requestUrl.searchParams.append(item.key, item.value));
        const headers = normalizeHeaderRows(payload.headers);
        const body = ['GET', 'HEAD'].includes(method) ? undefined : buildHttpRequestBody(payload, headers);
        const controller = new AbortController();
        const timeoutMs = Math.min(Math.max(Number(payload.timeoutMs || 30000), 1000), 120000);
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(requestUrl.toString(), {
                method,
                headers,
                body,
                redirect: String(payload.redirect || 'follow'),
                signal: controller.signal,
            });
            const responseHeaders = Array.from(response.headers.entries()).map(([key, value]) => ({ key, value }));
            const text = await response.text();
            return {
                ok: true,
                data: {
                    url: requestUrl.toString(),
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    durationMs: Date.now() - startedAt,
                    headers: responseHeaders,
                    body: text,
                },
            };
        } finally {
            clearTimeout(timeout);
        }
    } catch (error) {
        return {
            ok: false,
            error: error?.name === 'AbortError' ? '请求超时' : (error?.message || '请求失败'),
            durationMs: Date.now() - startedAt,
        };
    }
}

function objectPairs(value = {}) {
    return Object.entries(value || {}).map(([key, item]) => ({ key, value: String(item) }));
}

function normalizeCertificate(cert = {}) {
    return {
        subject: objectPairs(cert.subject),
        issuer: objectPairs(cert.issuer),
        subjectaltname: cert.subjectaltname || '',
        validFrom: cert.valid_from || '',
        validTo: cert.valid_to || '',
        serialNumber: cert.serialNumber || '',
        fingerprint: cert.fingerprint || '',
        fingerprint256: cert.fingerprint256 || '',
        daysRemaining: cert.valid_to ? Math.ceil((new Date(cert.valid_to).getTime() - Date.now()) / 86400000) : null,
    };
}

async function querySslCertificate(payload = {}) {
    const host = String(payload.host || '').trim().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    const port = Math.min(Math.max(Number(payload.port || 443), 1), 65535);
    if (!host) return { ok: false, error: '请输入域名' };
    return new Promise((resolve) => {
        const socket = tls.connect({
            host,
            port,
            servername: host,
            rejectUnauthorized: false,
            timeout: Math.min(Math.max(Number(payload.timeoutMs || 10000), 1000), 60000),
        });
        socket.once('secureConnect', () => {
            const cert = socket.getPeerCertificate(true);
            const cipher = socket.getCipher();
            resolve({
                ok: true,
                data: {
                    host,
                    port,
                    authorized: socket.authorized,
                    authorizationError: socket.authorizationError || '',
                    protocol: socket.getProtocol() || '',
                    cipher: cipher ? `${cipher.name} / ${cipher.version}` : '',
                    certificate: normalizeCertificate(cert),
                },
            });
            socket.end();
        });
        socket.once('timeout', () => {
            socket.destroy();
            resolve({ ok: false, error: '连接超时' });
        });
        socket.once('error', (error) => {
            resolve({ ok: false, error: error?.message || 'SSL 查询失败' });
        });
    });
}

function readClockConfig() {
    try {
        const raw = fs.readFileSync(clockConfigPath(), 'utf-8');
        return { ...DEFAULT_CLOCK_CONFIG, ...(JSON.parse(raw) || {}) };
    } catch {
        return { ...DEFAULT_CLOCK_CONFIG };
    }
}

function writeClockConfig(nextConfig = {}) {
    const current = readClockConfig();
    const merged = {
        ...current,
        ...nextConfig,
        bounds: { ...(current.bounds || {}), ...(nextConfig.bounds || {}) },
    };
    fs.mkdirSync(path.dirname(clockConfigPath()), { recursive: true });
    fs.writeFileSync(clockConfigPath(), JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
}

function readLive2dConfig() {
    try {
        const raw = fs.readFileSync(live2dConfigPath(), 'utf-8');
        const config = { ...DEFAULT_LIVE2D_CONFIG, ...(JSON.parse(raw) || {}) };
        if (String(config.widgetUrl || "").includes("live2d-widgets@1.0.1")) {
            config.widgetUrl = DEFAULT_LIVE2D_CONFIG.widgetUrl;
        }
        return config;
    } catch {
        return { ...DEFAULT_LIVE2D_CONFIG };
    }
}

function writeLive2dConfig(nextConfig = {}) {
    const current = readLive2dConfig();
    const merged = {
        ...current,
        ...nextConfig,
        bounds: { ...(current.bounds || {}), ...(nextConfig.bounds || {}) },
    };
    fs.mkdirSync(path.dirname(live2dConfigPath()), { recursive: true });
    fs.writeFileSync(live2dConfigPath(), JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
}

function clockOptionsFromConfig(config = readClockConfig()) {
    const { visible, bounds, ...options } = config;
    return options;
}

function live2dOptionsFromConfig(config = readLive2dConfig()) {
    const { visible, bounds, ...options } = config;
    return options;
}

function readChildWindowConfig() {
    try {
        const raw = fs.readFileSync(childWindowConfigPath(), 'utf-8');
        const parsed = JSON.parse(raw) || {};
        const oldClock = parsed.clock || {};
        const common = {
            ...DEFAULT_CHILD_COMMON_CONFIG,
            backgroundColor: oldClock.backgroundColor || DEFAULT_CHILD_COMMON_CONFIG.backgroundColor,
            backgroundColorInput: oldClock.backgroundColorInput || oldClock.backgroundColor || DEFAULT_CHILD_COMMON_CONFIG.backgroundColorInput,
            backgroundOpacity: oldClock.backgroundOpacity ?? DEFAULT_CHILD_COMMON_CONFIG.backgroundOpacity,
            fontColor: oldClock.fontColor || DEFAULT_CHILD_COMMON_CONFIG.fontColor,
            fontFamily: oldClock.fontFamily || DEFAULT_CHILD_COMMON_CONFIG.fontFamily,
            fontWeight: oldClock.fontWeight ?? DEFAULT_CHILD_COMMON_CONFIG.fontWeight,
            fontStyle: oldClock.fontStyle || DEFAULT_CHILD_COMMON_CONFIG.fontStyle,
            fontSize: oldClock.fontSize ?? DEFAULT_CHILD_COMMON_CONFIG.fontSize,
            ...(parsed.common || {}),
        };
        const live2d = { ...DEFAULT_LIVE2D_CONFIG, ...(parsed.live2d || {}) };
        if (String(live2d.widgetUrl || "").includes("live2d-widgets@1.0.1")) {
            live2d.widgetUrl = DEFAULT_LIVE2D_CONFIG.widgetUrl;
        }
        return {
            ...DEFAULT_CHILD_CONFIG,
            ...parsed,
            bounds: { ...DEFAULT_CHILD_CONFIG.bounds, ...(parsed.bounds || {}) },
            components: normalizeChildComponents(parsed),
            common,
            clock: { ...DEFAULT_CLOCK_CONFIG, ...(parsed.clock || {}) },
            live2d,
            weather: { ...DEFAULT_WEATHER_CONFIG, ...(parsed.weather || {}) },
            alarm: { ...DEFAULT_ALARM_CONFIG, ...(parsed.alarm || {}) },
            stopwatch: { ...DEFAULT_STOPWATCH_CONFIG, ...(parsed.stopwatch || {}) },
            shortcuts: { ...DEFAULT_CHILD_SHORTCUTS, ...(parsed.shortcuts || {}) },
        };
    } catch {
        const clockConfig = readClockConfig();
        return {
            ...DEFAULT_CHILD_CONFIG,
            common: {
                ...DEFAULT_CHILD_COMMON_CONFIG,
                backgroundColor: clockConfig.backgroundColor,
                backgroundColorInput: clockConfig.backgroundColorInput || clockConfig.backgroundColor,
                backgroundOpacity: clockConfig.backgroundOpacity,
                fontColor: clockConfig.fontColor,
                fontFamily: clockConfig.fontFamily,
                fontWeight: clockConfig.fontWeight,
                fontStyle: clockConfig.fontStyle,
                fontSize: clockConfig.fontSize,
            },
            components: normalizeChildComponents(DEFAULT_CHILD_CONFIG),
            clock: { ...DEFAULT_CLOCK_CONFIG, ...clockConfig },
            live2d: { ...DEFAULT_LIVE2D_CONFIG, ...readLive2dConfig() },
            weather: { ...DEFAULT_WEATHER_CONFIG },
            alarm: { ...DEFAULT_ALARM_CONFIG },
            stopwatch: { ...DEFAULT_STOPWATCH_CONFIG },
            shortcuts: { ...DEFAULT_CHILD_SHORTCUTS },
        };
    }
}

function writeChildWindowConfig(nextConfig = {}) {
    const current = readChildWindowConfig();
    const clock = { ...(current.clock || {}), ...(nextConfig.clock || {}) };
    [
        'backgroundColor',
        'backgroundColorInput',
        'backgroundOpacity',
        'fontColor',
        'fontFamily',
        'fontWeight',
        'fontStyle',
        'fontSize',
    ].forEach((key) => delete clock[key]);
    const merged = {
        ...current,
        ...nextConfig,
        bounds: { ...(current.bounds || {}), ...(nextConfig.bounds || {}) },
        components: normalizeChildComponents({ ...current, ...nextConfig }),
        common: { ...(current.common || {}), ...(nextConfig.common || {}) },
        clock,
        live2d: { ...(current.live2d || {}), ...(nextConfig.live2d || {}) },
        weather: { ...(current.weather || {}), ...(nextConfig.weather || {}) },
        alarm: { ...(current.alarm || {}), ...(nextConfig.alarm || {}) },
        stopwatch: { ...(current.stopwatch || {}), ...(nextConfig.stopwatch || {}) },
        shortcuts: { ...(current.shortcuts || {}), ...(nextConfig.shortcuts || {}) },
    };
    fs.mkdirSync(path.dirname(childWindowConfigPath()), { recursive: true });
    fs.writeFileSync(childWindowConfigPath(), JSON.stringify(merged, null, 2), 'utf-8');
    registerChildShortcuts(merged);
    return merged;
}

function childWindowOptionsFromConfig(config = readChildWindowConfig()) {
    const { visible, bounds, ...options } = config;
    return options;
}

function normalizeShortcut(value) {
    return String(value || '').trim();
}

function shortcutSignature(shortcuts = {}) {
    return JSON.stringify({
        toggleLocked: normalizeShortcut(shortcuts.toggleLocked),
        switchLive2d: normalizeShortcut(shortcuts.switchLive2d),
    });
}

function unregisterChildShortcuts() {
    registeredChildShortcuts.forEach((accelerator) => {
        try {
            globalShortcut.unregister(accelerator);
        } catch (error) {
            console.warn('取消注册快捷键失败:', accelerator, error);
        }
    });
    registeredChildShortcuts.clear();
}

function registerChildShortcut(accelerator, handler) {
    const shortcut = normalizeShortcut(accelerator);
    if (!shortcut || registeredChildShortcuts.has(shortcut)) return;
    try {
        if (globalShortcut.register(shortcut, handler)) {
            registeredChildShortcuts.add(shortcut);
        } else {
            console.warn('快捷键注册失败，可能已被占用:', shortcut);
        }
    } catch (error) {
        console.warn('快捷键格式无效:', shortcut, error);
    }
}

function registerChildShortcuts(config = readChildWindowConfig()) {
    if (!app.isReady()) return;
    const signature = shortcutSignature(config.shortcuts);
    if (signature === childShortcutSignature) return;
    childShortcutSignature = signature;
    unregisterChildShortcuts();
    registerChildShortcut(config.shortcuts?.toggleLocked, toggleChildWindowLockedByShortcut);
    registerChildShortcut(config.shortcuts?.switchLive2d, switchLive2dByShortcut);
}

function sendChildWindowOptions(config = readChildWindowConfig()) {
    if (childWin && !childWin.isDestroyed()) {
        childWin.webContents.send('child-window:options', childWindowOptionsFromConfig(config));
    }
}

function toggleChildWindowLockedByShortcut() {
    const current = readChildWindowConfig();
    const bounds = childWin && !childWin.isDestroyed() ? childWin.getBounds() : undefined;
    const config = writeChildWindowConfig({
        locked: !current.locked,
        ...(bounds ? { bounds } : {}),
    });
    sendChildWindowOptions(config);
    applyChildWindowMousePolicy(config);
}

function getLive2dModelCatalogSize() {
    try {
        const { readLive2dCatalog } = require('./services/tools-config');
        const models = readLive2dCatalog();
        if (Array.isArray(models) && models.length > 0) return models.length;
    } catch {
        // Live2D is optional until the user configures an external asset package.
    }
    return 1;
}

function switchLive2dByShortcut() {
    const current = readChildWindowConfig();
    const modelCount = getLive2dModelCatalogSize();
    if (modelCount <= 1) return;
    const currentModelId = Number.parseInt(current.live2d?.modelId, 10);
    const nextModelId = (Number.isFinite(currentModelId) ? currentModelId + 1 : 1) % modelCount;
    const config = writeChildWindowConfig({
        live2d: {
            ...(current.live2d || {}),
            modelId: nextModelId,
            textureId: 0,
        },
    });
    sendChildWindowOptions(config);
}

function assertFiniteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCachedWeather(key) {
    const cached = weatherCache.get(key);
    if (!cached || Date.now() - cached.time > WEATHER_CACHE_TTL) {
        weatherCache.delete(key);
        return null;
    }
    return cached.data;
}

function setCachedWeather(key, data) {
    weatherCache.set(key, { time: Date.now(), data });
    return data;
}

async function fetchJson(url, retries = 1) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        } catch (error) {
            lastError = error;
            if (attempt < retries) await sleep(600);
        }
    }
    throw lastError;
}

async function fetchNmcJson(url, retries = 1) {
    const requestUrl = url instanceof URL ? url.toString() : String(url);
    const response = await fetch(requestUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            Referer: 'https://www.nmc.cn/',
            Accept: 'application/json,text/plain,*/*',
        },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    try {
        return await response.json();
    } catch (error) {
        if (retries > 0) {
            await sleep(600);
            return fetchNmcJson(requestUrl, retries - 1);
        }
        throw error;
    }
}

async function safeWeatherCall(action) {
    try {
        return { ok: true, data: await action() };
    } catch (error) {
        return { ok: false, error: error?.message || '天气服务暂不可用' };
    }
}

async function fetchWeatherForecast(params = {}) {
    const latitude = assertFiniteNumber(params.latitude, 31.2304);
    const longitude = assertFiniteNumber(params.longitude, 121.4737);
    const nmcStationId = String(params.nmcStationId || DEFAULT_WEATHER_CONFIG.nmcStationId).trim() || DEFAULT_WEATHER_CONFIG.nmcStationId;
    const cacheKey = `forecast:${latitude}:${longitude}:${nmcStationId}`;
    const cached = getCachedWeather(cacheKey);
    if (cached) return { ...cached, cached: true };
    let nmcError = null;
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m');
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min');
    url.searchParams.set('forecast_days', '1');
    url.searchParams.set('timezone', 'auto');
    try {
        return setCachedWeather(cacheKey, normalizeNmcWeather(await fetchNmcJson(`https://www.nmc.cn/rest/weather?stationid=${encodeURIComponent(nmcStationId)}`)));
    } catch (error) {
        nmcError = error;
    }

    try {
        return setCachedWeather(cacheKey, normalizeOpenMeteoWeather(await fetchJson(url)));
    } catch (error) {
        const message = `NMC ${nmcError?.message || 'failed'}; Open-Meteo ${error?.message || 'failed'}`;
        throw new Error(message);
    }
}

function normalizeOpenMeteoWeather(data = {}) {
    const current = data.current || {};
    const daily = data.daily || {};
    const temperature = Number(current.temperature_2m ?? 0);
    return {
        source: 'open-meteo',
        locationName: '',
        current: {
            temperature_2m: temperature,
            apparent_temperature: Number(current.apparent_temperature ?? temperature),
            relative_humidity_2m: Number(current.relative_humidity_2m ?? 0),
            wind_speed_10m: Number(current.wind_speed_10m ?? 0),
            weather_code: Number(current.weather_code ?? 0),
            time: current.time || '',
        },
        daily: {
            temperature_2m_max: [Number(daily.temperature_2m_max?.[0] ?? temperature)],
            temperature_2m_min: [Number(daily.temperature_2m_min?.[0] ?? temperature)],
        },
    };
}

function normalizeNmcWeather(payload = {}) {
    const data = payload.data || {};
    const real = data.real || {};
    const weather = real.weather || {};
    const wind = real.wind || {};
    const station = real.station || data.predict?.station || {};
    const today = data.predict?.detail?.[0] || {};
    const dayTemp = Number(today.day?.weather?.temperature);
    const nightTemp = Number(today.night?.weather?.temperature);
    const temperature = Number(weather.temperature ?? 0);
    const max = Number.isFinite(dayTemp) ? dayTemp : temperature;
    const min = Number.isFinite(nightTemp) ? nightTemp : temperature;
    return {
        source: 'nmc',
        locationName: [station.province, station.city].filter(Boolean).join(' · '),
        current: {
            temperature_2m: temperature,
            apparent_temperature: Number(weather.feelst ?? temperature),
            relative_humidity_2m: Number(weather.humidity ?? 0),
            wind_speed_10m: Number(wind.speed ?? 0),
            weather_code: null,
            weather_text: weather.info || today.day?.weather?.info || today.night?.weather?.info || '实况',
            weather_icon: String(weather.img || today.day?.weather?.img || today.night?.weather?.img || ''),
            wind_direction: wind.direct || '',
            wind_level: wind.power || '',
            air_quality: data.air?.text || '',
            aqi: data.air?.aqi ?? null,
            publish_time: real.publish_time || '',
        },
        daily: {
            temperature_2m_max: [max],
            temperature_2m_min: [min],
        },
        raw: {
            sunrise: real.sunriseSunset?.sunrise || '',
            sunset: real.sunriseSunset?.sunset || '',
        },
    };
}

async function geocodeWeatherLocation(params = {}) {
    const name = String(params.name || '').trim();
    if (!name) return { results: [] };
    try {
        const nmcResults = await searchNmcStations(name, Number(params.count || 5));
        if (nmcResults.length) return { results: nmcResults };
    } catch {
        // Fall back to Open-Meteo geocoding when NMC station lookup is unavailable.
    }
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', name);
    url.searchParams.set('count', String(Math.min(Math.max(Number(params.count || 1), 1), 10)));
    url.searchParams.set('language', params.language || 'zh');
    url.searchParams.set('format', 'json');
    return fetchJson(url);
}

async function getNmcProvinces() {
    const cached = getCachedWeather('nmc:provinces');
    if (cached) return cached;
    return setCachedWeather('nmc:provinces', await fetchNmcJson('https://www.nmc.cn/rest/province/all'));
}

async function getNmcStationsByProvince(code) {
    const key = `nmc:province:${code}`;
    const cached = getCachedWeather(key);
    if (cached) return cached;
    return setCachedWeather(key, await fetchNmcJson(`https://www.nmc.cn/rest/province/${encodeURIComponent(code)}`));
}

async function searchNmcStations(keyword, count = 5) {
    const provinces = await getNmcProvinces();
    const normalized = keyword.toLowerCase();
    const matchedProvinces = provinces.filter((province) => String(province.name || '').includes(keyword) || String(province.code || '').toLowerCase() === normalized);
    const scanProvinces = matchedProvinces.length ? matchedProvinces : provinces;
    const results = [];
    for (const province of scanProvinces) {
        const stations = await getNmcStationsByProvince(province.code);
        for (const station of stations) {
            const city = String(station.city || '');
            const provinceName = String(station.province || province.name || '');
            if (!city.includes(keyword) && !provinceName.includes(keyword) && String(station.code || '').toLowerCase() !== normalized) continue;
            results.push({
                name: city,
                admin1: provinceName,
                country: '中国',
                latitude: 39.9042,
                longitude: 116.4074,
                nmcStationId: station.code,
            });
            if (results.length >= count) return results;
        }
    }
    return results;
}

function isTransparentClockConfig(config = readClockConfig()) {
    if (Number(config.backgroundOpacity || 0) <= 0) return true;
    const color = String(config.backgroundColor || "").replace(/\s/g, "").toLowerCase();
    return color === "transparent" || color === "rgba(0,0,0,0)" || color.endsWith(",0)");
}

function applyClockMousePolicy(config = readClockConfig()) {
    if (!clockWin || clockWin.isDestroyed()) return;
    const shouldPassThrough = Boolean(config.locked && isTransparentClockConfig(config));
    clockWin.setIgnoreMouseEvents(shouldPassThrough, { forward: true });
}

function applyLive2dMousePolicy(config = readLive2dConfig()) {
    if (!live2dWin || live2dWin.isDestroyed()) return;
    live2dWin.setIgnoreMouseEvents(Boolean(config.locked), { forward: true });
}

function applyChildWindowMousePolicy(config = readChildWindowConfig()) {
    if (!childWin || childWin.isDestroyed()) return;
    childWin.setIgnoreMouseEvents(Boolean(config.locked), { forward: true });
}

function ensureBoundsInDisplay(bounds = {}) {
    const width = Math.max(240, Math.round(Number(bounds.width || 360)));
    const height = Math.max(96, Math.round(Number(bounds.height || 140)));
    const point = {
        x: Number.isFinite(bounds.x) ? Math.round(bounds.x) : 0,
        y: Number.isFinite(bounds.y) ? Math.round(bounds.y) : 0,
    };
    const display = screen.getDisplayNearestPoint(point) || screen.getPrimaryDisplay();
    const area = display.workArea || display.bounds;
    const safeWidth = Math.min(width, area.width);
    const safeHeight = Math.min(height, area.height);
    const minVisible = 48;
    const minX = area.x;
    const minY = area.y;
    const maxX = area.x + area.width - Math.min(minVisible, safeWidth);
    const maxY = area.y + area.height - Math.min(minVisible, safeHeight);
    const fullyVisibleMaxX = area.x + area.width - safeWidth;
    const fullyVisibleMaxY = area.y + area.height - safeHeight;
    let x = Number.isFinite(bounds.x) ? Math.round(bounds.x) : area.x + Math.round((area.width - safeWidth) / 2);
    let y = Number.isFinite(bounds.y) ? Math.round(bounds.y) : area.y + Math.round((area.height - safeHeight) / 2);
    if (x < minX || x > maxX) x = Math.max(area.x, fullyVisibleMaxX);
    if (y < minY || y > maxY) y = Math.max(area.y, fullyVisibleMaxY);
    x = Math.min(Math.max(x, area.x), fullyVisibleMaxX);
    y = Math.min(Math.max(y, area.y), fullyVisibleMaxY);
    return { x, y, width: safeWidth, height: safeHeight };
}

function keepClockWindowOnScreen() {
    if (!clockWin || clockWin.isDestroyed()) return;
    const safeBounds = ensureBoundsInDisplay(clockWin.getBounds());
    const current = clockWin.getBounds();
    if (
        current.x !== safeBounds.x ||
        current.y !== safeBounds.y ||
        current.width !== safeBounds.width ||
        current.height !== safeBounds.height
    ) {
        clockWin.setBounds(safeBounds);
        writeClockConfig({ bounds: safeBounds });
    }
}

function keepLive2dWindowOnScreen() {
    if (!live2dWin || live2dWin.isDestroyed()) return;
    const safeBounds = ensureBoundsInDisplay(live2dWin.getBounds());
    const current = live2dWin.getBounds();
    if (
        current.x !== safeBounds.x ||
        current.y !== safeBounds.y ||
        current.width !== safeBounds.width ||
        current.height !== safeBounds.height
    ) {
        live2dWin.setBounds(safeBounds);
        writeLive2dConfig({ bounds: safeBounds });
    }
}

function keepChildWindowOnScreen() {
    if (!childWin || childWin.isDestroyed()) return;
    const safeBounds = ensureBoundsInDisplay(childWin.getBounds());
    const current = childWin.getBounds();
    if (
        current.x !== safeBounds.x ||
        current.y !== safeBounds.y ||
        current.width !== safeBounds.width ||
        current.height !== safeBounds.height
    ) {
        childWin.setBounds(safeBounds);
        writeChildWindowConfig({ bounds: safeBounds });
    }
}

function keepChildWindowsOnScreen() {
    keepChildWindowOnScreen();
    keepClockWindowOnScreen();
    keepLive2dWindowOnScreen();
}

function ensureReminderBounds() {
    const display = screen.getPrimaryDisplay();
    const area = display.workArea || display.bounds;
    const width = 520;
    const height = 640;
    return {
        x: Math.round(area.x + (area.width - width) / 2),
        y: Math.round(area.y + (area.height - height) / 2),
        width,
        height,
    };
}

function ensureTimerDisplayBounds(bounds = {}) {
    return ensureBoundsInDisplay({
        width: 360,
        height: 180,
        ...bounds,
    });
}

function closeLegacyChildWindows() {
    if (clockWin && !clockWin.isDestroyed()) {
        writeClockConfig({ visible: false, bounds: clockWin.getBounds() });
        clockWin.close();
    }
    if (live2dWin && !live2dWin.isDestroyed()) {
        writeLive2dConfig({ visible: false, bounds: live2dWin.getBounds() });
        live2dWin.close();
    }
}

function buildRendererUrl(route = "/") {
    const devUrl = process.env.RAN_PAK_DEV_URL || 'http://localhost:5174/';
    const loadDist = process.env.RAN_PAK_LOAD_DIST === '1' || app.isPackaged;
    const base = loadDist ? apiRuntime.origin : devUrl;
    return new URL(route, base).toString();
}

async function openReminderWindow(payload = {}) {
    const kind = ['alarm', 'stopwatch', 'pomodoro'].includes(payload.kind) ? payload.kind : 'alarm';
    reminderPayload = {
        id: String(payload.id || Date.now()),
        kind,
        title: String(payload.title || (kind === 'pomodoro' ? '番茄钟提醒' : (kind === 'stopwatch' ? '定时器提醒' : '闹钟提醒'))),
        message: String(payload.message || '时间到'),
        timeText: String(payload.timeText || ''),
        createdAt: payload.createdAt || Date.now(),
    };

    if (reminderWin && !reminderWin.isDestroyed()) {
        reminderWin.webContents.send('reminder-window:payload', reminderPayload);
        if (reminderWin.isMinimized()) reminderWin.restore();
        reminderWin.show();
        reminderWin.focus();
        return true;
    }

    const bounds = ensureReminderBounds();
    reminderWin = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        icon: getAppIcon(),
        minWidth: 420,
        minHeight: 520,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        show: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: false,
        title: "提醒",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true,
        },
    });

    reminderWin.loadURL(buildRendererUrl('/reminder-window'));
    reminderWin.once('ready-to-show', () => {
        reminderWin?.webContents.send('reminder-window:payload', reminderPayload);
        reminderWin?.show();
        reminderWin?.focus();
    });
    reminderWin.on('closed', () => {
        reminderWin = null;
    });
    return true;
}

async function openTimerDisplayWindow(payload = {}) {
    timerDisplayPayload = {
        ...payload,
        source: ['timer', 'pomodoro'].includes(payload.source) ? payload.source : 'timer',
        command: String(payload.command || 'sync'),
        title: String(payload.title || '定时器'),
        remainingSeconds: Math.max(0, Number(payload.remainingSeconds || 0)),
        totalSeconds: Math.max(1, Number(payload.totalSeconds || payload.remainingSeconds || 1)),
        running: Boolean(payload.running),
        finished: Boolean(payload.finished),
        message: String(payload.message || '定时器时间到'),
    };

    if (timerDisplayWin && !timerDisplayWin.isDestroyed()) {
        timerDisplayWin.webContents.send('timer-display:options', timerDisplayPayload);
        if (timerDisplayWin.isMinimized()) timerDisplayWin.restore();
        timerDisplayWin.show();
        return true;
    }

    const bounds = ensureTimerDisplayBounds(payload.bounds || {});
    timerDisplayWin = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        icon: getAppIcon(),
        minWidth: 260,
        minHeight: 140,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        show: false,
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        title: "定时器展示",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true,
        },
    });

    timerDisplayWin.loadURL(buildRendererUrl('/timer-display-window'));
    timerDisplayWin.once('ready-to-show', () => {
        timerDisplayWin?.webContents.send('timer-display:options', timerDisplayPayload);
        timerDisplayWin?.show();
    });
    timerDisplayWin.on('closed', () => {
        timerDisplayWin = null;
    });
    return true;
}

async function openClockWindow(options = {}) {
    const config = writeClockConfig({ ...options, visible: true });
    if (clockWin && !clockWin.isDestroyed()) {
        clockWin.webContents.send('clock-window:options', clockOptionsFromConfig(config));
        applyClockMousePolicy(config);
        clockWin.focus();
        return true;
    }

    const bounds = ensureBoundsInDisplay(config.bounds || {});
    writeClockConfig({ bounds });
    clockWin = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: Number(bounds.width || options.width || 360),
        height: Number(bounds.height || options.height || 140),
        icon: getAppIcon(),
        minWidth: 240,
        minHeight: 96,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        show: false,
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        title: "悬浮时钟",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true,
        },
    });

    clockWin.loadURL(buildRendererUrl('/overlay-clock'));
    clockWin.once('ready-to-show', () => {
        clockWin?.webContents.send('clock-window:options', clockOptionsFromConfig(config));
        applyClockMousePolicy(config);
        clockWin?.show();
    });
    const saveBounds = () => {
        if (!clockWin || clockWin.isDestroyed()) return;
        writeClockConfig({ bounds: clockWin.getBounds() });
    };
    clockWin.on('move', saveBounds);
    clockWin.on('resize', saveBounds);
    clockWin.on('closed', () => {
        if (!appQuitting) writeClockConfig({ visible: false });
        clockWin = null;
    });
    return true;
}

async function openLive2dWindow(options = {}) {
    const config = writeLive2dConfig({ ...options, visible: true });
    if (live2dWin && !live2dWin.isDestroyed()) {
        if (options.bounds) live2dWin.setBounds(ensureBoundsInDisplay({ ...live2dWin.getBounds(), ...options.bounds }));
        live2dWin.webContents.send('live2d-window:options', live2dOptionsFromConfig(config));
        applyLive2dMousePolicy(config);
        live2dWin.focus();
        return true;
    }

    const bounds = ensureBoundsInDisplay(config.bounds || {});
    writeLive2dConfig({ bounds });
    live2dWin = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: Number(bounds.width || options.width || 360),
        height: Number(bounds.height || options.height || 520),
        icon: getAppIcon(),
        minWidth: 260,
        minHeight: 320,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        show: false,
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        title: "Live2D 子窗口",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true,
        },
    });

    live2dWin.loadURL(buildRendererUrl('/overlay-live2d'));
    live2dWin.once('ready-to-show', () => {
        live2dWin?.webContents.send('live2d-window:options', live2dOptionsFromConfig(config));
        applyLive2dMousePolicy(config);
        live2dWin?.show();
    });
    const saveBounds = () => {
        if (!live2dWin || live2dWin.isDestroyed()) return;
        writeLive2dConfig({ bounds: live2dWin.getBounds() });
    };
    live2dWin.on('move', saveBounds);
    live2dWin.on('resize', saveBounds);
    live2dWin.on('closed', () => {
        if (!appQuitting) writeLive2dConfig({ visible: false });
        live2dWin = null;
    });
    return true;
}

async function openChildWindow(options = {}) {
    const config = writeChildWindowConfig({ ...options, visible: true });
    closeLegacyChildWindows();
    if (childWin && !childWin.isDestroyed()) {
        if (options.bounds) childWin.setBounds(ensureBoundsInDisplay({ ...childWin.getBounds(), ...options.bounds }));
        childWin.webContents.send('child-window:options', childWindowOptionsFromConfig(config));
        applyChildWindowMousePolicy(config);
        childWin.focus();
        return true;
    }

    const bounds = ensureBoundsInDisplay(config.bounds || {});
    writeChildWindowConfig({ bounds });
    childWin = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: Number(bounds.width || options.width || 420),
        height: Number(bounds.height || options.height || 560),
        icon: getAppIcon(),
        minWidth: 260,
        minHeight: 140,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        show: false,
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        title: "桌面部件",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true,
        },
    });

    childWin.loadURL(buildRendererUrl('/overlay-child-window'));
    childWin.once('ready-to-show', () => {
        childWin?.webContents.send('child-window:options', childWindowOptionsFromConfig(config));
        applyChildWindowMousePolicy(config);
        childWin?.show();
    });
    const saveBounds = () => {
        if (!childWin || childWin.isDestroyed()) return;
        writeChildWindowConfig({ bounds: childWin.getBounds() });
    };
    childWin.on('move', saveBounds);
    childWin.on('resize', saveBounds);
    childWin.on('closed', () => {
        if (!appQuitting) writeChildWindowConfig({ visible: false });
        childWin = null;
    });
    return true;
}

ipcMain.handle('dialog:select-image-files', async () => {
    const result = await dialog.showOpenDialog(win, {
        title: '选择批处理图片',
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'tif', 'tiff'] },
            { name: '全部文件', extensions: ['*'] },
        ],
    });
    return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('dialog:select-video-files', async () => {
    const result = await dialog.showOpenDialog(win, {
        title: '选择视频或音频文件',
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: '媒体文件', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'flv', 'ts', 'm4v', 'mp3', 'wav', 'aac', 'flac', 'ogg', 'srt', 'ass'] },
            { name: '全部文件', extensions: ['*'] },
        ],
    });
    return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('dialog:select-alarm-sound', async () => {
    const result = await dialog.showOpenDialog(win, {
        title: '选择闹钟铃声',
        properties: ['openFile'],
        filters: [
            { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] },
            { name: '全部文件', extensions: ['*'] },
        ],
    });
    return result.canceled ? '' : (result.filePaths[0] || '');
});

ipcMain.handle('alarm-sound:data-url', async (_event, filePath = '') => {
    if (!filePath) return '';
    const buffer = fs.readFileSync(filePath);
    return `data:${audioMimeType(filePath)};base64,${buffer.toString('base64')}`;
});

ipcMain.handle('reminder-window:open', async (_event, payload = {}) => openReminderWindow(payload));

ipcMain.handle('reminder-window:get-payload', async () => reminderPayload);

ipcMain.handle('time-tools:get-config', async () => readTimeToolsConfig());

ipcMain.handle('time-tools:update-config', async (_event, options = {}) => writeTimeToolsConfig(options));

ipcMain.handle('timer-display:open', async (_event, payload = {}) => openTimerDisplayWindow(payload));

ipcMain.handle('timer-display:update', async (_event, payload = {}) => {
    const nextCommand = String(payload.command || 'sync');
    const currentCommand = String(timerDisplayPayload?.command || '');
    timerDisplayPayload = {
        ...(timerDisplayPayload || {}),
        ...payload,
        command: nextCommand === 'sync' && ['start', 'next', 'reset', 'pause'].includes(currentCommand) ? currentCommand : nextCommand,
        remainingSeconds: Math.max(0, Number(payload.remainingSeconds ?? timerDisplayPayload?.remainingSeconds ?? 0)),
        totalSeconds: Math.max(1, Number(payload.totalSeconds ?? timerDisplayPayload?.totalSeconds ?? 1)),
        running: Boolean(payload.running),
        finished: Boolean(payload.finished),
    };
    if (!timerDisplayWin || timerDisplayWin.isDestroyed()) return false;
    timerDisplayWin.webContents.send('timer-display:options', timerDisplayPayload);
    return true;
});

ipcMain.handle('timer-display:close', async () => {
    if (!timerDisplayWin || timerDisplayWin.isDestroyed()) return false;
    timerDisplayWin.close();
    return true;
});

ipcMain.handle('timer-display:get-config', async () => timerDisplayPayload);

ipcMain.handle('timer-display:event', async (_event, payload = {}) => {
    const eventPayload = {
        ...payload,
        command: '',
        type: String(payload.type || ''),
        source: ['timer', 'pomodoro'].includes(payload.source) ? payload.source : 'timer',
        remainingSeconds: Math.max(0, Number(payload.remainingSeconds ?? 0)),
        totalSeconds: Math.max(1, Number(payload.totalSeconds ?? 1)),
        running: Boolean(payload.running),
        finished: Boolean(payload.finished),
    };
    timerDisplayPayload = {
        ...(timerDisplayPayload || {}),
        ...eventPayload,
    };
    BrowserWindow.getAllWindows().forEach((targetWindow) => {
        if (!targetWindow.isDestroyed()) targetWindow.webContents.send('timer-display:event', eventPayload);
    });
    return true;
});

ipcMain.handle('reminder-window:action', async (_event, action = {}) => {
    const payload = {
        id: String(action.id || reminderPayload?.id || ''),
        kind: String(action.kind || reminderPayload?.kind || ''),
        action: String(action.action || 'dismiss'),
    };
    BrowserWindow.getAllWindows().forEach((targetWindow) => {
        if (!targetWindow.isDestroyed()) targetWindow.webContents.send('reminder-window:action', payload);
    });
    if (reminderWin && !reminderWin.isDestroyed()) reminderWin.close();
    return true;
});

ipcMain.handle('dialog:select-ffmpeg-binary', async () => {
    const result = await dialog.showOpenDialog(win, {
        title: '选择 ffmpeg 可执行文件',
        properties: ['openFile'],
        filters: [
            { name: '可执行文件', extensions: process.platform === 'win32' ? ['exe'] : ['*'] },
            { name: '全部文件', extensions: ['*'] },
        ],
    });
    return result.canceled ? '' : (result.filePaths[0] || '');
});

ipcMain.handle('dialog:select-ffprobe-binary', async () => {
    const result = await dialog.showOpenDialog(win, {
        title: '选择 ffprobe 可执行文件',
        properties: ['openFile'],
        filters: [
            { name: '可执行文件', extensions: process.platform === 'win32' ? ['exe'] : ['*'] },
            { name: '全部文件', extensions: ['*'] },
        ],
    });
    return result.canceled ? '' : (result.filePaths[0] || '');
});

ipcMain.handle('dialog:select-live2d-catalog-file', async () => {
    const result = await dialog.showOpenDialog(win, {
        title: '选择 Live2D model-catalog.json',
        properties: ['openFile'],
        filters: [
            { name: 'JSON 文件', extensions: ['json'] },
            { name: '全部文件', extensions: ['*'] },
        ],
    });
    return result.canceled ? '' : (result.filePaths[0] || '');
});

ipcMain.handle('dialog:select-directory', async () => {
    const result = await dialog.showOpenDialog(win, {
        title: '选择输出目录',
        properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? '' : (result.filePaths[0] || '');
});

ipcMain.handle('shell:show-item-in-folder', async (_event, filePath) => {
    if (!filePath) return false;
    shell.showItemInFolder(filePath);
    return true;
});

ipcMain.handle('shell:open-external', async (_event, url) => {
    const target = String(url || '').trim();
    if (!/^https?:\/\//i.test(target)) return false;
    await shell.openExternal(target);
    return true;
});

ipcMain.handle('clock-window:open', async (_event, options = {}) => {
    return openClockWindow(options);
});

ipcMain.handle('clock-window:update', async (_event, options = {}) => {
    const config = writeClockConfig(options);
    if (!clockWin || clockWin.isDestroyed()) return false;
    keepClockWindowOnScreen();
    clockWin.webContents.send('clock-window:options', clockOptionsFromConfig(config));
    applyClockMousePolicy(config);
    return true;
});

ipcMain.handle('clock-window:close', async () => {
    if (!clockWin || clockWin.isDestroyed()) return false;
    writeClockConfig({ visible: false, bounds: clockWin.getBounds() });
    clockWin.close();
    return true;
});

ipcMain.handle('window:close-current', (event) => {
    const currentWindow = BrowserWindow.fromWebContents(event.sender);
    if (currentWindow && clockWin && currentWindow.id === clockWin.id) {
        writeClockConfig({ visible: false, bounds: currentWindow.getBounds() });
    }
    if (currentWindow && live2dWin && currentWindow.id === live2dWin.id) {
        writeLive2dConfig({ visible: false, bounds: currentWindow.getBounds() });
    }
    if (currentWindow && childWin && currentWindow.id === childWin.id) {
        writeChildWindowConfig({ visible: false, bounds: currentWindow.getBounds() });
    }
    if (currentWindow && reminderWin && currentWindow.id === reminderWin.id) {
        BrowserWindow.getAllWindows().forEach((targetWindow) => {
            if (!targetWindow.isDestroyed()) {
                targetWindow.webContents.send('reminder-window:action', {
                    id: String(reminderPayload?.id || ''),
                    kind: String(reminderPayload?.kind || ''),
                    action: 'dismiss',
                });
            }
        });
    }
    if (currentWindow && timerDisplayWin && currentWindow.id === timerDisplayWin.id) {
        timerDisplayWin = null;
    }
    currentWindow?.close();
    return true;
});

ipcMain.handle('clock-window:get-config', async () => readClockConfig());

ipcMain.handle('clock-window:set-locked', async (_event, locked) => {
    const bounds = clockWin && !clockWin.isDestroyed() ? clockWin.getBounds() : undefined;
    const config = writeClockConfig({ locked: Boolean(locked), ...(bounds ? { bounds } : {}) });
    applyClockMousePolicy(config);
    return true;
});

ipcMain.handle('live2d-window:open', async (_event, options = {}) => {
    return openLive2dWindow(options);
});

ipcMain.handle('live2d-window:update', async (_event, options = {}) => {
    const config = writeLive2dConfig(options);
    if (!live2dWin || live2dWin.isDestroyed()) return false;
    if (options.bounds) live2dWin.setBounds(ensureBoundsInDisplay({ ...live2dWin.getBounds(), ...options.bounds }));
    keepLive2dWindowOnScreen();
    live2dWin.webContents.send('live2d-window:options', live2dOptionsFromConfig(config));
    applyLive2dMousePolicy(config);
    return true;
});

ipcMain.handle('live2d-window:close', async () => {
    if (!live2dWin || live2dWin.isDestroyed()) return false;
    writeLive2dConfig({ visible: false, bounds: live2dWin.getBounds() });
    live2dWin.close();
    return true;
});

ipcMain.handle('live2d-window:get-config', async () => readLive2dConfig());

ipcMain.handle('live2d-window:set-locked', async (_event, locked) => {
    const bounds = live2dWin && !live2dWin.isDestroyed() ? live2dWin.getBounds() : undefined;
    const config = writeLive2dConfig({ locked: Boolean(locked), ...(bounds ? { bounds } : {}) });
    if (live2dWin && !live2dWin.isDestroyed()) {
        live2dWin.webContents.send('live2d-window:options', live2dOptionsFromConfig(config));
    }
    applyLive2dMousePolicy(config);
    return true;
});

ipcMain.handle('child-window:open', async (_event, options = {}) => openChildWindow(options));

ipcMain.handle('child-window:update', async (_event, options = {}) => {
    const config = writeChildWindowConfig(options);
    if (!childWin || childWin.isDestroyed()) {
        return openChildWindow(childWindowOptionsFromConfig(config));
    }
    closeLegacyChildWindows();
    if (options.bounds) childWin.setBounds(ensureBoundsInDisplay({ ...childWin.getBounds(), ...options.bounds }));
    keepChildWindowOnScreen();
    childWin.webContents.send('child-window:options', childWindowOptionsFromConfig(config));
    applyChildWindowMousePolicy(config);
    return true;
});

ipcMain.handle('child-window:close', async () => {
    if (!childWin || childWin.isDestroyed()) return false;
    writeChildWindowConfig({ visible: false, bounds: childWin.getBounds() });
    childWin.close();
    return true;
});

ipcMain.handle('child-window:get-config', async () => readChildWindowConfig());

ipcMain.handle('child-window:set-locked', async (_event, locked) => {
    const bounds = childWin && !childWin.isDestroyed() ? childWin.getBounds() : undefined;
    const config = writeChildWindowConfig({ locked: Boolean(locked), ...(bounds ? { bounds } : {}) });
    if (childWin && !childWin.isDestroyed()) {
        childWin.webContents.send('child-window:options', childWindowOptionsFromConfig(config));
    }
    applyChildWindowMousePolicy(config);
    return true;
});
ipcMain.handle('weather:forecast', async (_event, params = {}) => safeWeatherCall(() => fetchWeatherForecast(params)));
ipcMain.handle('weather:geocode', async (_event, params = {}) => safeWeatherCall(() => geocodeWeatherLocation(params)));
ipcMain.handle('dev-tools:http-request', async (_event, payload = {}) => performDevHttpRequest(payload));
ipcMain.handle('dev-tools:ssl-certificate', async (_event, payload = {}) => querySslCertificate(payload));
ipcMain.handle('dev-tools:load-store', async () => readDevToolStore());
ipcMain.handle('dev-tools:save-store', async (_event, payload = {}) => writeDevToolStore(payload));

function getClickerRuntime() {
    if (!clickerRuntime) {
        clickerRuntime = new ClickerRuntime({ userDataPath: app.getPath('userData') });
        clickerRuntime.on('event', (payload) => {
            BrowserWindow.getAllWindows().forEach((targetWindow) => {
                targetWindow.webContents.send('clicker:event', payload);
            });
        });
    }
    return clickerRuntime;
}

ipcMain.handle('clicker:get-state', async () => getClickerRuntime().getState());
ipcMain.handle('clicker:start-recording', async () => getClickerRuntime().startRecording());
ipcMain.handle('clicker:stop-recording', async () => getClickerRuntime().stopRecording());
ipcMain.handle('clicker:clear-recording', async () => getClickerRuntime().clearRecording());
ipcMain.handle('clicker:delete-point', async (_event, index) => getClickerRuntime().deletePoint(index));
ipcMain.handle('clicker:start-playback', async (_event, config) => getClickerRuntime().startPlayback(config));
ipcMain.handle('clicker:pause-playback', async () => getClickerRuntime().pausePlayback());
ipcMain.handle('clicker:resume-playback', async () => getClickerRuntime().resumePlayback());
ipcMain.handle('clicker:stop-playback', async () => getClickerRuntime().stopPlayback());
ipcMain.handle('clicker:save-profile', async (_event, profile) => getClickerRuntime().saveProfile(profile));
ipcMain.handle('clicker:load-profiles', async () => getClickerRuntime().loadProfiles());
ipcMain.handle('clicker:delete-profile', async (_event, id) => getClickerRuntime().deleteProfile(id));
ipcMain.handle('clicker:apply-profile', async (_event, profile) => getClickerRuntime().applyProfile(profile));

ipcMain.handle('window:minimize', () => {
    win?.minimize();
});

ipcMain.handle('window:toggle-maximize', () => {
    if (!win) return false;
    if (win.isMaximized()) {
        win.unmaximize();
        return false;
    }
    win.maximize();
    return true;
});

ipcMain.handle('window:close', () => {
    win?.close();
});

async function createWindow() {
    win = new BrowserWindow({
        width: 1600,
        height: 800,
        icon: getAppIcon(),
        title: "逝染终端",
        transparent: true,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true,
        },
    });

    win.loadURL(buildRendererUrl('/'));

    win.on('close', (event) => {
        if (!appQuitting) {
            event.preventDefault();
            app.quit();
        }
    });

    win.on('closed', () => {
        win = null;
    });
}

app.whenReady().then(async () => {
    process.env.RAN_PAK_RUNTIME_DIR = app.getPath('userData');
    const { startApiServer } = require('./services/api-server');
    apiRuntime = await startApiServer();
    process.env.RAN_PAK_API_BASE_URL = apiRuntime.baseUrl;
    await createWindow();
    const childConfig = readChildWindowConfig();
    registerChildShortcuts(childConfig);
    if (childConfig.visible) {
        setTimeout(() => openChildWindow(childWindowOptionsFromConfig(childConfig)), 500);
    }
    const clockConfig = readClockConfig();
    const live2dConfig = readLive2dConfig();
    if (!childConfig.visible && (clockConfig.visible || live2dConfig.visible)) {
        writeClockConfig({ visible: false });
        writeLive2dConfig({ visible: false });
        setTimeout(() => openChildWindow({
            showClock: Boolean(clockConfig.visible),
            showLive2d: Boolean(live2dConfig.visible),
            components: normalizeChildComponents({
                showClock: Boolean(clockConfig.visible),
                showLive2d: Boolean(live2dConfig.visible),
                showWeather: false,
            }),
            common: {
                backgroundColor: clockConfig.backgroundColor,
                backgroundColorInput: clockConfig.backgroundColorInput || clockConfig.backgroundColor,
                backgroundOpacity: clockConfig.backgroundOpacity,
                fontColor: clockConfig.fontColor,
                fontFamily: clockConfig.fontFamily,
                fontWeight: clockConfig.fontWeight,
                fontStyle: clockConfig.fontStyle,
                fontSize: clockConfig.fontSize,
            },
            clock: clockOptionsFromConfig(clockConfig),
            live2d: live2dOptionsFromConfig(live2dConfig),
            bounds: live2dConfig.visible ? live2dConfig.bounds : clockConfig.bounds,
        }), 500);
    }
    screen.on('display-metrics-changed', keepChildWindowsOnScreen);
    screen.on('display-removed', keepChildWindowsOnScreen);
    screen.on('display-added', keepChildWindowsOnScreen);
}).catch((error) => {
    console.error("应用启动失败:", error);
    app.quit();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    appQuitting = true;
    if (clockWin && !clockWin.isDestroyed()) {
        writeClockConfig({ visible: true, bounds: clockWin.getBounds() });
    }
    if (live2dWin && !live2dWin.isDestroyed()) {
        writeLive2dConfig({ visible: true, bounds: live2dWin.getBounds() });
    }
    if (childWin && !childWin.isDestroyed()) {
        writeChildWindowConfig({ visible: true, bounds: childWin.getBounds() });
    }
    if (reminderWin && !reminderWin.isDestroyed()) {
        reminderWin.close();
    }
    if (timerDisplayWin && !timerDisplayWin.isDestroyed()) {
        timerDisplayWin.close();
    }
    if (apiRuntime?.server) {
        apiRuntime.server.close();
    }
    if (clickerRuntime) {
        clickerRuntime.dispose();
    }
    unregisterChildShortcuts();
    screen.removeListener('display-metrics-changed', keepChildWindowsOnScreen);
    screen.removeListener('display-removed', keepChildWindowsOnScreen);
    screen.removeListener('display-added', keepChildWindowsOnScreen);
});
