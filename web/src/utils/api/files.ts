/**
 * 文件管理 API
 * 提供文件列表、读取、删除、重命名、复制、剪切、压缩、解压接口
 */
import {serverRequest} from "./requests";

/** 获取文件列表 */
export async function getFileList(path: string) {
    return await serverRequest("/files/list", "GET", {path})
}

/** 读取文件内容 */
export async function readFile(path: string, encoding: string = "utf-8") {
    return await serverRequest("/files/read", "GET", {path, encoding})
}

/** 删除文件 */
export async function deleteFile(path: string) {
    return await serverRequest("/files/delete", "DELETE", {path})
}

/** 批量重命名文件 */
export async function renameFile(dir_path: string, regex: string, new_name: string, only_file: boolean = true) {
    return await serverRequest("/files/rename", "PUT", {dir_path, regex, new_name, only_file})
}

/** 复制文件（小文件直接复制） */
export async function copyFile(source: string, target: string) {
    return await serverRequest("/files/copy", "POST", null, { source, target })
}

/** 初始化分块复制（大文件） */
export async function startChunkedCopy(source: string, target: string, chunkSize?: number) {
    return await serverRequest("/files/chunked-copy", "POST", null, { source, target, chunkSize })
}

/** 复制指定块 */
export async function copyChunk(taskId: string, chunkIndex: number) {
    return await serverRequest("/files/copy-chunk", "POST", null, { taskId, chunkIndex })
}

/** 查询分块复制进度 */
export async function getCopyProgress(taskId: string) {
    return await serverRequest("/files/copy-progress", "GET", { taskId })
}

/** 移动文件 */
export async function moveFile(source: string, target: string) {
    return await serverRequest("/files/move", "POST", null, { source, target })
}

/** 展开路径列表（递归目录） */
export async function expandPaths(paths: string[]) {
    return await serverRequest("/files/expand-paths", "POST", null, { paths })
}

/** 压缩文件 */
export async function compressFiles(files: string[], targetPath: string, format: string) {
    return await serverRequest("/files/compress", "POST", null, { files, targetPath, format })
}

/** 解压归档 */
export async function extractArchive(archivePath: string, targetDir: string) {
    return await serverRequest("/files/extract", "POST", null, { archivePath, targetDir })
}
