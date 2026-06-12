const fs = require("fs");
const path = require("path");
const net = require("net");
const { Client } = require("ssh2");

const SENSITIVE_FIELDS = ["password", "passphrase"];
const DEFAULT_KEEPALIVE_INTERVAL = 15000;

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
            };
        } catch {
            return { profiles: [], folders: [] };
        }
    }

    writeStore(store) {
        const normalized = {
            ...store,
            profiles: Array.isArray(store?.profiles) ? store.profiles : [],
            folders: Array.isArray(store?.folders) ? store.folders : [],
        };
        fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
        fs.writeFileSync(this.configPath, JSON.stringify(normalized, null, 2), "utf-8");
        return normalized;
    }

    normalizeProfile(profile = {}, current = null) {
        const id = cleanText(profile.id) || cleanText(current?.id) || `ssh-${Date.now()}`;
        const name = cleanText(profile.name);
        const host = cleanText(profile.host);
        const username = cleanText(profile.username);
        if (!name) throw new Error("连接名称不能为空");
        if (!host) throw new Error("Host 不能为空");
        if (!username) throw new Error("用户名不能为空");
        const normalized = {
            id,
            name,
            folderId: cleanText(profile.folderId ?? current?.folderId),
            host,
            port: normalizePort(profile.port || current?.port || 22, "SSH 端口"),
            username,
            privateKeyPath: cleanText(profile.privateKeyPath),
            keepaliveInterval: Math.max(0, Number(profile.keepaliveInterval ?? current?.keepaliveInterval ?? DEFAULT_KEEPALIVE_INTERVAL)),
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

    publicProfile(profile = {}) {
        const session = this.sessions.get(profile.id);
        return {
            id: profile.id,
            name: profile.name,
            folderId: profile.folderId || "",
            host: profile.host,
            port: profile.port,
            username: profile.username,
            privateKeyPath: profile.privateKeyPath || "",
            keepaliveInterval: profile.keepaliveInterval,
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

    getProfileAuth(profile) {
        const auth = {};
        const password = this.decrypt(profile.secrets?.password);
        const passphrase = this.decrypt(profile.secrets?.passphrase);
        if (password) auth.password = password;
        if (passphrase) auth.passphrase = passphrase;
        if (profile.privateKeyPath) {
            auth.privateKey = fs.readFileSync(profile.privateKeyPath, "utf-8");
        }
        return auth;
    }

    saveProfile(profile = {}) {
        const store = this.readStore();
        const profiles = Array.isArray(store.profiles) ? store.profiles : [];
        const folderId = cleanText(profile.folderId);
        if (folderId && !(store.folders || []).some((folder) => folder.id === folderId)) {
            throw new Error("连接所属文件夹不存在");
        }
        const id = cleanText(profile.id);
        const current = id ? profiles.find((item) => item.id === id) : null;
        const normalized = this.normalizeProfile(profile, current);
        const duplicated = profiles.find((item) => item.name === normalized.name && item.id !== normalized.id);
        if (duplicated) throw new Error("连接名称已存在");
        const index = profiles.findIndex((item) => item.id === normalized.id);
        if (index >= 0) profiles.splice(index, 1, normalized);
        else profiles.push(normalized);
        this.writeStore({ ...store, profiles });
        return this.publicProfile(normalized);
    }

    async deleteProfile(id) {
        await this.disconnect(id);
        const store = this.readStore();
        const profiles = (store.profiles || []).filter((item) => item.id !== id);
        this.writeStore({ ...store, profiles });
        return this.listProfiles();
    }

    async connect(id) {
        const profile = this.getStoredProfile(id);
        const existing = this.sessions.get(id);
        if (existing?.status === "connected") return this.publicProfile(profile);
        if (existing?.client) existing.client.end();

        const client = new Client();
        const session = {
            profileId: id,
            client,
            status: "connecting",
            error: "",
            sftp: null,
            shells: new Map(),
            connectedAt: "",
            tcpHandler: null,
        };
        this.sessions.set(id, session);
        client.on("close", () => this.markDisconnected(id));
        client.on("end", () => this.markDisconnected(id));
        client.on("error", (error) => {
            const current = this.sessions.get(id);
            if (current) {
                current.error = error?.message || "SSH 连接错误";
                current.status = "error";
            }
        });

        return await new Promise((resolve, reject) => {
            const onReady = () => {
                session.status = "connected";
                session.connectedAt = nowIso();
                resolve(this.publicProfile(profile));
            };
            const onError = (error) => {
                session.status = "error";
                session.error = error?.message || "SSH 连接失败";
                reject(new Error(session.error));
            };
            client.once("ready", onReady);
            client.once("error", onError);
            client.connect({
                host: profile.host,
                port: profile.port,
                username: profile.username,
                keepaliveInterval: profile.keepaliveInterval,
                ...this.getProfileAuth(profile),
            });
        });
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
        session.client.end();
        this.sessions.delete(id);
        return true;
    }

    markDisconnected(id) {
        const session = this.sessions.get(id);
        if (!session) return;
        session.status = "disconnected";
        session.sftp = null;
        session.shells?.clear?.();
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

    async dispose() {
        await Promise.allSettled(Array.from(this.tunnels.keys()).map((id) => this.stopTunnel(id)));
        await Promise.allSettled(Array.from(this.sessions.keys()).map((id) => this.disconnect(id)));
    }
}

module.exports = {
    SshRuntime,
};
