import { serverRequest } from "./requests"

export async function fetchToolsConfig() {
    return serverRequest("/tools/config")
}

export async function updateToolsConfig(config: any) {
    return serverRequest("/tools/config", "PUT", null, config)
}

export async function testFfmpegConfig(config: any) {
    return serverRequest("/tools/ffmpeg/test", "POST", null, config)
}

export async function fetchLive2dCatalog() {
    return serverRequest("/live2d/catalog")
}

export async function testLive2dCatalog(config: any) {
    return serverRequest("/live2d/catalog/test", "POST", null, config)
}
