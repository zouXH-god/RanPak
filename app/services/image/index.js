const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { STICKER_DIR, UPLOAD_DIR } = require("../config");

const imageStore = new Map();
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const DISK_MIME = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    tiff: "image/tiff",
    tif: "image/tiff",
    svg: "image/svg+xml",
};

function unsupportedMessage(format) {
    return `${format} 格式当前运行环境不支持`;
}

function extensionForFormat(format = "PNG") {
    const normalized = String(format || "PNG").toUpperCase();
    if (normalized === "JPEG") return "jpg";
    if (normalized === "TIFF") return "tiff";
    return normalized.toLowerCase();
}

function mimeForFormat(format = "PNG") {
    const ext = extensionForFormat(format);
    return DISK_MIME[ext] || "application/octet-stream";
}

function escapeXml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function clampNumber(value, fallback, min = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, number);
}

async function cleanupOldFiles(maxAgeSeconds = 3600) {
    const now = Date.now();
    const entries = await fs.readdir(UPLOAD_DIR, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
        const fullPath = path.join(UPLOAD_DIR, entry.name);
        const stat = await fs.stat(fullPath).catch(() => null);
        if (!stat || now - stat.mtimeMs <= maxAgeSeconds * 1000) continue;
        await fs.rm(fullPath, { recursive: true, force: true }).catch(() => {});
        for (const [imageId, savedPath] of imageStore.entries()) {
            if (savedPath === fullPath) imageStore.delete(imageId);
        }
    }
}

async function ensureSupportedInput(buffer, filename = "") {
    const ext = path.extname(filename).toLowerCase();
    if (ext === ".heic" || ext === ".heif" || ext === ".ico") {
        throw new Error(unsupportedMessage(ext.slice(1).toUpperCase()));
    }
    const image = sharp(buffer, { animated: false, failOn: "none" });
    return await image.metadata();
}

async function uploadImage(file) {
    if (!file?.buffer) throw new Error("未收到上传文件");
    const metadata = await ensureSupportedInput(file.buffer, file.originalname || "");
    const imageId = crypto.randomBytes(6).toString("hex");
    const originalExt = path.extname(file.originalname || "").replace(".", "").toLowerCase();
    const format = (metadata.format || originalExt || "png").toUpperCase();
    const saveExt = format === "JPEG" ? "jpg" : (metadata.format || originalExt || "png").toLowerCase();
    const savePath = path.join(UPLOAD_DIR, `${imageId}.${saveExt}`);
    await fs.writeFile(savePath, file.buffer);
    imageStore.set(imageId, savePath);
    cleanupOldFiles().catch(() => {});
    return {
        image_id: imageId,
        width: metadata.width || 0,
        height: metadata.height || 0,
        format,
        size: file.buffer.length,
    };
}

function getUploadedImagePath(imageId) {
    return imageStore.get(imageId) || "";
}

async function assertUploadedImage(imageId) {
    const imagePath = getUploadedImagePath(imageId);
    if (!imagePath) throw Object.assign(new Error("图片不存在或已过期"), { statusCode: 404 });
    await fs.access(imagePath);
    return imagePath;
}

async function findStickerPath(params = {}) {
    if (params.image_id) {
        const imagePath = getUploadedImagePath(params.image_id);
        if (imagePath) {
            await fs.access(imagePath);
            return imagePath;
        }
    }
    if (params.sticker_path) {
        await fs.access(params.sticker_path);
        return params.sticker_path;
    }
    if (!params.sticker_id) return "";
    const entries = await fs.readdir(STICKER_DIR, { withFileTypes: true }).catch(() => []);
    const item = entries.find((entry) => {
        const parsed = path.parse(entry.name);
        return entry.isFile() && parsed.name === params.sticker_id && IMAGE_EXTS.has(parsed.ext.toLowerCase());
    });
    return item ? path.join(STICKER_DIR, item.name) : "";
}

