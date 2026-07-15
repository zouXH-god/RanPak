const fs = require("fs");
const path = require("path");
const net = require("net");
const dns = require("dns");
const { Client } = require("ssh2");

const SENSITIVE_FIELDS = ["password", "passphrase"];
const DEFAULT_KEEPALIVE_INTERVAL = 15000;
const IMPORT_COLLECTION_KEYS = ["data", "items", "profiles", "servers", "list", "records"];
const IP_V4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IP_V6_REGEX = /^[\da-fA-F:]+$/;

function normalizePort(value, label) {
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`${label} 必须是 1-65535 之间的端口`);
    }
    return port;
}

function cleanText(value) {
    return String(value || "").trim();
}

function maskSecret(value) {
    if (!value) return "";
    return "******";
}

function nowIso() {
    return new Date().toISOString();
}

function fileNameFromRemote(remotePath) {
    return path.posix.basename(String(remotePath || "").replace(/\\/g, "/")) || "download";
}

function createShellId() {
    return `shell-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createFolderId() {
    return `folder-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createProfileId() {
    return `ssh-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createRemoteImportSourceId() {
    return `ssh-import-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/** 生成密钥条目唯一 ID */
function createPrivateKeyId() {
    return `key-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/** 判断主机地址是否为 IP（非域名） */
function isIpAddress(host) {
    return IP_V4_REGEX.test(host) || IP_V6_REGEX.test(host);
}

/** 异步解析域名为 IP 地址，失败返回空字符串 */
async function resolveDomainIp(host) {
    try {
        const { address } = await dns.promises.lookup(host);
        return address || "";
    } catch {
        return "";
    }
}

/** 将解析 IP 标记写入/更新备注内容 */
function updateRemarkWithIp(remark, ip) {
    const tag = `[解析IP: ${ip}]`;
    const cleaned = String(remark || "").replace(/\[解析IP: [^\]]*\]\s*/g, "").trim();
    return cleaned ? `${cleaned} ${tag}` : tag;
}

function hasOwnValue(source, keys) {
    return keys.some((key) => Object.prototype.hasOwnProperty.call(source || {}, key));
}

function firstValue(source, keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source || {}, key)) return source[key];
    }
    return "";
}

function parseHeaders(rows) {
    if (!rows) return {};
    if (!Array.isArray(rows) && typeof rows === "object") return rows;
    const headers = {};
    for (const row of rows || []) {
        if (row?.enabled === false) continue;
        const key = cleanText(row?.key);
        if (!key) continue;
        headers[key] = String(row?.value ?? "");
    }
    return headers;
}

function extractImportRows(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    for (const key of IMPORT_COLLECTION_KEYS) {
        if (Array.isArray(payload[key])) return payload[key];
    }
    return Object.values(payload).every((item) => item && typeof item === "object")
        ? Object.values(payload)
        : [];
}

class SshRuntime {
    constructor(options = {}) {
        this.configPath = options.configPath;
        this.safeStorage = options.safeStorage;
        this.onShellData = typeof options.onShellData === "function" ? options.onShellData : () => {};
        this.onTransferProgress = typeof options.onTransferProgress === "function" ? options.onTransferProgress : () => {};
        this.sessions = new Map();
        this.tunnels = new Map();
        this.nextTunnelId = 1;
    }

    ensureEncryptionAvailable() {
        if (!this.safeStorage?.isEncryptionAvailable?.()) {
            throw new Error("当前系统不支持凭据加密，已拒绝保存 SSH 敏感信息");
        }
    }

    encrypt(value) {
        const text = String(value || "");
        if (!text) return "";
        this.ensureEncryptionAvailable();
        return this.safeStorage.encryptString(text).toString("base64");
    }

    decrypt(value) {
        const text = String(value || "");
        if (!text) return "";
        this.ensureEncryptionAvailable();
        return this.safeStorage.decryptString(Buffer.from(text, "base64"));
    }

    readStore() {
        try {
            const parsed = JSON.parse(fs.readFileSync(this.configPath, "utf-8")) || {};
            return {
                ...parsed,
                profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
                folders: Array.isArray(parsed.folders) ? parsed.folders : [],
                remoteImportSources: Array.isArray(parsed.remoteImportSources) ? parsed.remoteImportSources : [],
                privates: Array.isArray(parsed.privates) ? parsed.privates : [],
                presetCommands: Array.isArray(parsed.presetCommands) ? parsed.presetCommands : [],
            };
        } catch {
            return { profiles: [], folders: [], remoteImportSources: [], privates: [], presetCommands: [] };
        }
    }

    writeStore(store) {
        const normalized = {
            ...store,
            profiles: Array.isArray(store?.profiles) ? store.profiles : [],
            folders: Array.isArray(store?.folders) ? store.folders : [],
            remoteImportSources: Array.isArray(store?.remoteImportSources) ? store.remoteImportSources : [],
            privates: Array.isArray(store?.privates) ? store.privates : [],
            presetCommands: Array.isArray(store?.presetCommands) ? store.presetCommands : [],
        };
        fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
        fs.writeFileSync(this.configPath, JSON.stringify(normalized, null, 2), "utf-8");

        try {
            const cloudSync = require("../cloud-sync");
            cloudSync.triggerSync("ssh_profiles");
            cloudSync.triggerSync("ssh_preset_commands");
        } catch {}

        return normalized;
    }

    normalizeJumpHost(hop = {}, currentHop = null) {
        const host = cleanText(hop.host);
        const username = cleanText(hop.username);
        if (!host) throw new Error("跳板机 Host 不能为空");
        if (!username) throw new Error("跳板机用户名不能为空");
        const normalized = {
            host,
            port: normalizePort(hop.port || currentHop?.port || 22, "跳板机端口"),
            username,
            privateKeyName: cleanText(hop.privateKeyName ?? currentHop?.privateKeyName),
            privateKeyPath: cleanText(hop.privateKeyPath),
            secrets: { ...(currentHop?.secrets || {}) },
        };
        for (const field of SENSITIVE_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(hop, field)) {
                const value = String(hop[field] || "");
                if (value || !currentHop?.secrets?.[field]) {
                    normalized.secrets[field] = this.encrypt(value);
                }
            }
        }
        return normalized;
    }

    normalizeProfile(profile = {}, current = null) {
        const id = cleanText(profile.id) || cleanText(current?.id) || createProfileId();
        const name = cleanText(profile.name);
        const host = cleanText(profile.host);
        const username = cleanText(profile.username);
        if (!name) throw new Error("连接名称不能为空");
        if (!host) throw new Error("Host 不能为空");
        if (!username) throw new Error("用户名不能为空");

        const rawJumpHosts = Array.isArray(profile.jumpHosts) ? profile.jumpHosts : [];
        const currentJumpHosts = Array.isArray(current?.jumpHosts) ? current.jumpHosts : [];
        const jumpHosts = rawJumpHosts
            .filter((h) => cleanText(h?.host))
            .map((h, i) => this.normalizeJumpHost(h, currentJumpHosts[i] || null));

        const normalized = {
            id,
            name,
            folderId: cleanText(profile.folderId ?? current?.folderId),
            host,
            port: normalizePort(profile.port || current?.port || 22, "SSH 端口"),
            username,
            remark: cleanText(profile.remark ?? current?.remark),
            privateKeyPath: cleanText(profile.privateKeyPath),
            privateKeyName: cleanText(profile.privateKeyName ?? current?.privateKeyName),
            keepaliveInterval: Math.max(0, Number(profile.keepaliveInterval ?? current?.keepaliveInterval ?? DEFAULT_KEEPALIVE_INTERVAL)),
            jumpHosts,
            createdAt: current?.createdAt || nowIso(),
            updatedAt: nowIso(),
            secrets: { ...(current?.secrets || {}) },
        };
        for (const field of SENSITIVE_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(profile, field)) {
                const value = String(profile[field] || "");
                if (value || !current?.secrets?.[field]) {
                    normalized.secrets[field] = this.encrypt(value);
                }
            }
        }
        return normalized;
    }

    publicJumpHost(hop = {}) {
        return {
            host: hop.host || "",
            port: hop.port || 22,
            username: hop.username || "",
            privateKeyName: hop.privateKeyName || "",
            privateKeyPath: hop.privateKeyPath || "",
            hasPassword: Boolean(hop.secrets?.password),
            hasPassphrase: Boolean(hop.secrets?.passphrase),
            password: maskSecret(hop.secrets?.password),
            passphrase: maskSecret(hop.secrets?.passphrase),
        };
    }

    publicProfile(profile = {}) {
        const session = this.sessions.get(profile.id);
        return {
            id: profile.id,
            name: profile.name,
            folderId: profile.folderId || "",
            host: profile.host,
            port: profile.port,
            username: profile.username,
            remark: profile.remark || "",
            privateKeyPath: profile.privateKeyPath || "",
            privateKeyName: profile.privateKeyName || "",
            keepaliveInterval: profile.keepaliveInterval,
            jumpHosts: (profile.jumpHosts || []).map((h) => this.publicJumpHost(h)),
            hasPassword: Boolean(profile.secrets?.password),
            hasPassphrase: Boolean(profile.secrets?.passphrase),
            password: maskSecret(profile.secrets?.password),
            passphrase: maskSecret(profile.secrets?.passphrase),
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
            status: session?.status || "disconnected",
            error: session?.error || "",
        };
    }

    listProfiles() {
        const store = this.readStore();
        return (store.profiles || []).map((profile) => this.publicProfile(profile));
    }

    listFolders() {
        const store = this.readStore();
        return (store.folders || []).map((folder) => ({
            id: folder.id,
            name: folder.name,
            parentId: folder.parentId || "",
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt,
        }));
    }

    saveFolder(folder = {}) {
        const store = this.readStore();
        const folders = Array.isArray(store.folders) ? store.folders : [];
        const id = cleanText(folder.id) || createFolderId();
        const name = cleanText(folder.name);
        const parentId = cleanText(folder.parentId);
        if (!name) throw new Error("文件夹名称不能为空");
        if (parentId && !folders.some((item) => item.id === parentId)) throw new Error("父文件夹不存在");
        if (parentId === id) throw new Error("父文件夹不能是自身");
        const current = folders.find((item) => item.id === id);
        const duplicated = folders.find((item) => item.parentId === parentId && item.name === name && item.id !== id);
        if (duplicated) throw new Error("同级文件夹名称已存在");
        const nextFolder = {
            id,
            name,
            parentId,
            createdAt: current?.createdAt || nowIso(),
            updatedAt: nowIso(),
        };
        const index = folders.findIndex((item) => item.id === id);
        if (index >= 0) folders.splice(index, 1, nextFolder);
        else folders.push(nextFolder);
        this.writeStore({ ...store, folders });
        return nextFolder;
    }

    deleteFolder(id) {
        const folderId = cleanText(id);
        if (!folderId) throw new Error("文件夹 ID 不能为空");
        const store = this.readStore();
        if ((store.folders || []).some((folder) => folder.parentId === folderId)) {
            throw new Error("文件夹中存在子文件夹，不能删除");
        }
        if ((store.profiles || []).some((profile) => profile.folderId === folderId)) {
            throw new Error("文件夹中存在连接，不能删除");
        }
        this.writeStore({
            ...store,
            folders: (store.folders || []).filter((folder) => folder.id !== folderId),
        });
        return this.listFolders();
    }

    /**
     * 拖拽移动节点：支持文件夹/连接的重新归类和排序
     * @param {object} payload - { type: 'folder'|'profile', id, targetParentId, afterId?, afterType? }
     */
    moveNode(payload = {}) {
        const type = cleanText(payload.type);
        const id = cleanText(payload.id);
        const targetParentId = cleanText(payload.targetParentId);
        if (!type || !id) throw new Error("移动参数不完整");
        if (!["folder", "profile"].includes(type)) throw new Error("节点类型不支持");

        const store = this.readStore();
        const folders = Array.isArray(store.folders) ? store.folders : [];
        const profiles = Array.isArray(store.profiles) ? store.profiles : [];

        if (targetParentId && !folders.some((f) => f.id === targetParentId)) {
            throw new Error("目标文件夹不存在");
        }

        if (type === "folder") {
            const folder = folders.find((f) => f.id === id);
            if (!folder) throw new Error("文件夹不存在");
            if (targetParentId === id) throw new Error("不能移动到自身");
            if (this.isDescendantFolder(folders, targetParentId, id)) {
                throw new Error("不能移动到自己的子文件夹中");
            }
            folder.parentId = targetParentId;
            folder.updatedAt = nowIso();
            const siblings = folders.filter((f) => (f.parentId || "") === targetParentId && f.id !== id);
            const sortOrder = this.calcSortOrder(siblings, folders, payload.afterId, payload.afterType);
            folder.sortOrder = sortOrder;
        } else {
            const profile = profiles.find((p) => p.id === id);
            if (!profile) throw new Error("连接不存在");
            profile.folderId = targetParentId;
            profile.updatedAt = nowIso();
            const siblingProfiles = profiles.filter((p) => (p.folderId || "") === targetParentId && p.id !== id);
            const sortOrder = this.calcSortOrder(siblingProfiles, profiles, payload.afterId, payload.afterType);
            profile.sortOrder = sortOrder;
        }

        this.writeStore({ ...store, folders, profiles });
        return { ok: true };
    }

    /** 检查 candidateId 是否是 targetId 的后代文件夹 */
    isDescendantFolder(folders, candidateId, targetId) {
        if (!candidateId || !targetId) return false;
        let cursor = folders.find((f) => f.id === candidateId);
        while (cursor) {
            if (cursor.parentId === targetId) return true;
            cursor = folders.find((f) => f.id === cursor.parentId);
        }
        return false;
    }

    /** 根据 afterId 计算新的 sortOrder 值 */
    calcSortOrder(siblings, allItems, afterId, afterType) {
        if (!afterId) return 0;
        const afterItem = allItems.find((item) => item.id === afterId);
        if (!afterItem) return (siblings.length + 1) * 1000;
        const afterOrder = afterItem.sortOrder ?? 0;
        const sorted = [...siblings].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const afterIndex = sorted.findIndex((item) => item.id === afterId);
        if (afterIndex < 0) return afterOrder + 1000;
        const nextItem = sorted[afterIndex + 1];
        if (!nextItem) return afterOrder + 1000;
        return Math.round((afterOrder + (nextItem.sortOrder ?? 0)) / 2);
    }

    getStoredProfile(id) {
        const store = this.readStore();
        const profile = (store.profiles || []).find((item) => item.id === id);
        if (!profile) throw new Error("SSH 连接配置不存在");
        return profile;
    }

    /** 获取连接认证信息，优先使用应用内密钥，回退到本地文件路径 */
    getAuthOptions(entry) {
        const auth = {};
        const password = this.decrypt(entry.secrets?.password);
        const passphrase = this.decrypt(entry.secrets?.passphrase);
        if (password) auth.password = password;
        if (passphrase) auth.passphrase = passphrase;
        if (entry.privateKeyName) {
            const store = this.readStore();
            const keyEntry = (store.privates || []).find((k) => k.name === entry.privateKeyName);
            if (keyEntry) {
                const content = this.decrypt(keyEntry.content);
                if (content) auth.privateKey = content;
                const keyPass = this.decrypt(keyEntry.password);
                if (keyPass && !auth.passphrase) auth.passphrase = keyPass;
            }
        } else if (entry.privateKeyPath) {
            auth.privateKey = fs.readFileSync(entry.privateKeyPath, "utf-8");
        }
        return auth;
    }

    getProfileAuth(profile) {
        return this.getAuthOptions(profile);
    }

    /** 保存连接配置，当 host 为域名时自动解析 IP 写入备注 */
    async saveProfile(profile = {}) {
        const store = this.readStore();
        const profiles = Array.isArray(store.profiles) ? store.profiles : [];
        const folderId = cleanText(profile.folderId);
        if (folderId && !(store.folders || []).some((folder) => folder.id === folderId)) {
            throw new Error("连接所属文件夹不存在");
        }
        const id = cleanText(profile.id);
        const current = id ? profiles.find((item) => item.id === id) : null;
        const normalized = this.normalizeProfile(profile, current);
        if (!isIpAddress(normalized.host)) {
            const ip = await resolveDomainIp(normalized.host);
            if (ip) normalized.remark = updateRemarkWithIp(normalized.remark, ip);
        }
        const duplicated = profiles.find((item) => item.name === normalized.name && item.id !== normalized.id);
        if (duplicated) throw new Error("连接名称已存在");
        const index = profiles.findIndex((item) => item.id === normalized.id);
        if (index >= 0) profiles.splice(index, 1, normalized);
        else profiles.push(normalized);
        this.writeStore({ ...store, profiles });
        return this.publicProfile(normalized);
    }

    uniqueProfileName(name, profileId, profiles) {
        const baseName = cleanText(name) || "SSH 连接";
        if (!profiles.some((item) => item.name === baseName && item.id !== profileId)) return baseName;
        let index = 2;
        let candidate = `${baseName} (${index})`;
        while (profiles.some((item) => item.name === candidate && item.id !== profileId)) {
            index += 1;
            candidate = `${baseName} (${index})`;
        }
        return candidate;
    }

    /** 标准化导入的连接配置，映射各种字段别名 */
    normalizeImportedProfile(raw = {}, current = null, folderId = "") {
        const host = cleanText(firstValue(raw, ["ip", "host", "hostname", "address"]));
        const username = cleanText(firstValue(raw, ["username", "user", "account", "loginUser"]));
        const payload = {
            id: current?.id || "",
            name: cleanText(firstValue(raw, ["name", "label", "title"])) || host,
            folderId: cleanText(firstValue(raw, ["folderId", "groupId"])) || folderId || current?.folderId || "",
            host,
            port: firstValue(raw, ["port", "sshPort"]) || current?.port || 22,
            username,
            remark: cleanText(firstValue(raw, ["remark", "note", "memo", "description"])) || current?.remark || "",
            privateKeyPath: cleanText(firstValue(raw, ["privateKeyPath", "keyPath"])) || current?.privateKeyPath || "",
            privateKeyName: cleanText(firstValue(raw, ["private", "privateKeyName", "keyName"])) || current?.privateKeyName || "",
            keepaliveInterval: firstValue(raw, ["keepaliveInterval", "keepAliveInterval"]) || current?.keepaliveInterval || DEFAULT_KEEPALIVE_INTERVAL,
        };
        if (hasOwnValue(raw, ["password", "pass"])) payload.password = firstValue(raw, ["password", "pass"]);
        if (hasOwnValue(raw, ["passphrase", "privateKeyPassphrase"])) payload.passphrase = firstValue(raw, ["passphrase", "privateKeyPassphrase"]);
        return payload;
    }

    normalizeRemoteImportSource(source = {}, current = null) {
        const id = cleanText(source.id) || cleanText(current?.id) || createRemoteImportSourceId();
        const name = cleanText(source.name);
        const url = cleanText(source.url);
        const method = cleanText(source.method || current?.method || "GET").toUpperCase();
        if (!name) throw new Error("远端导入名称不能为空");
        if (!/^https?:\/\//i.test(url)) throw new Error("远端 URL 必须以 http:// 或 https:// 开头");
        const allowedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);
        if (!allowedMethods.has(method)) throw new Error("请求方式不支持");
        return {
            id,
            name,
            url,
            method,
            folderId: cleanText(source.folderId ?? current?.folderId),
            headers: Array.isArray(source.headers)
                ? source.headers.map((header) => ({
                    enabled: header?.enabled !== false,
                    key: cleanText(header?.key),
                    value: String(header?.value ?? ""),
                })).filter((header) => header.key)
                : [],
            body: String(source.body ?? current?.body ?? ""),
            createdAt: current?.createdAt || nowIso(),
            updatedAt: nowIso(),
            lastSyncAt: current?.lastSyncAt || "",
            lastSyncResult: current?.lastSyncResult || null,
        };
    }

    publicRemoteImportSource(source = {}) {
        return {
            id: source.id,
            name: source.name,
            url: source.url,
            method: source.method || "GET",
            folderId: source.folderId || "",
            headers: Array.isArray(source.headers) ? source.headers : [],
            body: source.body || "",
            createdAt: source.createdAt,
            updatedAt: source.updatedAt,
            lastSyncAt: source.lastSyncAt || "",
            lastSyncResult: source.lastSyncResult || null,
        };
    }

    listRemoteImportSources() {
        const store = this.readStore();
        return (store.remoteImportSources || []).map((source) => this.publicRemoteImportSource(source));
    }

    saveRemoteImportSource(source = {}) {
        const store = this.readStore();
        const sources = Array.isArray(store.remoteImportSources) ? store.remoteImportSources : [];
        const id = cleanText(source.id);
        const current = id ? sources.find((item) => item.id === id) : null;
        const normalized = this.normalizeRemoteImportSource(source, current);
        const duplicated = sources.find((item) => item.name === normalized.name && item.id !== normalized.id);
        if (duplicated) throw new Error("远端导入名称已存在");
        const index = sources.findIndex((item) => item.id === normalized.id);
        if (index >= 0) sources.splice(index, 1, normalized);
        else sources.push(normalized);
        this.writeStore({ ...store, remoteImportSources: sources });
        return this.publicRemoteImportSource(normalized);
    }

    deleteRemoteImportSource(id) {
        const sourceId = cleanText(id);
        if (!sourceId) throw new Error("远端导入 ID 不能为空");
        const store = this.readStore();
        const sources = (store.remoteImportSources || []).filter((item) => item.id !== sourceId);
        this.writeStore({ ...store, remoteImportSources: sources });
        return sources.map((source) => this.publicRemoteImportSource(source));
    }

    importFromParsedJson(parsed, folderId = "") {
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.privates)) {
            for (const rawKey of parsed.privates) {
                const keyName = cleanText(rawKey?.name);
                const keyContent = cleanText(rawKey?.private || rawKey?.content);
                if (!keyName || !keyContent) continue;
                try {
                    this.savePrivateKey({ name: keyName, content: keyContent, password: cleanText(rawKey?.password || rawKey?.passphrase) });
                } catch { /* 同名密钥已存在则跳过 */ }
            }
        }

        const store = this.readStore();
        const profiles = Array.isArray(store.profiles) ? store.profiles : [];
        const folders = Array.isArray(store.folders) ? store.folders : [];
        const resolvedFolderId = cleanText(folderId);
        if (resolvedFolderId && !folders.some((folder) => folder.id === resolvedFolderId)) {
            throw new Error("导入目标文件夹不存在");
        }

        const importedFolderIds = new Map();
        const folderRows = [];
        const importedFolders = parsed && typeof parsed === "object" && Array.isArray(parsed.folders)
            ? parsed.folders
            : [];
        const result = {
            total: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            foldersCreated: 0,
            foldersReused: 0,
            errors: [],
            profiles: [],
        };

        const rememberFolder = (rawFolder, actualId) => {
            for (const key of ["id", "folderId", "groupId", "key"]) {
                const sourceId = cleanText(rawFolder?.[key]);
                if (sourceId) importedFolderIds.set(sourceId, actualId);
            }
        };
        const collectFolderProfiles = (rawFolder, actualId) => {
            for (const key of ["profiles", "connections", "servers", "hosts"]) {
                if (Array.isArray(rawFolder[key])) {
                    for (const profile of rawFolder[key]) folderRows.push({ raw: profile, folderId: actualId });
                    break;
                }
            }
        };
        const ensureFolder = (rawFolder, parentId) => {
            const name = cleanText(firstValue(rawFolder, ["name", "label", "title"]));
            if (!name) throw new Error("文件夹缺少 name");
            let folder = folders.find((item) => (item.parentId || "") === parentId && item.name === name);
            if (folder) {
                result.foldersReused += 1;
            } else {
                const timestamp = nowIso();
                folder = {
                    id: createFolderId(),
                    name,
                    parentId,
                    sortOrder: folders.filter((item) => (item.parentId || "") === parentId).length,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                };
                folders.push(folder);
                result.foldersCreated += 1;
            }
            rememberFolder(rawFolder, folder.id);
            return folder.id;
        };
        const collectNestedFolder = (rawFolder, parentId) => {
            if (!rawFolder || typeof rawFolder !== "object") throw new Error("文件夹配置项必须是对象");
            const actualId = ensureFolder(rawFolder, parentId);
            collectFolderProfiles(rawFolder, actualId);
            const children = Array.isArray(rawFolder.folders)
                ? rawFolder.folders
                : (Array.isArray(rawFolder.children) ? rawFolder.children : (Array.isArray(rawFolder.groups) ? rawFolder.groups : []));
            for (const child of children) collectNestedFolder(child, actualId);
            return actualId;
        };

        // 先处理带 parentId 的扁平目录，再递归处理嵌套目录；两种格式可以混用。
        const flatFolders = importedFolders.filter((item) => item && typeof item === "object" && cleanText(item.parentId));
        const resolving = new Set();
        const resolveFlatFolder = (rawFolder) => {
            const sourceId = cleanText(firstValue(rawFolder, ["id", "folderId", "groupId", "key"]));
            if (sourceId && importedFolderIds.has(sourceId)) return importedFolderIds.get(sourceId);
            if (resolving.has(rawFolder)) throw new Error("文件夹 parentId 存在循环引用");
            resolving.add(rawFolder);
            const sourceParentId = cleanText(rawFolder.parentId);
            const sourceParent = importedFolders.find((item) => cleanText(firstValue(item, ["id", "folderId", "groupId", "key"])) === sourceParentId);
            const actualParentId = sourceParent ? resolveFlatFolder(sourceParent) : resolvedFolderId;
            const actualId = ensureFolder(rawFolder, actualParentId);
            collectFolderProfiles(rawFolder, actualId);
            resolving.delete(rawFolder);
            return actualId;
        };
        for (const rawFolder of flatFolders) resolveFlatFolder(rawFolder);
        for (const rawFolder of importedFolders) {
            const sourceId = cleanText(firstValue(rawFolder, ["id", "folderId", "groupId", "key"]));
            if (sourceId && importedFolderIds.has(sourceId)) continue;
            collectNestedFolder(rawFolder, resolvedFolderId);
        }

        const rows = extractImportRows(parsed).map((raw) => ({ raw, folderId: "" })).concat(folderRows);
        if (rows.length === 0 && importedFolders.length === 0) throw new Error("未找到可导入的 SSH 配置数组或文件夹结构");
        result.total = rows.length;
        for (const [index, row] of rows.entries()) {
            try {
                const raw = row.raw;
                if (!raw || typeof raw !== "object") throw new Error("配置项必须是对象");
                const host = cleanText(firstValue(raw, ["ip", "host", "hostname", "address"]));
                if (!host) throw new Error("缺少 ip/host");
                const current = profiles.find((item) => item.host === host) || null;
                const sourceFolderId = cleanText(firstValue(raw, ["folderId", "groupId"]));
                const mappedFolderId = importedFolderIds.get(sourceFolderId) || row.folderId || resolvedFolderId;
                const payload = this.normalizeImportedProfile({ ...raw, folderId: mappedFolderId }, current, mappedFolderId);
                payload.name = this.uniqueProfileName(payload.name, current?.id || "", profiles);
                const normalized = this.normalizeProfile(payload, current);
                const profileIndex = profiles.findIndex((item) => item.id === normalized.id);
                if (profileIndex >= 0) {
                    profiles.splice(profileIndex, 1, normalized);
                    result.updated += 1;
                } else {
                    profiles.push(normalized);
                    result.created += 1;
                }
                result.profiles.push(this.publicProfile(normalized));
            } catch (error) {
                result.skipped += 1;
                result.errors.push({ index, error: error?.message || "导入失败" });
            }
        }

        this.writeStore({ ...store, folders, profiles });
        return result;
    }

    async importProfilesFromRemote(options = {}) {
        const url = cleanText(options.url);
        if (!/^https?:\/\//i.test(url)) throw new Error("远端 URL 必须以 http:// 或 https:// 开头");

        const method = cleanText(options.method || "GET").toUpperCase();
        const allowedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);
        if (!allowedMethods.has(method)) throw new Error("请求方式不支持");

        const headers = parseHeaders(options.headers);
        const body = String(options.body ?? "");
        const requestOptions = { method, headers };
        if (!["GET", "HEAD"].includes(method) && body) requestOptions.body = body;

        const response = await fetch(url, requestOptions);
        const text = await response.text();
        if (!response.ok) throw new Error(`远端请求失败：HTTP ${response.status} ${text.slice(0, 180)}`);

        let parsed;
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            throw new Error("远端响应不是合法 JSON");
        }

        return this.importFromParsedJson(parsed, options.folderId);
    }

    importProfilesFromText(options = {}) {
        const text = String(options.text ?? "").trim();
        if (!text) throw new Error("导入文本不能为空");

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            throw new Error("文本内容不是合法 JSON");
        }

        return this.importFromParsedJson(parsed, options.folderId);
    }

    async syncRemoteImportSource(id) {
        const sourceId = cleanText(id);
        if (!sourceId) throw new Error("远端导入 ID 不能为空");
        const store = this.readStore();
        const source = (store.remoteImportSources || []).find((item) => item.id === sourceId);
        if (!source) throw new Error("远端导入配置不存在");
        const result = await this.importProfilesFromRemote(source);
        const nextStore = this.readStore();
        const sources = Array.isArray(nextStore.remoteImportSources) ? nextStore.remoteImportSources : [];
        const index = sources.findIndex((item) => item.id === sourceId);
        if (index >= 0) {
            sources[index] = {
                ...sources[index],
                lastSyncAt: nowIso(),
                lastSyncResult: {
                    total: result.total,
                    created: result.created,
                    updated: result.updated,
                    skipped: result.skipped,
                },
                updatedAt: nowIso(),
            };
            this.writeStore({ ...nextStore, remoteImportSources: sources });
        }
        return result;
    }

    async deleteProfile(id) {
        await this.disconnect(id);
        const store = this.readStore();
        const profiles = (store.profiles || []).filter((item) => item.id !== id);
        this.writeStore({ ...store, profiles });
        return this.listProfiles();
    }

    connectClient(client, options) {
        return new Promise((resolve, reject) => {
            client.once("ready", () => resolve());
            client.once("error", (err) => reject(err));
            client.connect(options);
        });
    }

    forwardOut(client, destHost, destPort) {
        return new Promise((resolve, reject) => {
            client.forwardOut("127.0.0.1", 0, destHost, destPort, (err, stream) => {
                if (err) reject(err);
                else resolve(stream);
            });
        });
    }

    async connect(id) {
        const profile = this.getStoredProfile(id);
        const existing = this.sessions.get(id);
        if (existing?.status === "connected") return this.publicProfile(profile);
        if (existing?.client) existing.client.end();
        if (existing?.hopClients) existing.hopClients.forEach((c) => c.end());

        const jumpHosts = Array.isArray(profile.jumpHosts) ? profile.jumpHosts : [];
        const hopClients = [];

        const session = {
            profileId: id,
            client: null,
            hopClients,
            status: "connecting",
            error: "",
            sftp: null,
            shells: new Map(),
            connectedAt: "",
            tcpHandler: null,
        };
        this.sessions.set(id, session);

        const cleanupOnFail = () => {
            hopClients.forEach((c) => { try { c.end(); } catch {} });
            hopClients.length = 0;
        };

        try {
            let prevClient = null;

            for (let i = 0; i < jumpHosts.length; i++) {
                const hop = jumpHosts[i];
                const hopClient = new Client();
                hopClients.push(hopClient);

                const hopOptions = {
                    host: hop.host,
                    port: hop.port || 22,
                    username: hop.username,
                    keepaliveInterval: profile.keepaliveInterval,
                    ...this.getAuthOptions(hop),
                };

                if (prevClient) {
                    const stream = await this.forwardOut(prevClient, hop.host, hop.port || 22);
                    hopOptions.sock = stream;
                    delete hopOptions.host;
                    delete hopOptions.port;
                }

                await this.connectClient(hopClient, hopOptions);
                prevClient = hopClient;
            }

            const finalClient = new Client();
            const finalOptions = {
                host: profile.host,
                port: profile.port,
                username: profile.username,
                keepaliveInterval: profile.keepaliveInterval,
                ...this.getProfileAuth(profile),
            };

            if (prevClient) {
                const stream = await this.forwardOut(prevClient, profile.host, profile.port);
                finalOptions.sock = stream;
                delete finalOptions.host;
                delete finalOptions.port;
            }

            session.client = finalClient;

            finalClient.on("close", () => this.markDisconnected(id));
            finalClient.on("end", () => this.markDisconnected(id));
            finalClient.on("error", (error) => {
                const current = this.sessions.get(id);
                if (current) {
                    current.error = error?.message || "SSH 连接错误";
                    current.status = "error";
                }
            });

            await this.connectClient(finalClient, finalOptions);
            session.status = "connected";
            session.connectedAt = nowIso();
            return this.publicProfile(profile);
        } catch (error) {
            cleanupOnFail();
            session.status = "error";
            session.error = error?.message || "SSH 连接失败";
            throw new Error(session.error);
        }
    }

    async disconnect(id) {
        const session = this.sessions.get(id);
        if (!session) return true;
        const tunnelIds = Array.from(this.tunnels.values())
            .filter((tunnel) => tunnel.profileId === id)
            .map((tunnel) => tunnel.id);
        await Promise.allSettled(tunnelIds.map((tunnelId) => this.stopTunnel(tunnelId)));
        this.stopAllShells(id);
        if (session.sftp) session.sftp.end();
        if (session.client) session.client.end();
        if (session.hopClients) {
            for (let i = session.hopClients.length - 1; i >= 0; i--) {
                try { session.hopClients[i].end(); } catch {}
            }
        }
        this.sessions.delete(id);
        return true;
    }

    markDisconnected(id) {
        const session = this.sessions.get(id);
        if (!session) return;
        session.status = "disconnected";
        session.sftp = null;
        session.shells?.clear?.();
        if (session.hopClients) {
            session.hopClients.forEach((c) => { try { c.end(); } catch {} });
        }
        Array.from(this.tunnels.values())
            .filter((tunnel) => tunnel.profileId === id)
            .forEach((tunnel) => {
                tunnel.status = "stopped";
                tunnel.error = tunnel.error || "SSH 连接已断开";
            });
    }

    getSession(id) {
        const session = this.sessions.get(id);
        if (!session || session.status !== "connected") throw new Error("SSH 未连接");
        return session;
    }

    appendShellData(profileId, shellId, data) {
        const session = this.sessions.get(profileId);
        if (!session) return;
        const shell = session.shells?.get(shellId);
        if (!shell) return;
        const text = Buffer.isBuffer(data) ? data.toString("utf-8") : String(data || "");
        shell.buffer = `${shell.buffer || ""}${text}`.slice(-50000);
        this.onShellData({ profileId, shellId, data: text });
    }

    async startShell(payload = {}) {
        const profileId = cleanText(payload.profileId);
        const session = this.getSession(profileId);
        const requestedShellId = cleanText(payload.shellId);
        if (requestedShellId) {
            const existing = session.shells.get(requestedShellId);
            if (existing?.stream && !existing.stream.destroyed) {
                return { profileId, shellId: requestedShellId, active: true, buffer: existing.buffer || "" };
            }
        }
        const shellId = requestedShellId || createShellId();
        const cols = Math.max(20, Number(payload.cols || 100));
        const rows = Math.max(8, Number(payload.rows || 30));
        const term = cleanText(payload.term) || "xterm-256color";
        const stream = await new Promise((resolve, reject) => {
            session.client.shell({ term, cols, rows }, (error, shellStream) => {
                if (error) reject(error);
                else resolve(shellStream);
            });
        });
        session.shells.set(shellId, { id: shellId, stream, buffer: "", createdAt: nowIso() });
        stream.on("data", (data) => this.appendShellData(profileId, shellId, data));
        stream.stderr?.on?.("data", (data) => this.appendShellData(profileId, shellId, data));
        stream.on("close", () => {
            const current = this.sessions.get(profileId);
            const shell = current?.shells?.get(shellId);
            if (shell?.stream === stream) current.shells.delete(shellId);
            this.onShellData({ profileId, shellId, data: "\r\n[Shell 已关闭]\r\n" });
        });
        return { profileId, shellId, active: true, buffer: "" };
    }

    writeShell(payload = {}) {
        const session = this.getSession(payload.profileId);
        const shellId = cleanText(payload.shellId);
        const shell = session.shells.get(shellId);
        if (!shell?.stream || shell.stream.destroyed) throw new Error("Shell 未启动");
        shell.stream.write(String(payload.data ?? ""));
        return true;
    }

    resizeShell(payload = {}) {
        const session = this.getSession(payload.profileId);
        const shellId = cleanText(payload.shellId);
        const shell = session.shells.get(shellId);
        if (!shell?.stream || shell.stream.destroyed) return true;
        const cols = Math.max(20, Number(payload.cols || 100));
        const rows = Math.max(8, Number(payload.rows || 30));
        shell.stream.setWindow(rows, cols, 0, 0);
        return true;
    }

    stopShell(payload = {}) {
        const profileId = typeof payload === "string" ? payload : payload.profileId;
        const shellId = typeof payload === "string" ? "" : cleanText(payload.shellId);
        const session = this.sessions.get(profileId);
        if (!session) return true;
        if (!shellId) return this.stopAllShells(profileId);
        const shell = session.shells.get(shellId);
        if (!shell) return true;
        shell.stream.end();
        session.shells.delete(shellId);
        return true;
    }

    stopAllShells(profileId) {
        const session = this.sessions.get(profileId);
        if (!session?.shells) return true;
        session.shells.forEach((shell) => shell.stream.end());
        session.shells.clear();
        return true;
    }

    async getSftp(id) {
        const session = this.getSession(id);
        if (session.sftp) return session.sftp;
        session.sftp = await new Promise((resolve, reject) => {
            session.client.sftp((error, sftp) => {
                if (error) reject(error);
                else resolve(sftp);
            });
        });
        return session.sftp;
    }

    async listDir(payload = {}) {
        const requestedPath = cleanText(payload.remotePath) || ".";
        const sftp = await this.getSftp(payload.profileId);
        const remotePath = await new Promise((resolve) => {
            sftp.realpath(requestedPath, (error, resolvedPath) => resolve(error ? requestedPath : resolvedPath));
        });
        const items = await new Promise((resolve, reject) => {
            sftp.readdir(remotePath, (error, list) => error ? reject(error) : resolve(list || []));
        });
        return {
            remotePath,
            items: items.map((item) => ({
                name: item.filename,
                longname: item.longname,
                size: item.attrs?.size || 0,
                mtime: item.attrs?.mtime || 0,
                atime: item.attrs?.atime || 0,
                isDirectory: Boolean(item.attrs?.isDirectory?.()),
                isFile: Boolean(item.attrs?.isFile?.()),
            })),
        };
    }

    async upload(payload = {}) {
        const localPath = cleanText(payload.localPath);
        const remotePath = cleanText(payload.remotePath);
        const transferId = cleanText(payload.transferId);
        if (!localPath || !remotePath) throw new Error("上传路径不能为空");
        const fileSize = fs.statSync(localPath).size;
        const sftp = await this.getSftp(payload.profileId);
        const stepCallback = transferId ? (transferred, chunk, total) => {
            this.onTransferProgress({ transferId, transferred, total: total || fileSize });
        } : undefined;
        await new Promise((resolve, reject) => {
            sftp.fastPut(localPath, remotePath, { step: stepCallback }, (error) => error ? reject(error) : resolve());
        });
        return { remotePath, fileSize };
    }

    async download(payload = {}) {
        const remotePath = cleanText(payload.remotePath);
        const localDir = cleanText(payload.localDir);
        const transferId = cleanText(payload.transferId);
        if (!remotePath || !localDir) throw new Error("下载路径不能为空");
        const localPath = path.join(localDir, fileNameFromRemote(remotePath));
        const sftp = await this.getSftp(payload.profileId);
        const attrs = await new Promise((resolve, reject) => {
            sftp.stat(remotePath, (error, stat) => error ? resolve(null) : resolve(stat));
        });
        const fileSize = attrs?.size || 0;
        const stepCallback = transferId ? (transferred, chunk, total) => {
            this.onTransferProgress({ transferId, transferred, total: total || fileSize });
        } : undefined;
        await new Promise((resolve, reject) => {
            sftp.fastGet(remotePath, localPath, { step: stepCallback }, (error) => error ? reject(error) : resolve());
        });
        return { localPath, fileSize };
    }

    /** 下载远程文件到临时目录，用于拖拽到系统文件夹 */
    async downloadToTemp(payload = {}) {
        const remotePath = cleanText(payload.remotePath);
        const transferId = cleanText(payload.transferId);
        if (!remotePath) throw new Error("远程路径不能为空");
        const os = require("os");
        const tempDir = path.join(os.tmpdir(), "ran-pak-sftp-drag");
        fs.mkdirSync(tempDir, { recursive: true });
        const localPath = path.join(tempDir, fileNameFromRemote(remotePath));
        const sftp = await this.getSftp(payload.profileId);
        const attrs = await new Promise((resolve, reject) => {
            sftp.stat(remotePath, (error, stat) => error ? resolve(null) : resolve(stat));
        });
        const fileSize = attrs?.size || 0;
        const stepCallback = transferId ? (transferred, chunk, total) => {
            this.onTransferProgress({ transferId, transferred, total: total || fileSize });
        } : undefined;
        await new Promise((resolve, reject) => {
            sftp.fastGet(remotePath, localPath, { step: stepCallback }, (error) => error ? reject(error) : resolve());
        });
        return { localPath, fileSize };
    }

    async getServerStats(profileId) {
        const cmds = {
            hostname: "hostname 2>/dev/null",
            os: "cat /etc/os-release 2>/dev/null | head -4",
            kernel: "uname -r 2>/dev/null",
            arch: "uname -m 2>/dev/null",
            uptime: "uptime 2>/dev/null",
            load: "cat /proc/loadavg 2>/dev/null",
            cpu: "grep -c '^processor' /proc/cpuinfo 2>/dev/null",
            cpuModel: "grep 'model name' /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2",
            memory: "free -b 2>/dev/null | grep Mem",
            swap: "free -b 2>/dev/null | grep Swap",
            disk: "df -B1 -x tmpfs -x devtmpfs -x squashfs 2>/dev/null | tail -n+2",
            netTraffic: "cat /proc/net/dev 2>/dev/null | tail -n+3",
            topProcesses: "ps aux --sort=-%cpu 2>/dev/null | head -51",
            gpu: "nvidia-smi --query-gpu=index,name,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free,temperature.gpu,power.draw,power.limit,fan.speed,driver_version --format=csv,noheader,nounits 2>/dev/null",
            blockDevices: "lsblk -b -o NAME,TYPE,SIZE,MODEL,SERIAL,ROTA,MOUNTPOINT,FSTYPE -P 2>/dev/null",
            diskIo: "cat /proc/diskstats 2>/dev/null",
        };
        const script = Object.entries(cmds)
            .map(([key, cmd]) => `echo "===STAT:${key}==="; ${cmd}`)
            .join("; ");
        const result = await this.execCommand(profileId, script);
        const output = result.stdout || "";
        const stats = {};
        for (const [key] of Object.entries(cmds)) {
            const marker = `===STAT:${key}===`;
            const start = output.indexOf(marker);
            if (start < 0) { stats[key] = ""; continue; }
            const after = start + marker.length + 1;
            const nextMarker = output.indexOf("===STAT:", after);
            stats[key] = (nextMarker > 0 ? output.slice(after, nextMarker) : output.slice(after)).trim();
        }
        return stats;
    }

    async killProcess(profileId, pid, signal = 9) {
        const safePid = parseInt(pid);
        if (!safePid || safePid <= 0) throw new Error("无效的 PID");
        const result = await this.execCommand(profileId, `kill -${signal} ${safePid} 2>&1`);
        if (result.code !== 0) throw new Error(result.stderr || result.stdout || `kill 失败 (exit ${result.code})`);
        return { pid: safePid, signal };
    }

    async execCommand(profileId, command) {
        const session = this.getSession(profileId);
        return new Promise((resolve, reject) => {
            session.client.exec(command, (error, stream) => {
                if (error) return reject(error);
                let stdout = "", stderr = "";
                stream.on("data", (data) => { stdout += data; });
                stream.stderr.on("data", (data) => { stderr += data; });
                stream.on("close", (code) => resolve({ code, stdout, stderr }));
            });
        });
    }

    async downloadDir(payload = {}) {
        const remotePath = cleanText(payload.remotePath);
        const localDir = cleanText(payload.localDir);
        const transferId = cleanText(payload.transferId);
        const autoExtract = Boolean(payload.autoExtract);
        if (!remotePath || !localDir) throw new Error("路径不能为空");

        const dirName = path.posix.basename(remotePath);
        const parentDir = path.posix.dirname(remotePath);
        const archiveName = `/tmp/.ran-pak-${Date.now()}-${dirName}.tar.gz`;

        const compressResult = await this.execCommand(payload.profileId, `tar -czf "${archiveName}" -C "${parentDir}" "${dirName}"`);
        if (compressResult.code !== 0) throw new Error(`远程压缩失败: ${compressResult.stderr || "exit " + compressResult.code}`);

        try {
            const sftp = await this.getSftp(payload.profileId);
            const attrs = await new Promise((resolve, reject) => {
                sftp.stat(archiveName, (error, stat) => error ? resolve(null) : resolve(stat));
            });
            const fileSize = attrs?.size || 0;
            const localArchive = path.join(localDir, `${dirName}.tar.gz`);
            const stepCallback = transferId ? (transferred, _chunk, total) => {
                this.onTransferProgress({ transferId, transferred, total: total || fileSize });
            } : undefined;
            await new Promise((resolve, reject) => {
                sftp.fastGet(archiveName, localArchive, { step: stepCallback }, (error) => error ? reject(error) : resolve());
            });

            if (autoExtract) {
                const { execFileSync } = require("child_process");
                execFileSync("tar", ["-xzf", localArchive, "-C", localDir]);
                try { fs.unlinkSync(localArchive); } catch {}
                return { localPath: path.join(localDir, dirName), fileSize, extracted: true };
            }
            return { localPath: localArchive, fileSize, extracted: false };
        } finally {
            this.execCommand(payload.profileId, `rm -f "${archiveName}"`).catch(() => {});
        }
    }

    async readRemoteFile(payload = {}) {
        const remotePath = cleanText(payload.remotePath);
        if (!remotePath) throw new Error("远程路径不能为空");
        const maxSize = 2 * 1024 * 1024;
        const sftp = await this.getSftp(payload.profileId);
        const attrs = await new Promise((resolve, reject) => {
            sftp.stat(remotePath, (error, stat) => error ? reject(error) : resolve(stat));
        });
        if (attrs.isDirectory()) throw new Error("不能编辑目录");
        if (attrs.size > maxSize) throw new Error(`文件过大（${(attrs.size / 1024 / 1024).toFixed(1)}MB），仅支持编辑 2MB 以内的文件`);
        const chunks = [];
        const stream = sftp.createReadStream(remotePath);
        await new Promise((resolve, reject) => {
            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("end", resolve);
            stream.on("error", reject);
        });
        return { remotePath, content: Buffer.concat(chunks).toString("utf-8"), size: attrs.size };
    }

    async writeRemoteFile(payload = {}) {
        const remotePath = cleanText(payload.remotePath);
        const content = payload.content ?? "";
        if (!remotePath) throw new Error("远程路径不能为空");
        const sftp = await this.getSftp(payload.profileId);
        const buffer = Buffer.from(content, "utf-8");
        const stream = sftp.createWriteStream(remotePath);
        await new Promise((resolve, reject) => {
            stream.on("close", resolve);
            stream.on("error", reject);
            stream.end(buffer);
        });
        return { remotePath, size: buffer.length };
    }

    async mkdir(payload = {}) {
        const remotePath = cleanText(payload.remotePath);
        if (!remotePath) throw new Error("目录路径不能为空");
        const sftp = await this.getSftp(payload.profileId);
        await new Promise((resolve, reject) => {
            sftp.mkdir(remotePath, (error) => error ? reject(error) : resolve());
        });
        return { remotePath };
    }

    async rename(payload = {}) {
        const from = cleanText(payload.from);
        const to = cleanText(payload.to);
        if (!from || !to) throw new Error("重命名路径不能为空");
        const sftp = await this.getSftp(payload.profileId);
        await new Promise((resolve, reject) => {
            sftp.rename(from, to, (error) => error ? reject(error) : resolve());
        });
        return { from, to };
    }

    async deletePath(payload = {}) {
        const remotePath = cleanText(payload.remotePath);
        if (!remotePath) throw new Error("删除路径不能为空");
        const sftp = await this.getSftp(payload.profileId);
        const attrs = await new Promise((resolve, reject) => {
            sftp.stat(remotePath, (error, stat) => error ? reject(error) : resolve(stat));
        });
        await new Promise((resolve, reject) => {
            const callback = (error) => error ? reject(error) : resolve();
            if (attrs.isDirectory()) sftp.rmdir(remotePath, callback);
            else sftp.unlink(remotePath, callback);
        });
        return { remotePath };
    }

    publicTunnel(tunnel = {}) {
        return {
            id: tunnel.id,
            profileId: tunnel.profileId,
            profileName: tunnel.profileName,
            type: tunnel.type,
            status: tunnel.status,
            localHost: tunnel.localHost,
            localPort: tunnel.localPort,
            remoteHost: tunnel.remoteHost,
            remotePort: tunnel.remotePort,
            bindHost: tunnel.bindHost,
            bindPort: tunnel.bindPort,
            startedAt: tunnel.startedAt,
            error: tunnel.error || "",
        };
    }

    listSessions() {
        const store = this.readStore();
        return {
            profiles: (store.profiles || []).map((profile) => this.publicProfile(profile)),
            folders: (store.folders || []).map((folder) => ({
                id: folder.id,
                name: folder.name,
                parentId: folder.parentId || "",
                createdAt: folder.createdAt,
                updatedAt: folder.updatedAt,
            })),
            tunnels: Array.from(this.tunnels.values()).map((tunnel) => this.publicTunnel(tunnel)),
            shells: Array.from(this.sessions.values()).flatMap((session) =>
                Array.from(session.shells?.values?.() || []).map((shell) => ({
                    profileId: session.profileId,
                    shellId: shell.id,
                    active: Boolean(shell.stream && !shell.stream.destroyed),
                    createdAt: shell.createdAt,
                }))
            ),
        };
    }

    ensureNoDuplicateLocalPort(localHost, localPort) {
        const duplicate = Array.from(this.tunnels.values()).find((tunnel) =>
            tunnel.type === "local" &&
            tunnel.status === "running" &&
            tunnel.localHost === localHost &&
            tunnel.localPort === localPort
        );
        if (duplicate) throw new Error("本地监听端口已被当前 SSH 工具占用");
    }

    async startTunnel(payload = {}) {
        const session = this.getSession(payload.profileId);
        const profile = this.getStoredProfile(payload.profileId);
        const type = cleanText(payload.type) || "local";
        if (!["local", "remote"].includes(type)) throw new Error("端口映射类型不支持");
        if (type === "local") return await this.startLocalTunnel(session, profile, payload);
        return await this.startRemoteTunnel(session, profile, payload);
    }

    async startLocalTunnel(session, profile, payload) {
        const localHost = cleanText(payload.localHost) || "127.0.0.1";
        const localPort = normalizePort(payload.localPort, "本地端口");
        const remoteHost = cleanText(payload.remoteHost);
        const remotePort = normalizePort(payload.remotePort, "远程目标端口");
        if (!remoteHost) throw new Error("远程目标主机不能为空");
        this.ensureNoDuplicateLocalPort(localHost, localPort);
        const id = `tunnel-${this.nextTunnelId++}`;
        const tunnel = {
            id,
            profileId: profile.id,
            profileName: profile.name,
            type: "local",
            status: "starting",
            localHost,
            localPort,
            remoteHost,
            remotePort,
            startedAt: nowIso(),
            error: "",
            server: null,
            sockets: new Set(),
        };
        const server = net.createServer((socket) => {
            tunnel.sockets.add(socket);
            socket.once("close", () => tunnel.sockets.delete(socket));
            session.client.forwardOut(localHost, localPort, remoteHost, remotePort, (error, stream) => {
                if (error) {
                    tunnel.error = error.message || "本地转发失败";
                    socket.destroy();
                    return;
                }
                socket.pipe(stream).pipe(socket);
            });
        });
        tunnel.server = server;
        this.tunnels.set(id, tunnel);
        try {
            await new Promise((resolve, reject) => {
                server.once("error", reject);
                server.listen(localPort, localHost, resolve);
            });
            tunnel.status = "running";
            return this.publicTunnel(tunnel);
        } catch (error) {
            this.tunnels.delete(id);
            throw error;
        }
    }

    ensureTcpHandler(session) {
        if (session.tcpHandler) return;
        session.tcpHandler = (details, accept, reject) => {
            const tunnel = Array.from(this.tunnels.values()).find((item) =>
                item.type === "remote" &&
                item.profileId === session.profileId &&
                item.status === "running" &&
                item.bindPort === details.destPort
            );
            if (!tunnel) {
                reject();
                return;
            }
            const stream = accept();
            const socket = net.connect(tunnel.localPort, tunnel.localHost, () => {
                stream.pipe(socket).pipe(stream);
            });
            socket.once("error", (error) => {
                tunnel.error = error.message || "远程转发连接本地目标失败";
                stream.end();
            });
        };
        session.client.on("tcp connection", session.tcpHandler);
    }

    async startRemoteTunnel(session, profile, payload) {
        const bindHost = cleanText(payload.bindHost) || "127.0.0.1";
        const bindPort = normalizePort(payload.bindPort, "远程监听端口");
        const localHost = cleanText(payload.localHost) || "127.0.0.1";
        const localPort = normalizePort(payload.localPort, "本地目标端口");
        const id = `tunnel-${this.nextTunnelId++}`;
        const tunnel = {
            id,
            profileId: profile.id,
            profileName: profile.name,
            type: "remote",
            status: "starting",
            localHost,
            localPort,
            bindHost,
            bindPort,
            startedAt: nowIso(),
            error: "",
        };
        this.tunnels.set(id, tunnel);
        this.ensureTcpHandler(session);
        try {
            await new Promise((resolve, reject) => {
                session.client.forwardIn(bindHost, bindPort, (error) => error ? reject(error) : resolve());
            });
            tunnel.status = "running";
            return this.publicTunnel(tunnel);
        } catch (error) {
            this.tunnels.delete(id);
            throw error;
        }
    }

    async stopTunnel(id) {
        const tunnel = this.tunnels.get(id);
        if (!tunnel) return true;
        tunnel.status = "stopping";
        if (tunnel.type === "local" && tunnel.server) {
            tunnel.sockets?.forEach((socket) => socket.destroy());
            await new Promise((resolve) => tunnel.server.close(() => resolve()));
        }
        if (tunnel.type === "remote") {
            const session = this.sessions.get(tunnel.profileId);
            if (session?.status === "connected") {
                await new Promise((resolve) => {
                    session.client.unforwardIn(tunnel.bindHost, tunnel.bindPort, () => resolve());
                });
            }
        }
        this.tunnels.delete(id);
        return true;
    }

    /** 列出所有密钥条目（不返回明文内容） */
    listPrivateKeys() {
        const store = this.readStore();
        return (store.privates || []).map((key) => ({
            id: key.id,
            name: key.name,
            hasContent: Boolean(key.content),
            hasPassword: Boolean(key.password),
            createdAt: key.createdAt,
            updatedAt: key.updatedAt,
        }));
    }

    /** 保存密钥条目，name 唯一；编辑时 content/password 留空则保留原值 */
    savePrivateKey(payload = {}) {
        const store = this.readStore();
        const privates = Array.isArray(store.privates) ? store.privates : [];
        const id = cleanText(payload.id);
        const name = cleanText(payload.name);
        if (!name) throw new Error("密钥名称不能为空");
        const current = id ? privates.find((k) => k.id === id) : null;
        const duplicated = privates.find((k) => k.name === name && k.id !== (current?.id || id));
        if (duplicated) throw new Error("密钥名称已存在");
        const content = cleanText(payload.content);
        const password = cleanText(payload.password);
        const nextKey = {
            id: current?.id || createPrivateKeyId(),
            name,
            content: content ? this.encrypt(content) : (current?.content || ""),
            password: password ? this.encrypt(password) : (current?.password || ""),
            createdAt: current?.createdAt || nowIso(),
            updatedAt: nowIso(),
        };
        if (!nextKey.content && !current) throw new Error("密钥内容不能为空");
        const index = privates.findIndex((k) => k.id === nextKey.id);
        if (index >= 0) privates.splice(index, 1, nextKey);
        else privates.push(nextKey);
        this.writeStore({ ...store, privates });
        return { id: nextKey.id, name: nextKey.name, hasContent: Boolean(nextKey.content), hasPassword: Boolean(nextKey.password), createdAt: nextKey.createdAt, updatedAt: nextKey.updatedAt };
    }

    /** 删除密钥条目，被连接引用时拒绝删除 */
    deletePrivateKey(id) {
        const keyId = cleanText(id);
        if (!keyId) throw new Error("密钥 ID 不能为空");
        const store = this.readStore();
        const keyEntry = (store.privates || []).find((k) => k.id === keyId);
        if (!keyEntry) throw new Error("密钥不存在");
        const referenced = (store.profiles || []).find((p) => p.privateKeyName === keyEntry.name);
        if (referenced) throw new Error(`密钥正在被连接「${referenced.name}」使用，无法删除`);
        this.writeStore({ ...store, privates: (store.privates || []).filter((k) => k.id !== keyId) });
        return this.listPrivateKeys();
    }

    /** 预设指令 CRUD */
    listPresetCommands() {
        return this.readStore().presetCommands || [];
    }

    savePresetCommand(payload = {}) {
        const store = this.readStore();
        const commands = store.presetCommands || [];
        const id = cleanText(payload.id) || `cmd-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const type = payload.type === "group" ? "group" : "command";
        const name = cleanText(payload.name);
        if (!name) throw new Error("名称不能为空");
        if (type === "command" && !cleanText(payload.command)) throw new Error("指令不能为空");
        const existing = commands.find((c) => c.id === id);
        const entry = {
            id,
            type,
            name,
            command: type === "command" ? cleanText(payload.command) : "",
            params: cleanText(payload.params),
            remark: cleanText(payload.remark),
            parentId: cleanText(payload.parentId),
            sortOrder: existing?.sortOrder ?? commands.length,
        };
        if (existing) {
            Object.assign(existing, entry);
        } else {
            commands.push(entry);
        }
        this.writeStore({ ...store, presetCommands: commands });
        return entry;
    }

    deletePresetCommand(id) {
        const cmdId = cleanText(id);
        if (!cmdId) throw new Error("指令 ID 不能为空");
        const store = this.readStore();
        const commands = store.presetCommands || [];
        const target = commands.find((c) => c.id === cmdId);
        if (!target) throw new Error("指令不存在");
        if (target.type === "group") {
            const hasChildren = commands.some((c) => c.parentId === cmdId);
            if (hasChildren) throw new Error("指令组下有子项，请先删除子项");
        }
        this.writeStore({ ...store, presetCommands: commands.filter((c) => c.id !== cmdId) });
    }

    exportProfilesForSync() {
        const store = this.readStore();
        return store.profiles.map((p) => {
            const { secrets, ...rest } = p;
            return rest;
        });
    }

    importProfilesFromSync(data) {
        if (!Array.isArray(data)) return;
        const store = this.readStore();
        const existingIndex = new Map(store.profiles.map((p) => [p.id, p]));

        for (const incoming of data) {
            if (!incoming.id) continue;
            const existing = existingIndex.get(incoming.id);
            if (!existing) {
                store.profiles.push(incoming);
            } else {
                const incomingTime = new Date(incoming.updatedAt || 0).getTime();
                const existingTime = new Date(existing.updatedAt || 0).getTime();
                if (incomingTime > existingTime) {
                    Object.assign(existing, incoming, { secrets: existing.secrets });
                }
            }
        }
        this.writeStore(store);
    }

    exportPresetCommandsForSync() {
        const store = this.readStore();
        return store.presetCommands || [];
    }

    importPresetCommandsFromSync(data) {
        if (!Array.isArray(data)) return;
        const store = this.readStore();
        const existingIndex = new Map((store.presetCommands || []).map((c) => [c.id, c]));

        for (const incoming of data) {
            if (!incoming.id) continue;
            const existing = existingIndex.get(incoming.id);
            if (!existing) {
                store.presetCommands.push(incoming);
            } else {
                const incomingTime = new Date(incoming.updatedAt || 0).getTime();
                const existingTime = new Date(existing.updatedAt || 0).getTime();
                if (incomingTime > existingTime) {
                    Object.assign(existing, incoming);
                }
            }
        }
        this.writeStore(store);
    }

    async dispose() {
        await Promise.allSettled(Array.from(this.tunnels.keys()).map((id) => this.stopTunnel(id)));
        await Promise.allSettled(Array.from(this.sessions.keys()).map((id) => this.disconnect(id)));
    }
}

module.exports = {
    SshRuntime,
};
