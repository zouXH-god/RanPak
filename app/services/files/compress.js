const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const archiver = require("archiver");
const extractZip = require("extract-zip");
const tar = require("tar");
const { execFile } = require("child_process");

function find7zBinary() {
    const candidates = [
        "7z",
        "C:\\Program Files\\7-Zip\\7z.exe",
        "C:\\Program Files (x86)\\7-Zip\\7z.exe",
    ];
    for (const bin of candidates) {
        try {
            require("child_process").execFileSync(bin, ["--help"], { stdio: "ignore" });
            return bin;
        } catch {}
    }
    return null;
}

let _7zPath = null;
function get7z() {
    if (_7zPath === null) _7zPath = find7zBinary() || "";
    if (!_7zPath) throw new Error("未找到 7z 程序，请安装 7-Zip 后重试");
    return _7zPath;
}

function execPromise(bin, args) {
    return new Promise((resolve, reject) => {
        execFile(bin, args, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) reject(new Error(stderr || error.message));
            else resolve(stdout);
        });
    });
}

async function compressFiles(filePaths, targetPath, format) {
    if (!filePaths || filePaths.length === 0) throw new Error("没有选择要压缩的文件");
    if (!targetPath) throw new Error("目标路径不能为空");

    const fmt = (format || "zip").toLowerCase();

    if (fmt === "zip") {
        return compressZip(filePaths, targetPath);
    } else if (fmt === "tar.gz" || fmt === "targz" || fmt === "tgz") {
        return compressTarGz(filePaths, targetPath);
    } else if (fmt === "7z") {
        return compress7z(filePaths, targetPath);
    } else {
        throw new Error(`不支持的压缩格式: ${fmt}`);
    }
}

async function compressZip(filePaths, targetPath) {
    const output = fs.createWriteStream(targetPath);
    const archive = archiver("zip", { zlib: { level: 6 } });

    const done = new Promise((resolve, reject) => {
        output.on("close", () => resolve(archive.pointer()));
        archive.on("error", reject);
    });

    archive.pipe(output);

    for (const filePath of filePaths) {
        const stat = await fsPromises.stat(filePath);
        const name = path.basename(filePath);
        if (stat.isDirectory()) {
            archive.directory(filePath, name);
        } else {
            archive.file(filePath, { name });
        }
    }

    await archive.finalize();
    const size = await done;
    return { targetPath, format: "zip", size };
}

async function compressTarGz(filePaths, targetPath) {
    const baseDir = path.dirname(filePaths[0]);
    const entries = filePaths.map((p) => path.relative(baseDir, p));

    await tar.create(
        { gzip: true, file: targetPath, cwd: baseDir },
        entries,
    );

    const stat = await fsPromises.stat(targetPath);
    return { targetPath, format: "tar.gz", size: stat.size };
}

async function compress7z(filePaths, targetPath) {
    const bin = get7z();
    const args = ["a", "-t7z", targetPath, ...filePaths];
    await execPromise(bin, args);
    const stat = await fsPromises.stat(targetPath);
    return { targetPath, format: "7z", size: stat.size };
}

async function extractArchive(archivePath, targetDir) {
    if (!archivePath) throw new Error("归档文件路径不能为空");
    if (!targetDir) throw new Error("目标目录不能为空");
    if (!fs.existsSync(archivePath)) throw new Error("归档文件不存在");

    await fsPromises.mkdir(targetDir, { recursive: true });

    const ext = path.extname(archivePath).toLowerCase();
    const name = path.basename(archivePath).toLowerCase();

    if (ext === ".zip") {
        await extractZip(archivePath, { dir: path.resolve(targetDir) });
        return { archivePath, targetDir, format: "zip" };
    } else if (name.endsWith(".tar.gz") || name.endsWith(".tgz")) {
        await tar.extract({ file: archivePath, cwd: targetDir });
        return { archivePath, targetDir, format: "tar.gz" };
    } else if (ext === ".7z" || ext === ".rar") {
        const bin = get7z();
        const args = ["x", archivePath, `-o${targetDir}`, "-y"];
        await execPromise(bin, args);
        return { archivePath, targetDir, format: ext.slice(1) };
    } else {
        const bin = get7z();
        const args = ["x", archivePath, `-o${targetDir}`, "-y"];
        await execPromise(bin, args);
        return { archivePath, targetDir, format: "auto" };
    }
}

module.exports = {
    compressFiles,
    extractArchive,
};
