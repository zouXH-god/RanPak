const fs = require("fs");
const path = require("path");

function getCloudConfigPath() {
    const runtimeRoot = process.env.RAN_PAK_RUNTIME_DIR || path.resolve(__dirname, "..");
    return path.join(runtimeRoot, "config", "cloud-sync.json");
}

const DEFAULT_CLOUD_CONFIG = {
    url: "",
    username: "",
    token: "",
    role: "",
    lastSyncAt: 0,
    enabled: false,
};

let _config = null;
let _syncTimer = null;
let _syncInProgress = false;
let _writingFromCloud = false;

function loadCloudConfig() {
    if (_config) return _config;
    try {
        const raw = fs.readFileSync(getCloudConfigPath(), "utf-8");
        _config = { ...DEFAULT_CLOUD_CONFIG, ...JSON.parse(raw) };
    } catch {
        _config = { ...DEFAULT_CLOUD_CONFIG };
    }
    return _config;
}

function saveCloudConfig(config) {
    _config = { ...DEFAULT_CLOUD_CONFIG, ...config };
    const configPath = getCloudConfigPath();
    const dir = path.dirname(configPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(_config, null, 2), "utf-8");
    return _config;
}

function getCloudConfig() {
    const cfg = loadCloudConfig();
    return { ...cfg, token: cfg.token ? "***" : "" };
}

function reloadConfig() {
    _config = null;
    return loadCloudConfig();
}

function isLoggedIn() {
    const cfg = loadCloudConfig();
    return !!(cfg.url && cfg.token);
}

async function cloudRequest(method, endpoint, body = null) {
    const cfg = loadCloudConfig();
    if (!cfg.url || !cfg.token) {
        throw new Error("未配置云端服务或未登录");
    }

    const url = `${cfg.url.replace(/\/+$/, "")}${endpoint}`;
    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
    };

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (data.code === 401) {
        _config = { ...loadCloudConfig(), token: "", enabled: false };
        saveCloudConfig(_config);
        throw new Error("云端认证已过期，请重新登录");
    }

    if (data.code !== 200) {
        throw new Error(data.message || "云端请求失败");
    }

    return data.data;
}

