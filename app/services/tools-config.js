const fs = require("fs");
const path = require("path");
const { TOOL_CONFIG_PATH, USER_LIVE2D_DIR, ensureRuntimeDirs } = require("./config");

const DEFAULT_TOOLS_CONFIG = {
    ffmpeg: {
        ffmpegPath: "",
        ffprobePath: "",
    },
    live2d: {
        assetsDir: "",
        catalogPath: "",
    },
};

function cleanPath(value) {
    return String(value || "").trim();
}

function normalizeConfig(config = {}) {
    return {
        ffmpeg: {
            ...DEFAULT_TOOLS_CONFIG.ffmpeg,
            ...(config.ffmpeg || {}),
            ffmpegPath: cleanPath(config.ffmpeg?.ffmpegPath),
            ffprobePath: cleanPath(config.ffmpeg?.ffprobePath),
        },
        live2d: {
            ...DEFAULT_TOOLS_CONFIG.live2d,
            ...(config.live2d || {}),
            assetsDir: cleanPath(config.live2d?.assetsDir),
            catalogPath: cleanPath(config.live2d?.catalogPath),
        },
    };
}

function readToolsConfig() {
    ensureRuntimeDirs();
    try {
        const raw = fs.readFileSync(TOOL_CONFIG_PATH, "utf-8");
        return normalizeConfig(JSON.parse(raw) || {});
    } catch {
        return normalizeConfig();
    }
}

function writeToolsConfig(nextConfig = {}) {
    const current = readToolsConfig();
    const merged = normalizeConfig({
        ffmpeg: { ...current.ffmpeg, ...(nextConfig.ffmpeg || {}) },
        live2d: { ...current.live2d, ...(nextConfig.live2d || {}) },
    });
    fs.mkdirSync(path.dirname(TOOL_CONFIG_PATH), { recursive: true });
    fs.writeFileSync(TOOL_CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
    return merged;
}

function resolveFfmpegBins(config = readToolsConfig()) {
    return {
        ffmpeg: cleanPath(config.ffmpeg?.ffmpegPath) || process.env.RAN_PAK_FFMPEG_PATH || "ffmpeg",
        ffprobe: cleanPath(config.ffmpeg?.ffprobePath) || process.env.RAN_PAK_FFPROBE_PATH || "ffprobe",
    };
}

function resolveLive2dAssetsDir(config = readToolsConfig()) {
    return cleanPath(config.live2d?.assetsDir) || USER_LIVE2D_DIR;
}

function resolveLive2dCatalogPath(config = readToolsConfig()) {
    const configured = cleanPath(config.live2d?.catalogPath);
    if (configured) return configured;
    return path.join(resolveLive2dAssetsDir(config), "model-catalog.json");
}

function validateExistingPath(filePath, label) {
    const value = cleanPath(filePath);
    if (!value) return "";
    if (!fs.existsSync(value)) {
        throw new Error(`${label} 不存在: ${value}`);
    }
    return value;
}

function validateToolsConfig(config = readToolsConfig()) {
    const normalized = normalizeConfig(config);
    validateExistingPath(normalized.ffmpeg.ffmpegPath, "ffmpeg");
    validateExistingPath(normalized.ffmpeg.ffprobePath, "ffprobe");
    validateExistingPath(normalized.live2d.assetsDir, "Live2D 资源目录");
    validateExistingPath(normalized.live2d.catalogPath, "Live2D catalog");
    return normalized;
}

function encodeAssetPath(value = "") {
    return String(value)
        .replace(/\\/g, "/")
        .split("/")
        .filter(Boolean)
        .map((part) => encodeURIComponent(part))
        .join("/");
}

function toLive2dAssetUrl(value) {
    const raw = String(value || "").trim().replace(/\\/g, "/");
    if (!raw) return raw;
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
    if (raw.startsWith("/live2d-assets/")) return raw;
    const relative = raw
        .replace(/^\/?vendor\/live2d-widget\//, "")
        .replace(/^\/+/, "");
    return `/live2d-assets/${encodeAssetPath(relative)}`;
}

function readLive2dCatalog(config = readToolsConfig()) {
    const catalogPath = resolveLive2dCatalogPath(config);
    const assetsDir = resolveLive2dAssetsDir(config);
    if (!fs.existsSync(assetsDir)) {
        throw Object.assign(new Error("Live2D 资源目录不存在，请先在设置中配置"), { statusCode: 404 });
    }
    if (!fs.existsSync(catalogPath)) {
        throw Object.assign(new Error("Live2D catalog 不存在，请先在设置中配置"), { statusCode: 404 });
    }
    const parsed = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
    if (!Array.isArray(parsed)) {
        throw new Error("Live2D catalog 必须是数组");
    }
    return parsed.map((model, index) => {
        const paths = Array.isArray(model.paths) ? model.paths.map(toLive2dAssetUrl).filter(Boolean) : [];
        return {
            ...model,
            id: index,
            message: model.message || model.name || `Live2D ${index + 1}`,
            paths,
            cover: model.cover ? toLive2dAssetUrl(model.cover) : "",
            textures: Number(model.textures || paths.length || 1),
        };
    }).filter((model) => model.paths.length);
}

module.exports = {
    DEFAULT_TOOLS_CONFIG,
    readToolsConfig,
    writeToolsConfig,
    validateToolsConfig,
    resolveFfmpegBins,
    resolveLive2dAssetsDir,
    resolveLive2dCatalogPath,
    readLive2dCatalog,
};
