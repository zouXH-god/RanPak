/**
 * 文件管理 API
 * 提供文件列表、读取、删除和批量重命名接口
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
