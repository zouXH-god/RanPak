const fs = require("fs");
const path = require("path");

const APP_ROOT = path.resolve(__dirname, "..", "..");
const PROJECT_ROOT = path.resolve(APP_ROOT, "..");

const PLUGINS_DIR_NAME = "ssh-plugins";
const MANIFEST_FILE = "manifest.json";
const STATE_FILE = "plugin-state.json";

const REQUIRED_MANIFEST_FIELDS = ["id", "name", "version", "entry"];

let _pluginsDir = null;
let _stateCache = null;

function getPluginsDir() {
    if (!_pluginsDir) {
        const runtimeDir = process.env.RAN_PAK_RUNTIME_DIR;
        if (!runtimeDir) throw new Error("RAN_PAK_RUNTIME_DIR not set");
        _pluginsDir = path.join(runtimeDir, PLUGINS_DIR_NAME);
        fs.mkdirSync(_pluginsDir, { recursive: true });
    }
    return _pluginsDir;
}

function getBundledPluginsDir() {
    const bundled = path.join(APP_ROOT, "bundled-plugins");
    if (fs.existsSync(bundled)) return bundled;
    const devPath = path.join(PROJECT_ROOT, "plugins");
    if (fs.existsSync(devPath)) return devPath;
    return null;
}

function listBundledPlugins() {
    const dir = getBundledPluginsDir();
    if (!dir) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const plugins = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const manifest = readManifest(path.join(dir, entry.name));
        if (!manifest) continue;
        const error = validateManifest(manifest);
        if (error) continue;
        plugins.push({ ...manifest, bundled: true, dirName: entry.name });
    }
    return plugins;
}

function syncBundledPlugins() {
    const bundledDir = getBundledPluginsDir();
    if (!bundledDir) return;
    const userDir = getPluginsDir();
    const entries = fs.readdirSync(bundledDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const srcDir = path.join(bundledDir, entry.name);
        const srcManifest = readManifest(srcDir);
        if (!srcManifest || validateManifest(srcManifest)) continue;

        const targetDir = path.join(userDir, srcManifest.id);
        const targetManifest = readManifest(targetDir);

        if (targetManifest && targetManifest.version === srcManifest.version) continue;

        if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
        }
        copyDirSync(srcDir, targetDir);
    }
}

function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function getStatePath() {
    return path.join(getPluginsDir(), STATE_FILE);
}

function readState() {
    if (_stateCache) return _stateCache;
    const statePath = getStatePath();
    if (!fs.existsSync(statePath)) {
        _stateCache = { disabled: [], order: [] };
        return _stateCache;
    }
    try {
        _stateCache = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    } catch {
        _stateCache = { disabled: [], order: [] };
    }
    return _stateCache;
}

function writeState(state) {
    _stateCache = state;
    fs.writeFileSync(getStatePath(), JSON.stringify(state, null, 2), "utf-8");
}

function validateManifest(manifest) {
    for (const field of REQUIRED_MANIFEST_FIELDS) {
        if (!manifest[field]) return `manifest.json missing required field: ${field}`;
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(manifest.id)) {
        return `invalid plugin id "${manifest.id}", must be lowercase alphanumeric with hyphens`;
    }
    return null;
}

