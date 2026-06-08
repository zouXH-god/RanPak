/**
 * 图片编辑 API 层
 * 负责与后端 /api/image/* 接口通信
 */
import { baseUrl, serverRequest, getApiToken } from "./requests"
import { downloadExtensionForFormat } from "../../components/image/config/exportFormats.js"

/** 上传图片，返回 { image_id, width, height, format, size } */
export async function uploadImage(file: File) {
    const formData = new FormData()
    formData.append("file", file)

    try {
        const res = await fetch(baseUrl + "/image/upload", {
            method: "POST",
            body: formData,
            headers: {
                "Authorization": `Bearer ${getApiToken()}`
            }
        })
        return await res.json()
    } catch (e) {
        console.error("上传图片失败:", e)
        return null
    }
}

/**
 * 拼接已上传图片的 API 地址（注意：浏览器 img / Fabric.fromURL 无法附带 Bearer，
 * 画布展示请使用 {@link fetchUploadedImageAsObjectUrl}）
 */
export function getImageUrl(imageId: string): string {
    return `${baseUrl}/image/file/${imageId}`
}

/**
 * 使用鉴权请求拉取已上传图片并生成 blob: URL，供 Fabric.js / Canvas 使用
 * @param imageId - 上传接口返回的 image_id
 * @returns 成功为 object URL，失败为 null（多为 401 或未登录 token）
 */
export async function fetchUploadedImageAsObjectUrl(imageId: string): Promise<string | null> {
    try {
        const res = await fetch(`${baseUrl}/image/file/${imageId}`, {
            headers: { Authorization: `Bearer ${getApiToken()}` },
        })
        if (!res.ok) return null
        const blob = await res.blob()
        return URL.createObjectURL(blob)
    } catch (e) {
        console.error("拉取已上传图片失败:", e)
        return null
    }
}

/**
 * 释放通过 createObjectURL 生成的预览地址，避免内存泄漏
 * @param url - 可能为 blob: 或普通 http(s): 地址
 */
export function revokePreviewObjectUrl(url: string | null | undefined): void {
    if (url && url.startsWith("blob:")) {
        URL.revokeObjectURL(url)
    }
}

/** 发送工作流获取预览图（返回 blob URL） */
export async function previewWorkflow(imageId: string, steps: any[]): Promise<string | null> {
    try {
        const res = await fetch(baseUrl + "/image/preview", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getApiToken()}`
            },
            body: JSON.stringify({
                image_id: imageId,
                steps: steps,
            })
        })

        if (!res.ok) return null

        const contentType = res.headers.get("content-type") || ""
        if (contentType.startsWith("image/")) {
            const blob = await res.blob()
            return URL.createObjectURL(blob)
        }
        return null
    } catch (e) {
        console.error("预览失败:", e)
        return null
    }
}

/** 处理并下载图片 */
export async function processAndDownload(
    imageId: string,
    steps: any[],
    outputFormat: string = "PNG",
    quality: number = 95
) {
    try {
        const res = await fetch(baseUrl + "/image/process", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getApiToken()}`
            },
            body: JSON.stringify({
                image_id: imageId,
                steps: steps,
                output_format: outputFormat,
                quality: quality,
            })
        })

        if (!res.ok) return false

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `edited.${downloadExtensionForFormat(outputFormat)}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        return true
    } catch (e) {
        console.error("导出失败:", e)
        return false
    }
}

/** 批量处理 */
export async function batchProcess(
    filePaths: string[],
    steps: any[],
    outputDir: string = "",
    outputFormat: string = "PNG",
    quality: number = 95
) {
    return serverRequest(
        "/image/batch",
        "POST",
        null,
        {
            file_paths: filePaths,
            steps: steps,
            output_dir: outputDir,
            output_format: outputFormat,
            quality: quality,
        }
    )
}

/** 处理图片并返回 blob，供独立工具自定义文件名下载 */
export async function processImageBlob(
    imageId: string,
    steps: any[],
    outputFormat: string = "PNG",
    quality: number = 95
): Promise<Blob | null> {
    try {
        const res = await fetch(baseUrl + "/image/process", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getApiToken()}`
            },
            body: JSON.stringify({
                image_id: imageId,
                steps: steps,
                output_format: outputFormat,
                quality: quality,
            })
        })

        if (!res.ok) return null
        return await res.blob()
    } catch (e) {
        console.error("处理图片失败:", e)
        return null
    }
}

/** 上传文件并批量处理，用于非 Electron 原生路径选择环境 */
export async function batchProcessFiles(
    files: File[],
    steps: any[],
    outputDir: string = "",
    outputFormat: string = "PNG",
    quality: number = 95
) {
    const formData = new FormData()
    files.forEach(file => formData.append("files", file))
    formData.append("steps", JSON.stringify(steps))
    formData.append("output_dir", outputDir)
    formData.append("output_format", outputFormat)
    formData.append("quality", String(quality))

    try {
        const res = await fetch(baseUrl + "/image/batch-upload", {
            method: "POST",
            body: formData,
            headers: {
                "Authorization": `Bearer ${getApiToken()}`
            }
        })
        return await res.json()
    } catch (e) {
        console.error("批量上传处理失败:", e)
        return null
    }
}

/** 获取贴纸列表 */
export async function fetchStickers() {
    return serverRequest("/image/stickers")
}
