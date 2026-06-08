const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { readToolsConfig, resolveFfmpegBins } = require("../tools-config");

const jobs = new Map();

function getFfmpegBins(overrides = {}) {
    const config = readToolsConfig();
    return resolveFfmpegBins({
        ...config,
        ffmpeg: {
            ...(config.ffmpeg || {}),
            ...(overrides.ffmpegPath ? { ffmpegPath: overrides.ffmpegPath } : {}),
            ...(overrides.ffprobePath ? { ffprobePath: overrides.ffprobePath } : {}),
        },
    });
}

function runProcess(bin, args, options = {}) {
    return new Promise((resolve) => {
        const child = spawn(bin, args, { windowsHide: true, ...options });
        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr?.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("error", (error) => {
            resolve({ ok: false, code: -1, stdout, stderr, error: error.message });
        });
        child.on("close", (code) => {
            resolve({ ok: code === 0, code, stdout, stderr });
        });
    });
}

function firstLine(value) {
    return String(value || "").split(/\r?\n/).find(Boolean) || "";
}

async function readList(bin, args) {
    const result = await runProcess(bin, args);
    const source = `${result.stdout}\n${result.stderr}`;
    return source
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^[ D\.][ E\.][VAS\.][I\.L\.S\.][S\.][ D\.T\.]/.test(line) || /^[A-Z\.]{2,7}\s+\S+/.test(line))
        .slice(0, 400);
}

async function getCapabilities(overrides = {}) {
    const bins = getFfmpegBins(overrides);
    const ffmpeg = await runProcess(bins.ffmpeg, ["-version"]);
    const ffprobe = await runProcess(bins.ffprobe, ["-version"]);
    if (!ffmpeg.ok || !ffprobe.ok) {
        return {
            available: false,
            ffmpeg: { ok: ffmpeg.ok, bin: bins.ffmpeg, version: firstLine(ffmpeg.stdout || ffmpeg.stderr), error: ffmpeg.error || ffmpeg.stderr || "" },
            ffprobe: { ok: ffprobe.ok, bin: bins.ffprobe, version: firstLine(ffprobe.stdout || ffprobe.stderr), error: ffprobe.error || ffprobe.stderr || "" },
            encoders: [],
            decoders: [],
            formats: [],
            filters: [],
            protocols: [],
            devices: [],
        };
    }

    const [encoders, decoders, formats, filters, protocols, devices] = await Promise.all([
        readList(bins.ffmpeg, ["-hide_banner", "-encoders"]),
        readList(bins.ffmpeg, ["-hide_banner", "-decoders"]),
        readList(bins.ffmpeg, ["-hide_banner", "-formats"]),
        readList(bins.ffmpeg, ["-hide_banner", "-filters"]),
        readList(bins.ffmpeg, ["-hide_banner", "-protocols"]),
        readList(bins.ffmpeg, ["-hide_banner", "-devices"]),
    ]);

    return {
        available: true,
        ffmpeg: { ok: true, bin: bins.ffmpeg, version: firstLine(ffmpeg.stdout) },
        ffprobe: { ok: true, bin: bins.ffprobe, version: firstLine(ffprobe.stdout) },
        encoders,
        decoders,
        formats,
        filters,
        protocols,
        devices,
    };
}

async function probeMedia(body = {}) {
    const input = body.path || body.url || body.input;
    if (!input) throw new Error("缺少媒体路径或 URL");
    const bins = getFfmpegBins();
    const result = await runProcess(bins.ffprobe, [
        "-v", "error",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        "-show_chapters",
        input,
    ]);
    if (!result.ok) throw new Error(result.stderr || result.error || "ffprobe 解析失败");
    return JSON.parse(result.stdout || "{}");
}

