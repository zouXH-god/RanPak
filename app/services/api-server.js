const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { API_TOKEN, authMiddleware } = require("./auth");
const { ensureRuntimeDirs, WEB_DIST_DIR } = require("./config");
const { sendError, sendSuccess } = require("./response");
const { getDnsAccounts, providerByName, buildDomain } = require("./dns");
const { upsertDnsAccount } = require("./config");
const files = require("./files");
const image = require("./image");
const video = require("./video");
const toolsConfig = require("./tools-config");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
});

function asyncRoute(handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            const code = error.statusCode || 400;
            sendError(res, error.message || "请求失败", code);
        }
    };
}

function corsMiddleware(req, res, next) {
    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
}

function sendLive2dAsset(req, res) {
    const assetsDir = toolsConfig.resolveLive2dAssetsDir();
    if (!assetsDir || !fs.existsSync(assetsDir)) {
        return sendError(res, "Live2D 资源目录不存在，请先在设置中配置", 404);
    }
    const relative = decodeURIComponent(String(req.path || "").replace(/^\/+/, ""));
    const target = path.resolve(assetsDir, relative);
    const root = path.resolve(assetsDir);
    if (!target.startsWith(root + path.sep) && target !== root) {
        return sendError(res, "非法资源路径", 400);
    }
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        return sendError(res, "Live2D 资源不存在", 404);
    }
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(target);
}

