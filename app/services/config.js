const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const APP_ROOT = path.resolve(__dirname, "..");
const PROJECT_ROOT = path.resolve(APP_ROOT, "..");
const BUNDLED_STICKER_DIR = path.join(APP_ROOT, "assets", "stickers");
const BUNDLED_WEB_DIST_DIR = path.join(APP_ROOT, "web-dist");

let _resolved = null;
function _paths() {
    if (!_resolved || !_resolved._fromEnv && process.env.RAN_PAK_RUNTIME_DIR) {
        const rr = process.env.RAN_PAK_RUNTIME_DIR || APP_ROOT;
        const configDir = path.join(rr, "config");
        const userAssetDir = path.join(rr, "assets");
        const userStickerDir = path.join(rr, "assets", "stickers");
        _resolved = {
            _fromEnv: Boolean(process.env.RAN_PAK_RUNTIME_DIR),
            RUNTIME_ROOT: rr,
            CONFIG_DIR: configDir,
            DNS_CONFIG_PATH: path.join(configDir, "dns.yaml"),
            TOOL_CONFIG_PATH: path.join(configDir, "tools.json"),
            UPLOAD_DIR: path.join(rr, "temp", "uploads"),
            USER_ASSET_DIR: userAssetDir,
            USER_LIVE2D_DIR: path.join(userAssetDir, "live2d"),
            USER_STICKER_DIR: userStickerDir,
            STICKER_DIR: fs.existsSync(BUNDLED_STICKER_DIR) ? BUNDLED_STICKER_DIR : userStickerDir,
            WEB_DIST_DIR: fs.existsSync(BUNDLED_WEB_DIST_DIR)
                ? BUNDLED_WEB_DIST_DIR
                : path.join(PROJECT_ROOT, "web", "dist"),
        };
    }
    return _resolved;
}

function ensureRuntimeDirs() {
    const p = _paths();
    for (const dir of [p.CONFIG_DIR, p.UPLOAD_DIR, p.USER_STICKER_DIR, p.USER_LIVE2D_DIR]) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function loadDnsConfig() {
    ensureRuntimeDirs();
    const dnsPath = _paths().DNS_CONFIG_PATH;
    if (!fs.existsSync(dnsPath)) {
        return { dns_access: [] };
    }
    const raw = fs.readFileSync(dnsPath, "utf-8");
    return YAML.parse(raw) || { dns_access: [] };
}

function saveDnsConfig(config) {
    ensureRuntimeDirs();
    const nextConfig = {
        dns_access: Array.isArray(config?.dns_access) ? config.dns_access : [],
    };
    fs.writeFileSync(_paths().DNS_CONFIG_PATH, YAML.stringify(nextConfig), "utf-8");

    try {
        const cloudSync = require("./cloud-sync");
        cloudSync.triggerSync("dns_accounts");
    } catch (e) {
        console.error("[config] cloud-sync trigger failed:", e.message);
    }

    return nextConfig;
}

function maskSecret(value) {
    if (!value) return "";
    if (value.length <= 6) return "******";
    return `${value.slice(0, 3)}******${value.slice(-3)}`;
}

function getDnsAccounts(mark = false) {
    const config = loadDnsConfig();
    return (config.dns_access || []).map((item) => ({
        ...item,
        access_key_id: mark ? maskSecret(item.access_key_id || "") : item.access_key_id || "",
        access_key_secret: mark ? maskSecret(item.access_key_secret || "") : item.access_key_secret || "",
    }));
}

function getDnsAccount(name) {
    const config = loadDnsConfig();
    const account = (config.dns_access || []).find((item) => item.name === name);
    if (!account) {
        throw new Error(`DNS配置 '${name}' 不存在`);
    }
    return account;
}

function upsertDnsAccount(account = {}) {
    const name = String(account.name || "").trim();
    const type = String(account.type || "").trim();
    const accessKeyId = String(account.access_key_id || "").trim();
    const accessKeySecret = String(account.access_key_secret || "").trim();
    if (!name) throw new Error("账号名称不能为空");
    if (!type) throw new Error("服务商类型不能为空");
    const config = loadDnsConfig();
    const list = Array.isArray(config.dns_access) ? config.dns_access : [];
    const index = list.findIndex((item) => item.name === name);
    if (index < 0) {
        if (!accessKeyId) throw new Error("AccessKey ID 不能为空");
        if (!accessKeySecret) throw new Error("AccessKey Secret 不能为空");
    }
    const nextAccount = { name, type };
    if (accessKeyId) nextAccount.access_key_id = accessKeyId;
    if (accessKeySecret) nextAccount.access_key_secret = accessKeySecret;
    if (index >= 0) list.splice(index, 1, { ...list[index], ...nextAccount });
    else list.push(nextAccount);
    saveDnsConfig({ ...config, dns_access: list });
    const saved = list.find((item) => item.name === name);
    return { ...saved, access_key_id: maskSecret(saved.access_key_id), access_key_secret: maskSecret(saved.access_key_secret) };
}

const _exports = {
    APP_ROOT,
    PROJECT_ROOT,
    ensureRuntimeDirs,
    loadDnsConfig,
    saveDnsConfig,
    getDnsAccounts,
    getDnsAccount,
    upsertDnsAccount,
};

for (const key of [
    "RUNTIME_ROOT", "DNS_CONFIG_PATH", "TOOL_CONFIG_PATH", "UPLOAD_DIR",
    "USER_ASSET_DIR", "USER_LIVE2D_DIR", "STICKER_DIR", "WEB_DIST_DIR",
]) {
    Object.defineProperty(_exports, key, {
        get() { return _paths()[key]; },
        enumerable: true,
    });
}

module.exports = _exports;