async function login(url, username, password, totpCode = "") {
    const reqUrl = `${url.replace(/\/+$/, "")}/api/auth/login`;
    const body = { username, password };
    if (totpCode) body.totpCode = totpCode;

    const response = await fetch(reqUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const data = await response.json();

    // 特殊状态码透传给前端
    if ([4001, 4002, 4003].includes(data.code)) {
        return { code: data.code, message: data.message };
    }

    if (data.code !== 200) {
        throw new Error(data.message || "登录失败");
    }

    saveCloudConfig({
        url,
        username,
        token: data.data.token,
        role: data.data.user.role,
        enabled: true,
        lastSyncAt: Date.now(),
    });

    startPolling();
    return { code: 200, user: data.data.user, config: getCloudConfig() };
}

async function register(url, username, password) {
    const reqUrl = `${url.replace(/\/+$/, "")}/api/auth/register`;
    const response = await fetch(reqUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (data.code === 403) {
        throw new Error(data.message || "当前不允许注册");
    }
    if (data.code !== 200) {
        throw new Error(data.message || "注册失败");
    }

    // 需要审核的用户不保存 token
    if (data.data.pending) {
        return { code: 200, pending: true, message: data.message, user: data.data.user };
    }

    saveCloudConfig({
        url,
        username,
        token: data.data.token,
        role: data.data.user.role,
        enabled: true,
        lastSyncAt: Date.now(),
    });

    startPolling();
    return { code: 200, user: data.data.user, config: getCloudConfig() };
}

function logout() {
    stopPolling();
    _baselineInitialized = false;
    saveCloudConfig({ ...DEFAULT_CLOUD_CONFIG });
    return { success: true };
}

// --- 同步逻辑 ---

const DATA_TYPE_READERS = {};
const DATA_TYPE_WRITERS = {};
const _syncVersions = {};
const _lastRemoteUpdatedAt = {};
let _pollInterval = null;
let _onDataUpdated = null;

function registerDataType(type, reader, writer) {
    DATA_TYPE_READERS[type] = reader;
    DATA_TYPE_WRITERS[type] = writer;
}

function onDataUpdated(callback) {
    _onDataUpdated = callback;
}

async function fetchRemoteStatus() {
    return cloudRequest("GET", "/api/sync/status");
}

async function pullDataType(type) {
    if (!isLoggedIn()) return null;

    const result = await cloudRequest("GET", `/api/sync/${type}`);
    if (!result || !result.data || result.data === "{}") return null;

    _syncVersions[type] = result.version;
    _lastRemoteUpdatedAt[type] = result.updatedAt;

    const writer = DATA_TYPE_WRITERS[type];
    if (writer && result.data) {
        try {
            const parsed = JSON.parse(result.data);
            _writingFromCloud = true;
            writer(parsed);
            _writingFromCloud = false;
            if (_onDataUpdated) _onDataUpdated(type, parsed);
        } catch (e) {
            _writingFromCloud = false;
            console.error(`[cloud-sync] 拉取写回失败(${type}):`, e.message);
        }
    }

    return result;
}

async function syncDataType(type) {
    if (!isLoggedIn()) return null;

    const reader = DATA_TYPE_READERS[type];
    if (!reader) throw new Error(`未注册的同步类型: ${type}`);

    const localData = reader();
    const localJSON = JSON.stringify(localData);

    const result = await cloudRequest("POST", `/api/sync/${type}/merge`, {
        data: localJSON,
        version: _syncVersions[type] || 0,
        lastSyncAt: loadCloudConfig().lastSyncAt,
    });

    _syncVersions[type] = result.version;
    _lastRemoteUpdatedAt[type] = result.updatedAt;

    const writer = DATA_TYPE_WRITERS[type];
    if (writer && result.data) {
        try {
            const mergedData = JSON.parse(result.data);
            _writingFromCloud = true;
            writer(mergedData);
            _writingFromCloud = false;
            if (_onDataUpdated) _onDataUpdated(type, mergedData);
        } catch (e) {
            _writingFromCloud = false;
            console.error(`[cloud-sync] 写回本地数据失败(${type}):`, e.message);
        }
    }

    return result;
}

async function syncAll() {
    if (!isLoggedIn() || _syncInProgress) return;
    _syncInProgress = true;

    const results = {};
    const types = Object.keys(DATA_TYPE_READERS);

    for (const type of types) {
        try {
            results[type] = await syncDataType(type);
        } catch (e) {
            results[type] = { error: e.message };
        }
    }

    saveCloudConfig({ ...loadCloudConfig(), lastSyncAt: Date.now() });
    _syncInProgress = false;
    return results;
}

// 防抖同步（本地数据变更后触发上传）
let _debounceTimers = {};
function triggerSync(type, delayMs = 3000) {
    if (!isLoggedIn() || _writingFromCloud) return;

    if (_debounceTimers[type]) {
        clearTimeout(_debounceTimers[type]);
    }

    _debounceTimers[type] = setTimeout(async () => {
        try {
            await syncDataType(type);
            saveCloudConfig({ ...loadCloudConfig(), lastSyncAt: Date.now() });
        } catch (e) {
            console.error(`[cloud-sync] 自动同步失败(${type}):`, e.message);
        }
    }, delayMs);
}

// 定时轮询云端状态，检测远端数据变更
let _baselineInitialized = false;

async function checkRemoteUpdates() {
    if (!isLoggedIn() || _syncInProgress) return;

    try {
        const remoteStatus = await fetchRemoteStatus();
        if (!remoteStatus) return;

        // 首次轮询仅记录基线时间戳，不触发拉取
        if (!_baselineInitialized) {
            for (const [type, remoteTs] of Object.entries(remoteStatus)) {
                _lastRemoteUpdatedAt[type] = remoteTs;
            }
            _baselineInitialized = true;
            return;
        }

        const updatedTypes = [];
        for (const [type, remoteTs] of Object.entries(remoteStatus)) {
            const localTs = _lastRemoteUpdatedAt[type] || 0;
            if (remoteTs > localTs) {
                updatedTypes.push(type);
            }
        }

        if (updatedTypes.length === 0) return;

        _syncInProgress = true;
        for (const type of updatedTypes) {
            if (DATA_TYPE_WRITERS[type]) {
                try {
                    await pullDataType(type);
                } catch (e) {
                    console.error(`[cloud-sync] 拉取远端更新失败(${type}):`, e.message);
                }
            }
        }
        saveCloudConfig({ ...loadCloudConfig(), lastSyncAt: Date.now() });
        _syncInProgress = false;
    } catch (e) {
        console.error("[cloud-sync] 轮询状态失败:", e.message);
    }
}

function startPolling(intervalMs = 30000) {
    stopPolling();
    if (!isLoggedIn()) return;
    _pollInterval = setInterval(checkRemoteUpdates, intervalMs);
}

function stopPolling() {
    if (_pollInterval) {
        clearInterval(_pollInterval);
        _pollInterval = null;
    }
}

function getStatus() {
    const cfg = loadCloudConfig();
    return {
        loggedIn: isLoggedIn(),
        username: cfg.username,
        role: cfg.role,
        url: cfg.url,
        lastSyncAt: cfg.lastSyncAt,
        enabled: cfg.enabled,
        syncing: _syncInProgress,
    };
}

// --- 管理员 API ---

async function getUsers() {
    return cloudRequest("GET", "/api/admin/users");
}

async function createUser(data) {
    return cloudRequest("POST", "/api/admin/users", data);
}

async function updateUser(id, data) {
    return cloudRequest("PUT", `/api/admin/users/${id}`, data);
}

async function deleteUser(id) {
    return cloudRequest("DELETE", `/api/admin/users/${id}`);
}

async function approveUser(id) {
    return cloudRequest("PUT", `/api/admin/users/${id}/approve`);
}

// --- 服务器设置 ---

async function getServerSettings() {
    return cloudRequest("GET", "/api/admin/settings");
}

async function updateServerSettings(data) {
    return cloudRequest("PUT", "/api/admin/settings", data);
}

// --- TOTP 两步验证 ---

async function totpSetup() {
    return cloudRequest("POST", "/api/auth/totp/setup");
}

async function totpEnable(data) {
    return cloudRequest("POST", "/api/auth/totp/enable", data);
}

async function totpDisable(data) {
    return cloudRequest("POST", "/api/auth/totp/disable", data);
}

module.exports = {
    loadCloudConfig,
    saveCloudConfig,
    getCloudConfig,
    reloadConfig,
    isLoggedIn,
    login,
    register,
    logout,
    getStatus,
    syncAll,
    syncDataType,
    pullDataType,
    triggerSync,
    registerDataType,
    onDataUpdated,
    startPolling,
    stopPolling,
    checkRemoteUpdates,
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    approveUser,
    getServerSettings,
    updateServerSettings,
    totpSetup,
    totpEnable,
    totpDisable,
};