function createApiApp() {
    ensureRuntimeDirs();
    const app = express();
    app.disable("x-powered-by");
    app.use(corsMiddleware);
    app.use(express.json({ limit: "20mb" }));
    app.use(express.urlencoded({ extended: true }));

    app.use("/live2d-assets", sendLive2dAsset);

    app.get("/api/live2d/catalog", asyncRoute(async (_req, res) => {
        sendSuccess(res, toolsConfig.readLive2dCatalog());
    }));

    app.post("/api/live2d/catalog/test", asyncRoute(async (req, res) => {
        const current = toolsConfig.readToolsConfig();
        const live2d = req.body?.live2d || req.body || {};
        sendSuccess(res, toolsConfig.readLive2dCatalog({
            ...current,
            live2d: { ...(current.live2d || {}), ...live2d },
        }));
    }));

    app.use(authMiddleware);

    app.get("/api/auth/token", (_req, res) => sendSuccess(res, API_TOKEN));

    app.get("/api/tools/config", asyncRoute((_req, res) => {
        sendSuccess(res, toolsConfig.readToolsConfig());
    }));

    app.put("/api/tools/config", asyncRoute((req, res) => {
        sendSuccess(res, toolsConfig.writeToolsConfig(req.body || {}));
    }));

    app.post("/api/tools/ffmpeg/test", asyncRoute(async (req, res) => {
        sendSuccess(res, await video.getCapabilities(req.body || {}));
    }));

    app.get("/api/dns/access", asyncRoute((_req, res) => {
        sendSuccess(res, getDnsAccounts(true));
    }));

    app.post("/api/dns/access", asyncRoute((req, res) => {
        sendSuccess(res, upsertDnsAccount(req.body));
    }));

    app.get("/api/dns/access/:name/list", asyncRoute(async (req, res) => {
        const provider = providerByName(req.params.name);
        sendSuccess(res, await provider.listDomains());
    }));

    app.get("/api/dns/access/:name/records", asyncRoute(async (req, res) => {
        const provider = providerByName(req.params.name);
        sendSuccess(res, await provider.listRecords(buildDomain(req.query), {
            limit: req.query.limit,
            page: req.query.page,
            key: req.query.key,
            record_type: req.query.record_type,
        }));
    }));

    app.post("/api/dns/access/:name/record", asyncRoute(async (req, res) => {
        const provider = providerByName(req.params.name);
        const record = { ...req.body, domain: buildDomain(req.body) };
        sendSuccess(res, await provider.addRecord(record));
    }));

    app.put("/api/dns/access/:name/record", asyncRoute(async (req, res) => {
        const provider = providerByName(req.params.name);
        const record = { ...req.body, domain: buildDomain(req.body) };
        sendSuccess(res, await provider.updateRecord(record));
    }));

    app.put("/api/dns/access/:name/record/status", asyncRoute(async (req, res) => {
        const provider = providerByName(req.params.name);
        const record = { ...req.body, domain: buildDomain(req.body) };
        sendSuccess(res, await provider.setRecordStatus(record, req.body.status));
    }));

    app.delete("/api/dns/access/:name/record", asyncRoute(async (req, res) => {
        const provider = providerByName(req.params.name);
        const record = { ...req.query, domain: buildDomain(req.query) };
        sendSuccess(res, await provider.deleteRecord(record));
    }));

    app.get("/api/files/list", asyncRoute(async (req, res) => {
        sendSuccess(res, await files.getFileList(req.query.path));
    }));

    app.get("/api/files/read", asyncRoute(async (req, res) => {
        sendSuccess(res, await files.readTextFile(req.query.path, req.query.encoding || "utf-8"));
    }));

    app.delete("/api/files/delete", asyncRoute(async (req, res) => {
        sendSuccess(res, await files.deletePath(req.query.path));
    }));

    app.put("/api/files/rename", asyncRoute(async (req, res) => {
        sendSuccess(res, await files.renameByRegex(
            req.query.dir_path,
            req.query.regex,
            req.query.new_name,
            String(req.query.only_file ?? "true") !== "false",
        ));
    }));

    app.post("/api/image/upload", upload.single("file"), asyncRoute(async (req, res) => {
        sendSuccess(res, await image.uploadImage(req.file));
    }));

    app.post("/api/image/preview", asyncRoute(async (req, res) => {
        const buffer = await image.previewWorkflow(req.body);
        res.setHeader("Cache-Control", "no-cache");
        res.type("image/png").send(buffer);
    }));

    app.post("/api/image/process", asyncRoute(async (req, res) => {
        const format = req.body.output_format || "PNG";
        const buffer = await image.processWorkflow(req.body);
        const ext = image.extensionForFormat(format);
        res.setHeader("Content-Disposition", `attachment; filename=edited.${ext}`);
        res.setHeader("Cache-Control", "no-cache");
        res.type(image.mimeForFormat(format)).send(buffer);
    }));

    app.post("/api/image/batch", asyncRoute(async (req, res) => {
        sendSuccess(res, await image.batchProcess(req.body));
    }));

    app.post("/api/image/batch-upload", upload.array("files", 200), asyncRoute(async (req, res) => {
        sendSuccess(res, await image.batchProcessUploads(req.files || [], req.body));
    }));

    app.get("/api/image/stickers", asyncRoute(async (_req, res) => {
        sendSuccess(res, await image.listStickers());
    }));

    app.get("/api/image/file/:imageId", asyncRoute(async (req, res) => {
        const imagePath = image.getUploadedImagePath(req.params.imageId);
        if (!imagePath || !fs.existsSync(imagePath)) {
            return sendError(res, "图片不存在或已过期", 404);
        }
        const ext = path.extname(imagePath).replace(".", "").toLowerCase();
        res.setHeader("Cache-Control", "max-age=3600");
        res.type(image.DISK_MIME[ext] || "application/octet-stream");
        fs.createReadStream(imagePath).pipe(res);
    }));

    app.get("/api/video/capabilities", asyncRoute(async (_req, res) => {
        sendSuccess(res, await video.getCapabilities());
    }));

    app.post("/api/video/probe", asyncRoute(async (req, res) => {
        sendSuccess(res, await video.probeMedia(req.body));
    }));

    app.post("/api/video/jobs", asyncRoute(async (req, res) => {
        sendSuccess(res, await video.createJob(req.body));
    }));

    app.get("/api/video/jobs", asyncRoute(async (_req, res) => {
        sendSuccess(res, video.listJobs());
    }));

    app.get("/api/video/jobs/:id", asyncRoute(async (req, res) => {
        sendSuccess(res, video.getJob(req.params.id));
    }));

    app.post("/api/video/jobs/:id/cancel", asyncRoute(async (req, res) => {
        sendSuccess(res, video.cancelJob(req.params.id));
    }));

    app.get("/api/video/media", asyncRoute(async (req, res) => {
        const mediaPath = String(req.query.path || "");
        if (!mediaPath || !fs.existsSync(mediaPath)) {
            return sendError(res, "媒体文件不存在", 404);
        }
        res.setHeader("Cache-Control", "no-cache");
        res.type(path.extname(mediaPath).replace(".", "") || "application/octet-stream");
        fs.createReadStream(mediaPath).pipe(res);
    }));

    if (fs.existsSync(WEB_DIST_DIR)) {
        app.use(express.static(WEB_DIST_DIR));
        app.get(/.*/, (_req, res) => res.sendFile(path.join(WEB_DIST_DIR, "index.html")));
    }

    return app;
}

async function startApiServer(options = {}) {
    const port = Number(options.preferredPort || process.env.RAN_PAK_API_PORT || 8000);
    const host = "127.0.0.1";
    const app = createApiApp();
    return await new Promise((resolve, reject) => {
        const server = app.listen(port, host, () => {
            resolve({
                server,
                port,
                host,
                baseUrl: `http://${host}:${port}/api`,
                origin: `http://${host}:${port}`,
                token: API_TOKEN,
            });
        });
        server.on("error", (error) => {
            if (error.code === "EADDRINUSE") {
                reject(new Error(`Node API 服务端口 ${port} 已被占用`));
            } else {
                reject(error);
            }
        });
    });
}

module.exports = {
    createApiApp,
    startApiServer,
};
