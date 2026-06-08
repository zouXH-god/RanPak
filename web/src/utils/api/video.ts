import { baseUrl, getApiToken, serverRequest } from "./requests"

export async function fetchVideoCapabilities() {
    return serverRequest("/video/capabilities")
}

export async function probeVideo(path: string) {
    return serverRequest("/video/probe", "POST", null, { path })
}

export async function createVideoJob(workflow: any) {
    return serverRequest("/video/jobs", "POST", null, workflow)
}

export async function fetchVideoJobs() {
    return serverRequest("/video/jobs")
}

export async function fetchVideoJob(id: string) {
    return serverRequest(`/video/jobs/${id}`)
}

export async function cancelVideoJob(id: string) {
    return serverRequest(`/video/jobs/${id}/cancel`, "POST")
}

export async function fetchVideoBlob(path: string): Promise<Blob | null> {
    try {
        const res = await fetch(`${baseUrl}/video/media?path=${encodeURIComponent(path)}`, {
            headers: { Authorization: `Bearer ${getApiToken()}` },
        })
        if (!res.ok) return null
        return await res.blob()
    } catch {
        return null
    }
}