function quoteArg(arg) {
    const value = String(arg);
    if (!/[\s"]/g.test(value)) return value;
    return `"${value.replace(/"/g, '\\"')}"`;
}

function outputExt(container = "mp4") {
    const normalized = String(container || "mp4").toLowerCase();
    if (normalized === "mpegts") return "ts";
    if (normalized === "matroska") return "mkv";
    if (normalized === "image2") return "jpg";
    if (normalized === "adts") return "aac";
    return normalized.replace(/[^a-z0-9]/g, "") || "mp4";
}

function defaultOutputPath(input, output = {}) {
    const ext = outputExt(output.container);
    if (!input || /^https?:\/\//i.test(input)) {
        return path.join(process.cwd(), `ranpak-video-${Date.now()}.${ext}`);
    }
    const parsed = path.parse(input);
    return path.join(parsed.dir, `${parsed.name}${output.suffix || "-ranpak"}.${ext}`);
}

function normalizeCodec(codec) {
    const map = {
        h264: "libx264",
        h265: "libx265",
        hevc: "libx265",
        av1: "libaom-av1",
        vp9: "libvpx-vp9",
        aac: "aac",
        opus: "libopus",
        mp3: "libmp3lame",
        copy: "copy",
        none: "none",
    };
    return map[String(codec || "").toLowerCase()] || codec;
}

function primaryInput(workflow = {}) {
    return workflow.inputs?.[0]?.path || workflow.inputs?.[0]?.url || workflow.input;
}

function addCommonInputArgs(args, input, output = {}) {
    if (output.hardwareAccel && output.hardwareAccel !== "none") {
        args.push("-hwaccel", output.hardwareAccel);
    }
    if (output.startTime) args.push("-ss", String(output.startTime));
    args.push("-i", input);
    if (output.endTime) args.push("-to", String(output.endTime));
    if (output.duration) args.push("-t", String(output.duration));
}

function addOutputFormatArgs(args, output = {}) {
    if (output.container && output.container !== "auto") args.push("-f", String(output.container));
}

function buildVideoFilters(workflow = {}) {
    const output = workflow.output || {};
    const operations = workflow.operations || [];
    const filters = [];

    if (output.resolution && output.resolution !== "source") {
        filters.push(`scale=${output.resolution.replace("x", ":")}`);
    }
    if (output.fps) filters.push(`fps=${Number(output.fps)}`);

    for (const op of operations) {
        const params = op.params || {};
        if (op.type === "scale" && params.width && params.height) filters.push(`scale=${params.width}:${params.height}`);
        if (op.type === "crop" && params.width && params.height) filters.push(`crop=${params.width}:${params.height}:${params.x || 0}:${params.y || 0}`);
        if (op.type === "rotate") filters.push(`rotate=${Number(params.angle || 0)}*PI/180`);
        if (op.type === "fps" && params.fps) filters.push(`fps=${Number(params.fps)}`);
        if (op.type === "drawtext" && params.text) {
            const text = String(params.text).replace(/'/g, "\\'");
            filters.push(`drawtext=text='${text}':x=${params.x || 24}:y=${params.y || 24}:fontsize=${params.size || 28}:fontcolor=${params.color || "white"}`);
        }
        if (op.type === "subtitles" && params.path) {
            filters.push(`subtitles='${String(params.path).replace(/\\/g, "/").replace(/'/g, "\\'")}'`);
        }
    }
    return filters;
}

function buildAudioFilters(workflow = {}) {
    const operations = workflow.operations || [];
    const filters = [];
    for (const op of operations) {
        const params = op.params || {};
        if (op.type === "volume") filters.push(`volume=${Number(params.volume || 1)}`);
        if (op.type === "loudnorm") filters.push("loudnorm");
    }
    return filters;
}

function buildConvertArgs(workflow = {}, bins = getFfmpegBins()) {
    const input = primaryInput(workflow);
    if (!input) throw new Error("缺少输入媒体");
    const output = workflow.output || {};
    const outputPath = output.outputPath || defaultOutputPath(input, output);
    const args = ["-y", "-hide_banner", "-progress", "pipe:1", "-nostats"];
    addCommonInputArgs(args, input, output);

    const vfilters = buildVideoFilters(workflow);
    const afilters = buildAudioFilters(workflow);
    if (vfilters.length) args.push("-vf", vfilters.join(","));
    if (afilters.length) args.push("-af", afilters.join(","));

    const videoCodec = normalizeCodec(output.videoCodec || "libx264");
    const audioCodec = normalizeCodec(output.audioCodec || "aac");
    if (videoCodec !== "none") args.push("-c:v", videoCodec);
    if (audioCodec !== "none") args.push("-c:a", audioCodec);
    if (output.crf && videoCodec !== "copy") args.push("-crf", String(output.crf));
    if (output.preset && videoCodec !== "copy") args.push("-preset", String(output.preset));
    if (output.videoBitrate) args.push("-b:v", String(output.videoBitrate));
    if (output.audioBitrate) args.push("-b:a", String(output.audioBitrate));
    addOutputFormatArgs(args, output);
    args.push(outputPath);

    return {
        args,
        outputPath,
        bin: bins.ffmpeg,
        command: [bins.ffmpeg, ...args].map(quoteArg).join(" "),
    };
}

function buildCompressArgs(workflow = {}, bins = getFfmpegBins()) {
    const output = {
        crf: 28,
        preset: "medium",
        videoCodec: "libx264",
        audioCodec: "aac",
        container: "mp4",
        ...workflow.output,
    };
    return buildConvertArgs({ ...workflow, output }, bins);
}

function buildTrimArgs(workflow = {}, bins = getFfmpegBins()) {
    return buildConvertArgs(workflow, bins);
}

function buildExtractAudioArgs(workflow = {}, bins = getFfmpegBins()) {
    const input = primaryInput(workflow);
    if (!input) throw new Error("缺少输入媒体");
    const output = workflow.output || {};
    const outputPath = output.outputPath || defaultOutputPath(input, { ...output, container: output.container || "mp3" });
    const args = ["-y", "-hide_banner", "-progress", "pipe:1", "-nostats"];
    addCommonInputArgs(args, input, output);
    args.push("-vn", "-c:a", normalizeCodec(output.audioCodec || "libmp3lame"));
    if (output.audioBitrate) args.push("-b:a", String(output.audioBitrate));
    addOutputFormatArgs(args, output);
    args.push(outputPath);
    return { bin: bins.ffmpeg, args, outputPath, command: [bins.ffmpeg, ...args].map(quoteArg).join(" ") };
}

function buildSnapshotArgs(workflow = {}, bins = getFfmpegBins()) {
    const input = primaryInput(workflow);
    if (!input) throw new Error("缺少输入媒体");
    const output = workflow.output || {};
    const outputPath = output.outputPath || defaultOutputPath(input, { ...output, container: output.container || "image2" });
    const args = ["-y", "-hide_banner", "-progress", "pipe:1", "-nostats"];
    if (output.startTime) args.push("-ss", String(output.startTime));
    args.push("-i", input, "-frames:v", "1", "-q:v", String(output.quality || 2));
    args.push(outputPath);
    return { bin: bins.ffmpeg, args, outputPath, command: [bins.ffmpeg, ...args].map(quoteArg).join(" ") };
}

function buildConcatArgs(workflow = {}, bins = getFfmpegBins()) {
    const inputs = (workflow.inputs || []).map((item) => item.path || item.url).filter(Boolean);
    if (inputs.length < 2) throw new Error("合并视频至少需要 2 个输入文件");
    const output = workflow.output || {};
    const outputPath = output.outputPath || defaultOutputPath(inputs[0], { ...output, suffix: "-merged" });
    const args = ["-y", "-hide_banner", "-progress", "pipe:1", "-nostats"];
    inputs.forEach((input) => args.push("-i", input));
    const filter = inputs.map((_, index) => `[${index}:v:0][${index}:a:0]`).join("");
    args.push("-filter_complex", `${filter}concat=n=${inputs.length}:v=1:a=1[outv][outa]`, "-map", "[outv]", "-map", "[outa]");
    const videoCodec = normalizeCodec(output.videoCodec || "libx264");
    const audioCodec = normalizeCodec(output.audioCodec || "aac");
    args.push("-c:v", videoCodec, "-c:a", audioCodec);
    if (output.crf) args.push("-crf", String(output.crf));
    if (output.preset) args.push("-preset", String(output.preset));
    addOutputFormatArgs(args, output);
    args.push(outputPath);
    return { bin: bins.ffmpeg, args, outputPath, command: [bins.ffmpeg, ...args].map(quoteArg).join(" ") };
}

function buildWatermarkArgs(workflow = {}, bins = getFfmpegBins()) {
    const output = workflow.output || {};
    const operations = [...(workflow.operations || [])];
    if (output.watermarkText) {
        operations.push({
            type: "drawtext",
            params: {
                text: output.watermarkText,
                x: output.watermarkX || 24,
                y: output.watermarkY || 24,
                size: output.watermarkSize || 28,
                color: output.watermarkColor || "white",
            },
        });
    }
    return buildConvertArgs({ ...workflow, operations, output }, bins);
}

function buildSubtitleArgs(workflow = {}, bins = getFfmpegBins()) {
    const output = workflow.output || {};
    const operations = [...(workflow.operations || [])];
    if (output.subtitlePath && output.subtitleMode !== "copy") {
        operations.push({ type: "subtitles", params: { path: output.subtitlePath } });
    }
    if (output.subtitleMode === "copy") {
        return buildConvertArgs({ ...workflow, output: { ...output, subtitleCodec: "copy" } }, bins);
    }
    return buildConvertArgs({ ...workflow, operations, output }, bins);
}

function buildResizeRotateArgs(workflow = {}, bins = getFfmpegBins()) {
    const output = workflow.output || {};
    const operations = [...(workflow.operations || [])];
    if (output.rotate && Number(output.rotate) !== 0) {
        operations.push({ type: "rotate", params: { angle: Number(output.rotate) } });
    }
    return buildConvertArgs({ ...workflow, operations, output }, bins);
}

function buildRemoveAudioArgs(workflow = {}, bins = getFfmpegBins()) {
    const input = primaryInput(workflow);
    if (!input) throw new Error("缺少输入媒体");
    const output = workflow.output || {};
    const outputPath = output.outputPath || defaultOutputPath(input, output);
    const args = ["-y", "-hide_banner", "-progress", "pipe:1", "-nostats"];
    addCommonInputArgs(args, input, output);
    args.push("-an", "-c:v", normalizeCodec(output.videoCodec || "copy"));
    addOutputFormatArgs(args, output);
    args.push(outputPath);
    return { bin: bins.ffmpeg, args, outputPath, command: [bins.ffmpeg, ...args].map(quoteArg).join(" ") };
}

function buildGifArgs(workflow = {}, bins = getFfmpegBins()) {
    const input = primaryInput(workflow);
    if (!input) throw new Error("缺少输入媒体");
    const output = workflow.output || {};
    const outputPath = output.outputPath || defaultOutputPath(input, { ...output, container: "gif" });
    const fps = Number(output.fps || 12);
    const width = Number(output.width || 480);
    const args = ["-y", "-hide_banner", "-progress", "pipe:1", "-nostats"];
    addCommonInputArgs(args, input, output);
    args.push("-vf", `fps=${fps},scale=${width}:-1:flags=lanczos`, outputPath);
    return { bin: bins.ffmpeg, args, outputPath, command: [bins.ffmpeg, ...args].map(quoteArg).join(" ") };
}

function buildSpeedArgs(workflow = {}, bins = getFfmpegBins()) {
    const output = workflow.output || {};
    const speed = Math.max(0.25, Math.min(4, Number(output.speed || 1)));
    const audioTempo = Math.max(0.5, Math.min(2, speed));
    const operations = [...(workflow.operations || [])];
    const input = primaryInput(workflow);
    if (!input) throw new Error("缺少输入媒体");
    const outputPath = output.outputPath || defaultOutputPath(input, { ...output, suffix: `-${speed}x` });
    const args = ["-y", "-hide_banner", "-progress", "pipe:1", "-nostats"];
    addCommonInputArgs(args, input, output);
    args.push("-vf", `setpts=${1 / speed}*PTS`, "-af", `atempo=${audioTempo}`);
    args.push("-c:v", normalizeCodec(output.videoCodec || "libx264"), "-c:a", normalizeCodec(output.audioCodec || "aac"));
    if (output.crf) args.push("-crf", String(output.crf));
    if (output.preset) args.push("-preset", String(output.preset));
    addOutputFormatArgs(args, output);
    args.push(outputPath);
    return { bin: bins.ffmpeg, args, outputPath, operations, command: [bins.ffmpeg, ...args].map(quoteArg).join(" ") };
}

function buildFfmpegArgs(workflow = {}) {
    const bins = getFfmpegBins();
    const mode = workflow.mode || workflow.output?.mode || "convert";
    const builders = {
        convert: buildConvertArgs,
        transcode: buildConvertArgs,
        remux: (item, currentBins) => buildConvertArgs({ ...item, output: { ...item.output, videoCodec: "copy", audioCodec: "copy" } }, currentBins),
        compress: buildCompressArgs,
        trim: buildTrimArgs,
        "extract-audio": buildExtractAudioArgs,
        snapshot: buildSnapshotArgs,
        concat: buildConcatArgs,
        watermark: buildWatermarkArgs,
        subtitle: buildSubtitleArgs,
        "resize-rotate": buildResizeRotateArgs,
        "remove-audio": buildRemoveAudioArgs,
        gif: buildGifArgs,
        speed: buildSpeedArgs,
        batch: buildConvertArgs,
    };
    return (builders[mode] || buildConvertArgs)(workflow, bins);
}

function parseProgress(text, durationSeconds = 0) {
    const data = {};
    for (const line of text.split(/\r?\n/)) {
        const index = line.indexOf("=");
        if (index > 0) data[line.slice(0, index)] = line.slice(index + 1);
    }
    const outTimeMs = Number(data.out_time_ms || 0);
    const seconds = outTimeMs > 0 ? outTimeMs / 1000000 : 0;
    const percent = durationSeconds > 0 ? Math.min(99, Math.round((seconds / durationSeconds) * 100)) : 0;
    return { raw: data, seconds, percent };
}

async function createJob(workflow = {}) {
    const built = buildFfmpegArgs(workflow);
    const id = crypto.randomBytes(6).toString("hex");
    const job = {
        id,
        status: "queued",
        progress: 0,
        command: built.command,
        bin: built.bin,
        args: built.args,
        outputPath: built.outputPath,
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        process: null,
    };
    jobs.set(id, job);
    startJob(job, workflow.duration || workflow.output?.durationSeconds || 0);
    return publicJob(job);
}

function startJob(job, durationSeconds = 0) {
    job.status = "running";
    job.updatedAt = new Date().toISOString();
    const child = spawn(job.bin, job.args, { windowsHide: true });
    job.process = child;

    child.stdout?.on("data", (chunk) => {
        const text = chunk.toString();
        const progress = parseProgress(text, Number(durationSeconds));
        if (progress.percent) job.progress = progress.percent;
    });
    child.stderr?.on("data", (chunk) => {
        const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
        job.logs.push(...lines.slice(-20));
        if (job.logs.length > 300) job.logs = job.logs.slice(-300);
    });
    child.on("error", (error) => {
        job.status = "failed";
        job.error = error.message;
        job.updatedAt = new Date().toISOString();
    });
    child.on("close", (code) => {
        if (job.status === "canceled") return;
        job.status = code === 0 ? "success" : "failed";
        job.progress = code === 0 ? 100 : job.progress;
        job.exitCode = code;
        job.updatedAt = new Date().toISOString();
        job.process = null;
    });
}

function publicJob(job) {
    const { process: _process, ...rest } = job;
    return rest;
}

function listJobs() {
    return Array.from(jobs.values()).map(publicJob).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getJob(id) {
    const job = jobs.get(id);
    if (!job) throw Object.assign(new Error("任务不存在"), { statusCode: 404 });
    return publicJob(job);
}

function cancelJob(id) {
    const job = jobs.get(id);
    if (!job) throw Object.assign(new Error("任务不存在"), { statusCode: 404 });
    if (job.process && job.status === "running") {
        job.status = "canceled";
        job.updatedAt = new Date().toISOString();
        job.process.kill("SIGTERM");
    }
    return publicJob(job);
}

module.exports = {
    getCapabilities,
    probeMedia,
    createJob,
    listJobs,
    getJob,
    cancelJob,
    buildFfmpegArgs,
};
