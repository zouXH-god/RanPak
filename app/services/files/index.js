const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const { pipeline } = require("stream/promises");

const CHUNK_SIZE_DEFAULT = 10 * 1024 * 1024; // 10MB
const BIG_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB

const chunkedTasks = new Map();

function generateTaskId() {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toFileInfo(filePath, stat) {
    return {
        name: path.basename(filePath),
        path: filePath,
        size: stat.size,
        is_dir: stat.isDirectory(),
        modified_at: stat.mtimeMs / 1000,
        created_at: stat.birthtimeMs / 1000,
    };
}

async function getDrives() {
    const drives = [];
    for (let code = 65; code <= 90; code += 1) {
        const drive = `${String.fromCharCode(code)}:/`;
        if (fsSync.existsSync(drive)) {
            drives.push({
                name: drive,
                path: drive,
                size: 0,
                is_dir: true,
                modified_at: 0,
                created_at: 0,
            });
        }
    }
    return drives;
}

async function getFileInfo(filePath) {
    try {
        const stat = await fs.stat(filePath);
        return toFileInfo(filePath, stat);
    } catch {
        return null;
    }
}

async function getFileList(inputPath) {
    const target = inputPath || os.homedir();
    if ((target === "/" || target === "\\") && process.platform === "win32") {
        return getDrives();
    }

    const stat = await fs.stat(target).catch(() => null);
    if (!stat) return [];
    if (!stat.isDirectory()) {
        const info = await getFileInfo(target);
        return info ? [info] : [];
    }

    const names = await fs.readdir(target);
    const infos = await Promise.all(names.map((name) => getFileInfo(path.join(target, name))));
    return infos.filter(Boolean);
}

async function readTextFile(filePath, encoding = "utf-8") {
    return fs.readFile(filePath, { encoding });
}

async function deletePath(filePath) {
    if (!fsSync.existsSync(filePath)) return false;
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
    } else {
        await fs.unlink(filePath);
    }
    return true;
}

async function renameByRegex(dirPath, regexSource, newName, onlyFile = true) {
    if (!fsSync.existsSync(dirPath)) return 0;

    const regex = new RegExp(regexSource);
    const names = await fs.readdir(dirPath);
    let seq = 0;
    let renamed = 0;

    for (const name of names) {
        const oldPath = path.join(dirPath, name);
        const stat = await fs.stat(oldPath).catch(() => null);
        if (!stat) continue;
        if (onlyFile && !stat.isFile()) continue;
        if (!regex.test(name)) continue;

        seq += 1;
        regex.lastIndex = 0;
        const nextName = name.replace(regex, newName).replaceAll("$i", String(seq));
        const nextPath = path.join(dirPath, nextName);
        if (fsSync.existsSync(nextPath)) continue;

        await fs.rename(oldPath, nextPath);
        renamed += 1;
    }

    return renamed;
}

async function copyFile(source, target) {
    if (!source || !target) throw new Error("源路径和目标路径不能为空");
    if (!fsSync.existsSync(source)) throw new Error("源文件不存在");
    const stat = await fs.stat(source);
    if (stat.isDirectory()) throw new Error("不支持直接复制目录，请逐文件复制");
    await fs.copyFile(source, target);
    return { source, target, size: stat.size };
}

async function startChunkedCopy(source, target, chunkSize) {
    if (!source || !target) throw new Error("源路径和目标路径不能为空");
    if (!fsSync.existsSync(source)) throw new Error("源文件不存在");
    const stat = await fs.stat(source);
    if (stat.isDirectory()) throw new Error("不支持对目录进行分块复制");

    const size = stat.size;
    const chunk = chunkSize || CHUNK_SIZE_DEFAULT;
    const totalChunks = Math.ceil(size / chunk);
    const taskId = generateTaskId();

    // Pre-allocate target file
    const fd = await fs.open(target, "w");
    await fd.truncate(size);
    await fd.close();

    const task = {
        taskId,
        source,
        target,
        totalSize: size,
        chunkSize: chunk,
        totalChunks,
        completedChunks: 0,
        status: "running",
    };
    chunkedTasks.set(taskId, task);
    return { taskId, totalChunks, chunkSize: chunk, totalSize: size };
}

async function copyChunk(taskId, chunkIndex) {
    const task = chunkedTasks.get(taskId);
    if (!task) throw new Error("任务不存在或已过期");
    if (task.status === "done") throw new Error("任务已完成");

    const start = chunkIndex * task.chunkSize;
    const end = Math.min(start + task.chunkSize, task.totalSize);
    const length = end - start;

    const readStream = fsSync.createReadStream(task.source, { start, end: end - 1 });
    const writeStream = fsSync.createWriteStream(task.target, { flags: "r+", start });

    await pipeline(readStream, writeStream);

    task.completedChunks = Math.max(task.completedChunks, chunkIndex + 1);
    const done = task.completedChunks >= task.totalChunks;
    if (done) task.status = "done";

    return { chunkIndex, written: length, done, completedChunks: task.completedChunks, totalChunks: task.totalChunks };
}

function getCopyProgress(taskId) {
    const task = chunkedTasks.get(taskId);
    if (!task) throw new Error("任务不存在或已过期");
    return {
        taskId: task.taskId,
        status: task.status,
        totalSize: task.totalSize,
        chunkSize: task.chunkSize,
        totalChunks: task.totalChunks,
        completedChunks: task.completedChunks,
        transferred: task.completedChunks * task.chunkSize,
    };
}

async function moveFile(source, target) {
    if (!source || !target) throw new Error("源路径和目标路径不能为空");
    if (!fsSync.existsSync(source)) throw new Error("源文件不存在");

    try {
        await fs.rename(source, target);
        return { source, target, method: "rename" };
    } catch (err) {
        if (err.code === "EXDEV") {
            const stat = await fs.stat(source);
            if (stat.size > BIG_FILE_THRESHOLD) {
                return { needChunked: true, size: stat.size };
            }
            await fs.copyFile(source, target);
            await fs.unlink(source);
            return { source, target, method: "copy-delete" };
        }
        throw err;
    }
}

async function listDirRecursive(dirPath) {
    const results = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            const subFiles = await listDirRecursive(fullPath);
            results.push(...subFiles);
        } else {
            const stat = await fs.stat(fullPath);
            results.push({ path: fullPath, name: entry.name, size: stat.size, is_dir: false });
        }
    }
    return results;
}

async function expandPaths(paths) {
    const results = [];
    for (const p of paths) {
        const stat = await fs.stat(p).catch(() => null);
        if (!stat) continue;
        if (stat.isDirectory()) {
            const subFiles = await listDirRecursive(p);
            results.push(...subFiles.map((f) => ({
                ...f,
                relativePath: path.relative(path.dirname(p), f.path),
            })));
        } else {
            results.push({
                path: p,
                name: path.basename(p),
                size: stat.size,
                is_dir: false,
                relativePath: path.basename(p),
            });
        }
    }
    return results;
}

module.exports = {
    getFileList,
    readTextFile,
    deletePath,
    renameByRegex,
    copyFile,
    startChunkedCopy,
    copyChunk,
    getCopyProgress,
    moveFile,
    listDirRecursive,
    expandPaths,
};
