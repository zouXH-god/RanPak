const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");

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

module.exports = {
    getFileList,
    readTextFile,
    deletePath,
    renameByRegex,
};
