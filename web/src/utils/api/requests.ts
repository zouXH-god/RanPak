/**
 * HTTP 请求封装模块
 * 提供统一的 API 请求方法，支持鉴权 Token、查询参数和请求体
 */

declare global {
    interface Window {
        electronAPI?: {
            platform?: string
            apiBaseUrl?: string
            selectVideoFiles?: () => Promise<string[]>
            selectImageFiles?: () => Promise<string[]>
            selectSshPrivateKey?: () => Promise<string>
            selectSftpUploadFile?: () => Promise<string>
            selectAlarmSound?: () => Promise<string>
            selectDirectory?: () => Promise<string>
            selectOutputDirectory?: () => Promise<string>
            selectFfmpegBinary?: () => Promise<string>
            selectFfprobeBinary?: () => Promise<string>
            selectLive2dDirectory?: () => Promise<string>
            selectLive2dCatalogFile?: () => Promise<string>
            showItemInFolder?: (filePath: string) => Promise<boolean>
            alarmSoundDataUrl?: (filePath: string) => Promise<string>
            openReminderWindow?: (payload: any) => Promise<boolean>
            getReminderWindowPayload?: () => Promise<any>
            sendReminderWindowAction?: (action: any) => Promise<boolean>
            getTimeToolsConfig?: () => Promise<any>
            updateTimeToolsConfig?: (options: any) => Promise<any>
            openTimerDisplayWindow?: (payload: any) => Promise<boolean>
            updateTimerDisplayWindow?: (payload: any) => Promise<boolean>
            closeTimerDisplayWindow?: () => Promise<boolean>
            getTimerDisplayConfig?: () => Promise<any>
            onTimerDisplayOptions?: (callback: (options: any) => void) => () => void
            onReminderWindowPayload?: (callback: (payload: any) => void) => () => void
            onReminderWindowAction?: (callback: (payload: any) => void) => () => void
            openClockWindow?: (options: any) => Promise<boolean>
            updateClockWindow?: (options: any) => Promise<boolean>
            closeClockWindow?: () => Promise<boolean>
            closeCurrentWindow?: () => Promise<boolean>
            getClockWindowConfig?: () => Promise<any>
            setClockWindowLocked?: (locked: boolean) => Promise<boolean>
            onClockWindowOptions?: (callback: (options: any) => void) => () => void
            openLive2dWindow?: (options: any) => Promise<boolean>
            updateLive2dWindow?: (options: any) => Promise<boolean>
            closeLive2dWindow?: () => Promise<boolean>
            getLive2dWindowConfig?: () => Promise<any>
            setLive2dWindowLocked?: (locked: boolean) => Promise<boolean>
            onLive2dWindowOptions?: (callback: (options: any) => void) => () => void
            openChildWindow?: (options: any) => Promise<boolean>
            updateChildWindow?: (options: any) => Promise<boolean>
            closeChildWindow?: () => Promise<boolean>
            getChildWindowConfig?: () => Promise<any>
            setChildWindowLocked?: (locked: boolean) => Promise<boolean>
            onChildWindowOptions?: (callback: (options: any) => void) => () => void
            clicker?: {
                getClickerState?: () => Promise<any>
                startClickRecording?: () => Promise<any>
                stopClickRecording?: () => Promise<any>
                clearClickRecording?: () => Promise<any>
                deleteClickPoint?: (index: number) => Promise<any>
                startClickPlayback?: (config: any) => Promise<any>
                pauseClickPlayback?: () => Promise<any>
                resumeClickPlayback?: () => Promise<any>
                stopClickPlayback?: () => Promise<any>
                saveClickProfile?: (profile: any) => Promise<any>
                loadClickProfiles?: () => Promise<any[]>
                deleteClickProfile?: (id: string) => Promise<any[]>
                applyClickProfile?: (profile: any) => Promise<any>
                onClickerEvent?: (callback: (payload: any) => void) => () => void
            }
            devTools?: {
                httpRequest?: (payload: any) => Promise<any>
                querySslCertificate?: (payload: any) => Promise<any>
                loadDevToolStore?: () => Promise<any>
                saveDevToolStore?: (payload: any) => Promise<any>
            }
            ssh?: {
                listProfiles?: () => Promise<any>
                listFolders?: () => Promise<any>
                saveFolder?: (payload: any) => Promise<any>
                deleteFolder?: (id: string) => Promise<any>
                saveProfile?: (payload: any) => Promise<any>
                deleteProfile?: (id: string) => Promise<any>
                connect?: (id: string) => Promise<any>
                disconnect?: (id: string) => Promise<any>
                listDir?: (payload: any) => Promise<any>
                upload?: (payload: any) => Promise<any>
                download?: (payload: any) => Promise<any>
                mkdir?: (payload: any) => Promise<any>
                rename?: (payload: any) => Promise<any>
                delete?: (payload: any) => Promise<any>
                startTunnel?: (payload: any) => Promise<any>
                stopTunnel?: (id: string) => Promise<any>
                listSessions?: () => Promise<any>
                startShell?: (payload: any) => Promise<any>
                writeShell?: (payload: any) => Promise<any>
                resizeShell?: (payload: any) => Promise<any>
                stopShell?: (payload: any) => Promise<any>
                onShellData?: (callback: (payload: any) => void) => () => void
            }
            }
    }
}

export const baseUrl =
    window.electronAPI?.apiBaseUrl ||
    import.meta.env.VITE_API_BASE ||
    "http://127.0.0.1:8000/api";

/** API 鉴权 Token，应用启动时自动从后端获取 */
let apiToken: string = ""

/** 设置 API 鉴权 Token */
export function setApiToken(token: string) {
    apiToken = token
}

/** 获取当前 API 鉴权 Token */
export function getApiToken(): string {
    return apiToken
}

/** 从后端获取并设置鉴权 Token */
export async function fetchApiToken(): Promise<boolean> {
    try {
        const res = await fetch(baseUrl + "/auth/token")
        const data = await res.json()
        if (data.code === 200 && data.data) {
            apiToken = data.data
            return true
        }
        return false
    } catch {
        console.error("获取 API Token 失败，后端服务可能未启动")
        return false
    }
}

export async function request(
    url: string,
    options: RequestInit = {},
    onSuccess: (data: any) => void = () => {},
    onError: (error: any) => void = () => {}
) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorText}`);
        }
        const result = await response.json();
        onSuccess(result);
        return result;
    } catch (error) {
        onError(error);
        console.error('请求错误：', error);
        return null;
    }
}

/**
 * 后端 API 请求封装
 * @param path - 接口路径
 * @param method - HTTP 方法
 * @param query - 查询参数对象（拼接到 URL）
 * @param body - 请求体对象（仅 POST/PUT 有效）
 * @param options - 额外的 fetch 配置
 * @param onSuccess - 成功回调
 * @param onError - 错误回调
 */
export async function serverRequest(
    path: string,
    method: string = "GET",
    query: any = null,
    body: any = null,
    options: RequestInit = {},
    onSuccess: (data: any) => void = () => {},
    onError: (error: any) => void = () => {}
) {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    }
    if (apiToken) {
        headers["Authorization"] = `Bearer ${apiToken}`
    }

    options = {
        method: method,
        headers: headers,
        ...options,
    }

    // POST/PUT 携带请求体
    if (body != null && method !== "GET" && method !== "DELETE") {
        (options as any).body = JSON.stringify(body)
    }

    // 拼接查询参数
    if (query) {
        const queryString = new URLSearchParams(query).toString();
        path += `?${queryString}`;
    }

    return request(baseUrl + path, options, onSuccess, onError);
}