function readManifest(pluginDir) {
    const manifestPath = path.join(pluginDir, MANIFEST_FILE);
    if (!fs.existsSync(manifestPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch {
        return null;
    }
}

function listPlugins() {
    const dir = getPluginsDir();
    const state = readState();
    const disabledSet = new Set(state.disabled || []);
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const plugins = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const manifest = readManifest(path.join(dir, entry.name));
        if (!manifest) continue;
        const error = validateManifest(manifest);
        if (error) continue;
        plugins.push({
            ...manifest,
            enabled: !disabledSet.has(manifest.id),
            dirName: entry.name,
        });
    }

    const orderMap = new Map((state.order || []).map((id, i) => [id, i]));
    plugins.sort((a, b) => {
        const oa = orderMap.has(a.id) ? orderMap.get(a.id) : 9999;
        const ob = orderMap.has(b.id) ? orderMap.get(b.id) : 9999;
        return oa - ob;
    });

    return plugins;
}

function loadPluginCode(pluginId) {
    const dir = getPluginsDir();
    const pluginDir = path.join(dir, pluginId);
    const manifest = readManifest(pluginDir);
    if (!manifest) throw new Error(`plugin "${pluginId}" not found`);

    const entryPath = path.join(pluginDir, manifest.entry || "component.js");
    if (!fs.existsSync(entryPath)) throw new Error(`plugin entry "${manifest.entry}" not found`);

    const code = fs.readFileSync(entryPath, "utf-8");

    let style = "";
    if (manifest.style) {
        const stylePath = path.join(pluginDir, manifest.style);
        if (fs.existsSync(stylePath)) {
            style = fs.readFileSync(stylePath, "utf-8");
        }
    }

    return { code, style, manifest };
}

function setPluginEnabled(pluginId, enabled) {
    const state = readState();
    const disabled = new Set(state.disabled || []);
    if (enabled) {
        disabled.delete(pluginId);
    } else {
        disabled.add(pluginId);
    }
    state.disabled = [...disabled];
    writeState(state);
    return { id: pluginId, enabled };
}

function setPluginOrder(orderedIds) {
    const state = readState();
    state.order = orderedIds;
    writeState(state);
}

async function installFromZip(zipBuffer, originalName) {
    const extractZip = require("extract-zip");
    const dir = getPluginsDir();
    const tempDir = path.join(dir, `.install-temp-${Date.now()}`);
    const tempZip = tempDir + ".zip";

    try {
        fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(tempZip, zipBuffer);
        await extractZip(tempZip, { dir: tempDir });

        let rootDir = tempDir;
        const topEntries = fs.readdirSync(tempDir, { withFileTypes: true });
        const dirs = topEntries.filter((e) => e.isDirectory());
        if (dirs.length === 1 && !fs.existsSync(path.join(tempDir, MANIFEST_FILE))) {
            rootDir = path.join(tempDir, dirs[0].name);
        }

        const manifest = readManifest(rootDir);
        if (!manifest) throw new Error("zip 中未找到有效的 manifest.json");

        const error = validateManifest(manifest);
        if (error) throw new Error(error);

        const targetDir = path.join(dir, manifest.id);
        if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
        }
        fs.renameSync(rootDir, targetDir);

        return { ok: true, manifest };
    } finally {
        try { fs.unlinkSync(tempZip); } catch {}
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
}

async function installFromUrl(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`download failed: ${resp.status} ${resp.statusText}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    return installFromZip(buffer, path.basename(url));
}

function uninstallPlugin(pluginId) {
    const dir = getPluginsDir();
    const pluginDir = path.join(dir, pluginId);
    if (!fs.existsSync(pluginDir)) throw new Error(`plugin "${pluginId}" not found`);
    fs.rmSync(pluginDir, { recursive: true, force: true });

    const state = readState();
    state.disabled = (state.disabled || []).filter((id) => id !== pluginId);
    state.order = (state.order || []).filter((id) => id !== pluginId);
    writeState(state);

    return { ok: true };
}

async function fetchRegistry(registryUrl) {
    const resp = await fetch(registryUrl);
    if (!resp.ok) throw new Error(`registry fetch failed: ${resp.status}`);
    const data = await resp.json();
    return data.plugins || [];
}

module.exports = {
    getPluginsDir,
    getBundledPluginsDir,
    listBundledPlugins,
    syncBundledPlugins,
    listPlugins,
    loadPluginCode,
    setPluginEnabled,
    setPluginOrder,
    installFromZip,
    installFromUrl,
    uninstallPlugin,
    fetchRegistry,
};
