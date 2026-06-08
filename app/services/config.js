const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const APP_ROOT = path.resolve(__dirname, "..");
const PROJECT_ROOT = path.resolve(APP_ROOT, "..");
const RUNTIME_ROOT = process.env.RAN_PAK_RUNTIME_DIR || APP_ROOT;
const CONFIG_DIR = path.join(RUNTIME_ROOT, "config");
const DNS_CONFIG_PATH = path.join(CONFIG_DIR, "dns.yaml");
const TOOL_CONFIG_PATH = path.join(CONFIG_DIR, "tools.json");
const UPLOAD_DIR = path.join(RUNTIME_ROOT, "temp", "uploads");
const USER_ASSET_DIR = path.join(RUNTIME_ROOT, "assets");
const USER_LIVE2D_DIR = path.join(USER_ASSET_DIR, "live2d");
const BUNDLED_STICKER_DIR = path.join(APP_ROOT, "assets", "stickers");
const USER_STICKER_DIR = path.join(RUNTIME_ROOT, "assets", "stickers");
const STICKER_DIR = fs.existsSync(BUNDLED_STICKER_DIR) ? BUNDLED_STICKER_DIR : USER_STICKER_DIR;
const BUNDLED_WEB_DIST_DIR = path.join(APP_ROOT, "web-dist");
const WEB_DIST_DIR = fs.existsSync(BUNDLED_WEB_DIST_DIR)
    ? BUNDLED_WEB_DIST_DIR
    : path.join(PROJECT_ROOT, "web", "dist");

function ensureRuntimeDirs() {
    for (const dir of [CONFIG_DIR, UPLOAD_DIR, USER_STICKER_DIR, USER_LIVE2D_DIR]) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function loadDnsConfig() {
    ensureRuntimeDirs();
    if (!fs.existsSync(DNS_CONFIG_PATH)) {
        return { dns_access: [] };
    }
    const raw = fs.readFileSync(DNS_CONFIG_PATH, "utf-8");
    return YAML.parse(raw) || { dns_access: [] };
}

function saveDnsConfig(config) {
    ensureRuntimeDirs();
    const nextConfig = {
        dns_access: Array.isArray(config?.dns_access) ? config.dns_access : [],
    };
    fs.writeFileSync(DNS_CONFIG_PATH, YAML.stringify(nextConfig), "utf-8");
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
    if (!accessKeyId) throw new Error("AccessKey ID 不能为空");
    if (!accessKeySecret) throw new Error("AccessKey Secret 不能为空");
    const config = loadDnsConfig();
    const nextAccount = {
        name,
        type,
        access_key_id: accessKeyId,
        access_key_secret: accessKeySecret,
    };
    const list = Array.isArray(config.dns_access) ? config.dns_access : [];
    const index = list.findIndex((item) => item.name === name);
    if (index >= 0) list.splice(index, 1, { ...list[index], ...nextAccount });
    else list.push(nextAccount);
    saveDnsConfig({ ...config, dns_access: list });
    return { ...nextAccount, access_key_id: maskSecret(accessKeyId), access_key_secret: maskSecret(accessKeySecret) };
}

module.exports = {
    APP_ROOT,
    PROJECT_ROOT,
    RUNTIME_ROOT,
    DNS_CONFIG_PATH,
    TOOL_CONFIG_PATH,
    UPLOAD_DIR,
    USER_ASSET_DIR,
    USER_LIVE2D_DIR,
    STICKER_DIR,
    WEB_DIST_DIR,
    ensureRuntimeDirs,
    getDnsAccounts,
    getDnsAccount,
    upsertDnsAccount,
};