async function applyStep(input, step = {}) {
    const params = step.params || {};
    const type = step.type;
    let image = sharp(input, { animated: false, failOn: "none" });

    if (type === "crop") {
        return await image.extract({
            left: clampNumber(params.x, 0),
            top: clampNumber(params.y, 0),
            width: clampNumber(params.width, 100, 1),
            height: clampNumber(params.height, 100, 1),
        }).png().toBuffer();
    }
    if (type === "rotate") {
        return await image.rotate(-clampNumber(params.angle, 0), {
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        }).png().toBuffer();
    }
    if (type === "resize") {
        if (params.mode === "percent") {
            const metadata = await image.metadata();
            const scale = clampNumber(params.percent, 100, 1) / 100;
            const width = Math.max(1, Math.round((metadata.width || 1) * scale));
            const height = Math.max(1, Math.round((metadata.height || 1) * scale));
            return await image.resize(width, height, {
                fit: "fill",
                withoutEnlargement: false,
            }).png().toBuffer();
        }
        const width = clampNumber(params.width, 800, 1);
        const height = clampNumber(params.height, 600, 1);
        return await image.resize(width, height, {
            fit: params.keep_ratio === false ? "fill" : "inside",
            withoutEnlargement: false,
        }).png().toBuffer();
    }
    if (type === "flip") {
        image = params.direction === "vertical" ? image.flip() : image.flop();
        return await image.png().toBuffer();
    }
    if (type === "brightness") {
        return await image.modulate({ brightness: clampNumber(params.factor, 1) }).png().toBuffer();
    }
    if (type === "contrast") {
        const factor = clampNumber(params.factor, 1);
        return await image.linear(factor, 128 - 128 * factor).png().toBuffer();
    }
    if (type === "saturation") {
        return await image.modulate({ saturation: clampNumber(params.factor, 1) }).png().toBuffer();
    }
    if (type === "blur") {
        return await image.blur(clampNumber(params.radius, 2, 0.3)).png().toBuffer();
    }
    if (type === "sharpen") {
        return await image.sharpen().png().toBuffer();
    }
    if (type === "grayscale") {
        return await image.grayscale().png().toBuffer();
    }
    if (type === "watermark") {
        const metadata = await image.metadata();
        const width = metadata.width || 1;
        const height = metadata.height || 1;
        const text = escapeXml(params.content || "");
        if (!text) return await image.png().toBuffer();
        const size = clampNumber(params.size, 32, 8);
        const opacity = Math.min(1, clampNumber(params.opacity, 0.22, 0.05));
        const angle = clampNumber(params.angle, -30);
        const gapX = clampNumber(params.gap_x, 220, 40);
        const gapY = clampNumber(params.gap_y, 160, 40);
        const color = escapeXml(params.color || "#111827");
        const items = [];
        for (let y = -height; y < height * 2; y += gapY) {
            for (let x = -width; x < width * 2; x += gapX) {
                items.push(`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${angle} ${x} ${y})">${text}</text>`);
            }
        }
        const svg = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <g font-size="${size}" fill="${color}" fill-opacity="${opacity}" font-family="Microsoft YaHei, SimHei, Arial, sans-serif">
    ${items.join("\n")}
  </g>
</svg>`);
        return await image.composite([{ input: svg, left: 0, top: 0 }]).png().toBuffer();
    }
    if (type === "text") {
        const metadata = await image.metadata();
        const svg = Buffer.from(`
<svg width="${metadata.width || 1}" height="${metadata.height || 1}" xmlns="http://www.w3.org/2000/svg">
  <text x="${clampNumber(params.x, 50)}" y="${clampNumber(params.y, 50) + clampNumber(params.size, 24)}"
        font-size="${clampNumber(params.size, 24)}" fill="${escapeXml(params.color || "#000000")}"
        font-family="${escapeXml(params.font || "Microsoft YaHei, SimHei, Arial, sans-serif")}">${escapeXml(params.content || "")}</text>
</svg>`);
        return await image.composite([{ input: svg, left: 0, top: 0 }]).png().toBuffer();
    }
    if (type === "sticker") {
        const stickerPath = await findStickerPath(params);
        if (!stickerPath) return await image.png().toBuffer();
        let sticker = sharp(stickerPath, { animated: false, failOn: "none" })
            .resize(clampNumber(params.width, 64, 1), clampNumber(params.height, 64, 1), { fit: "fill" });
        if (Number(params.angle || 0) !== 0) {
            sticker = sticker.rotate(-Number(params.angle || 0), {
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            });
        }
        const stickerBuffer = await sticker.png().toBuffer();
        return await image.composite([{
            input: stickerBuffer,
            left: clampNumber(params.x, 0),
            top: clampNumber(params.y, 0),
        }]).png().toBuffer();
    }
    return await image.png().toBuffer();
}

async function executeWorkflow(source, steps = []) {
    let buffer = Buffer.isBuffer(source) ? source : await fs.readFile(source);
    await ensureSupportedInput(buffer);
    for (const step of steps || []) {
        buffer = await applyStep(buffer, step);
    }
    return buffer;
}

async function encodeOutput(buffer, outputFormat = "PNG", quality = 95) {
    const format = String(outputFormat || "PNG").toUpperCase();
    const image = sharp(buffer, { animated: false, failOn: "none" });
    if (format === "PNG") return await image.png().toBuffer();
    if (format === "JPEG" || format === "JPG") return await image.jpeg({ quality: Number(quality || 95) }).toBuffer();
    if (format === "WEBP") return await image.webp({ quality: Number(quality || 95) }).toBuffer();
    if (format === "TIFF" || format === "TIF") return await image.tiff({ quality: Number(quality || 95) }).toBuffer();
    if (format === "GIF") return await image.gif().toBuffer();
    if (format === "SVG") {
        const png = await image.png().toBuffer();
        const metadata = await sharp(png).metadata();
        return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${metadata.width}" height="${metadata.height}"><image href="data:image/png;base64,${png.toString("base64")}" width="${metadata.width}" height="${metadata.height}"/></svg>`);
    }
    if (["BMP", "ICO", "HEIC", "HEIF"].includes(format)) throw new Error(unsupportedMessage(format));
    throw new Error(`不支持的导出格式: ${format}`);
}

async function previewWorkflow(workflow) {
    const imagePath = await assertUploadedImage(workflow.image_id);
    const buffer = await executeWorkflow(imagePath, workflow.steps || []);
    return await sharp(buffer).png().toBuffer();
}

async function processWorkflow(workflow) {
    const imagePath = await assertUploadedImage(workflow.image_id);
    const buffer = await executeWorkflow(imagePath, workflow.steps || []);
    return await encodeOutput(buffer, workflow.output_format || "PNG", workflow.quality || 95);
}

async function batchProcess(request) {
    const outputDir = request.output_dir || path.join(UPLOAD_DIR, "batch_output");
    await fs.mkdir(outputDir, { recursive: true });
    const results = [];
    for (const filePath of request.file_paths || []) {
        const item = { source: filePath, success: false, output: "" };
        try {
            await fs.access(filePath);
            const buffer = await executeWorkflow(filePath, request.steps || []);
            const output = await encodeOutput(buffer, request.output_format || "PNG", request.quality || 95);
            const base = path.parse(filePath).name;
            const ext = extensionForFormat(request.output_format || "PNG");
            const outputPath = path.join(outputDir, `${base}_edited.${ext}`);
            await fs.writeFile(outputPath, output);
            item.success = true;
            item.output = outputPath;
        } catch (error) {
            item.error = error.message;
        }
        results.push(item);
    }
    const success = results.filter((item) => item.success).length;
    return {
        total: results.length,
        success,
        failed: results.length - success,
        results,
    };
}

async function batchProcessUploads(files, request) {
    const outputDir = request.output_dir || path.join(UPLOAD_DIR, "batch_output");
    await fs.mkdir(outputDir, { recursive: true });
    const steps = JSON.parse(request.steps || "[]");
    const results = [];
    for (const file of files || []) {
        const source = file.originalname || "image";
        const item = { source, success: false, output: "" };
        try {
            const buffer = await executeWorkflow(file.buffer, steps);
            const output = await encodeOutput(buffer, request.output_format || "PNG", request.quality || 95);
            const base = path.parse(source).name || crypto.randomBytes(4).toString("hex");
            const ext = extensionForFormat(request.output_format || "PNG");
            const outputPath = path.join(outputDir, `${base}_edited.${ext}`);
            await fs.writeFile(outputPath, output);
            item.success = true;
            item.output = outputPath;
        } catch (error) {
            item.error = error.message;
        }
        results.push(item);
    }
    const success = results.filter((item) => item.success).length;
    return {
        total: results.length,
        success,
        failed: results.length - success,
        results,
    };
}

async function listStickers() {
    const entries = await fs.readdir(STICKER_DIR, { withFileTypes: true }).catch(() => []);
    return entries
        .filter((entry) => entry.isFile() && IMAGE_EXTS.has(path.extname(entry.name).toLowerCase()))
        .map((entry) => ({
            id: path.parse(entry.name).name,
            name: entry.name,
            path: path.join(STICKER_DIR, entry.name),
        }));
}

module.exports = {
    uploadImage,
    previewWorkflow,
    processWorkflow,
    batchProcess,
    batchProcessUploads,
    listStickers,
    getUploadedImagePath,
    mimeForFormat,
    extensionForFormat,
    DISK_MIME,
};
