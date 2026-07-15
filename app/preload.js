/**
 * Electron 预加载脚本
 * 通过 contextBridge 安全地向渲染进程暴露有限的 API
 */
const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    getPathForFile: (file) => webUtils.getPathForFile(file),
    apiBaseUrl: process.env.RAN_PAK_API_BASE_URL || 'http://127.0.0.1:8000/api',
    selectImageFiles: () => ipcRenderer.invoke('dialog:select-image-files'),
    selectVideoFiles: () => ipcRenderer.invoke('dialog:select-video-files'),
    selectSshPrivateKey: () => ipcRenderer.invoke('dialog:select-ssh-private-key'),
    selectSftpUploadFile: () => ipcRenderer.invoke('dialog:select-sftp-upload-file'),
    selectAlarmSound: () => ipcRenderer.invoke('dialog:select-alarm-sound'),
    selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
    selectOutputDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
    selectFfmpegBinary: () => ipcRenderer.invoke('dialog:select-ffmpeg-binary'),
    selectFfprobeBinary: () => ipcRenderer.invoke('dialog:select-ffprobe-binary'),
    selectLive2dDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
    selectLive2dCatalogFile: () => ipcRenderer.invoke('dialog:select-live2d-catalog-file'),
    selectMemeBinary: () => ipcRenderer.invoke('dialog:select-meme-binary'),
    copyImageToClipboard: (data) => ipcRenderer.invoke('clipboard:copy-image', data),
    showItemInFolder: (filePath) => ipcRenderer.invoke('shell:show-item-in-folder', filePath),
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
    openPath: (filePath) => ipcRenderer.invoke('shell:open-path', filePath),
    selectAnyFile: () => ipcRenderer.invoke('dialog:select-any-file'),
    alarmSoundDataUrl: (filePath) => ipcRenderer.invoke('alarm-sound:data-url', filePath),
    openReminderWindow: (payload) => ipcRenderer.invoke('reminder-window:open', payload),
    getReminderWindowPayload: () => ipcRenderer.invoke('reminder-window:get-payload'),
    sendReminderWindowAction: (action) => ipcRenderer.invoke('reminder-window:action', action),
    getTimeToolsConfig: () => ipcRenderer.invoke('time-tools:get-config'),
    updateTimeToolsConfig: (options) => ipcRenderer.invoke('time-tools:update-config', options),
    openTimerDisplayWindow: (payload) => ipcRenderer.invoke('timer-display:open', payload),
    updateTimerDisplayWindow: (payload) => ipcRenderer.invoke('timer-display:update', payload),
    closeTimerDisplayWindow: () => ipcRenderer.invoke('timer-display:close'),
    getTimerDisplayConfig: () => ipcRenderer.invoke('timer-display:get-config'),
    sendTimerDisplayEvent: (payload) => ipcRenderer.invoke('timer-display:event', payload),
    onTimerDisplayOptions: (callback) => {
        const listener = (_event, options) => callback(options)
        ipcRenderer.on('timer-display:options', listener)
        return () => ipcRenderer.removeListener('timer-display:options', listener)
    },
    onTimerDisplayEvent: (callback) => {
        const listener = (_event, payload) => callback(payload)
        ipcRenderer.on('timer-display:event', listener)
        return () => ipcRenderer.removeListener('timer-display:event', listener)
    },
    onReminderWindowPayload: (callback) => {
        const listener = (_event, payload) => callback(payload)
        ipcRenderer.on('reminder-window:payload', listener)
        return () => ipcRenderer.removeListener('reminder-window:payload', listener)
    },
    onReminderWindowAction: (callback) => {
        const listener = (_event, payload) => callback(payload)
        ipcRenderer.on('reminder-window:action', listener)
        return () => ipcRenderer.removeListener('reminder-window:action', listener)
    },
    openClockWindow: (options) => ipcRenderer.invoke('clock-window:open', options),
    updateClockWindow: (options) => ipcRenderer.invoke('clock-window:update', options),
    closeClockWindow: () => ipcRenderer.invoke('clock-window:close'),
    closeCurrentWindow: () => ipcRenderer.invoke('window:close-current'),
    getClockWindowConfig: () => ipcRenderer.invoke('clock-window:get-config'),
    setClockWindowLocked: (locked) => ipcRenderer.invoke('clock-window:set-locked', locked),
    onClockWindowOptions: (callback) => {
        const listener = (_event, options) => callback(options)
        ipcRenderer.on('clock-window:options', listener)
        return () => ipcRenderer.removeListener('clock-window:options', listener)
    },
    openLive2dWindow: (options) => ipcRenderer.invoke('live2d-window:open', options),
    updateLive2dWindow: (options) => ipcRenderer.invoke('live2d-window:update', options),
    closeLive2dWindow: () => ipcRenderer.invoke('live2d-window:close'),
    getLive2dWindowConfig: () => ipcRenderer.invoke('live2d-window:get-config'),
    setLive2dWindowLocked: (locked) => ipcRenderer.invoke('live2d-window:set-locked', locked),
    onLive2dWindowOptions: (callback) => {
        const listener = (_event, options) => callback(options)
        ipcRenderer.on('live2d-window:options', listener)
        return () => ipcRenderer.removeListener('live2d-window:options', listener)
    },
    openChildWindow: (options) => ipcRenderer.invoke('child-window:open', options),
    updateChildWindow: (options) => ipcRenderer.invoke('child-window:update', options),
    closeChildWindow: () => ipcRenderer.invoke('child-window:close'),
    getChildWindowConfig: () => ipcRenderer.invoke('child-window:get-config'),
    setChildWindowLocked: (locked) => ipcRenderer.invoke('child-window:set-locked', locked),
    onChildWindowOptions: (callback) => {
        const listener = (_event, options) => callback(options)
        ipcRenderer.on('child-window:options', listener)
        return () => ipcRenderer.removeListener('child-window:options', listener)
    },
    weather: {
        forecast: (params) => ipcRenderer.invoke('weather:forecast', params),
        geocode: (params) => ipcRenderer.invoke('weather:geocode', params),
    },
    devTools: {
        httpRequest: (payload) => ipcRenderer.invoke('dev-tools:http-request', payload),
        querySslCertificate: (payload) => ipcRenderer.invoke('dev-tools:ssl-certificate', payload),
        loadDevToolStore: () => ipcRenderer.invoke('dev-tools:load-store'),
        saveDevToolStore: (payload) => ipcRenderer.invoke('dev-tools:save-store', payload),
    },
    ssh: {
        listProfiles: () => ipcRenderer.invoke('ssh:list-profiles'),
        listFolders: () => ipcRenderer.invoke('ssh:list-folders'),
        saveFolder: (payload) => ipcRenderer.invoke('ssh:save-folder', payload),
        deleteFolder: (id) => ipcRenderer.invoke('ssh:delete-folder', id),
        moveNode: (payload) => ipcRenderer.invoke('ssh:move-node', payload),
        saveProfile: (payload) => ipcRenderer.invoke('ssh:save-profile', payload),
        importProfilesFromRemote: (payload) => ipcRenderer.invoke('ssh:import-profiles-remote', payload),
        importProfilesFromText: (payload) => ipcRenderer.invoke('ssh:import-profiles-text', payload),
        importProfilesFromFile: (folderId) => ipcRenderer.invoke('ssh:import-profiles-file', folderId || ''),
        listRemoteImportSources: () => ipcRenderer.invoke('ssh:remote-import-sources'),
        saveRemoteImportSource: (payload) => ipcRenderer.invoke('ssh:remote-import-source-save', payload),
        deleteRemoteImportSource: (id) => ipcRenderer.invoke('ssh:remote-import-source-delete', id),
        syncRemoteImportSource: (id) => ipcRenderer.invoke('ssh:remote-import-source-sync', id),
        deleteProfile: (id) => ipcRenderer.invoke('ssh:delete-profile', id),
        listPrivateKeys: () => ipcRenderer.invoke('ssh:list-private-keys'),
        savePrivateKey: (payload) => ipcRenderer.invoke('ssh:save-private-key', payload),
        deletePrivateKey: (id) => ipcRenderer.invoke('ssh:delete-private-key', id),
        readPrivateKeyFile: () => ipcRenderer.invoke('ssh:read-private-key-file'),
        listPresetCommands: () => ipcRenderer.invoke('ssh:list-preset-commands'),
        savePresetCommand: (payload) => ipcRenderer.invoke('ssh:save-preset-command', payload),
        deletePresetCommand: (id) => ipcRenderer.invoke('ssh:delete-preset-command', id),
        serverStats: (profileId) => ipcRenderer.invoke('ssh:server-stats', profileId),
        killProcess: (profileId, pid) => ipcRenderer.invoke('ssh:kill-process', profileId, pid),
        exec: (profileId, command) => ipcRenderer.invoke('ssh:exec', profileId, command),
        downloadDir: (payload) => ipcRenderer.invoke('ssh:download-dir', payload),
        readRemoteFile: (payload) => ipcRenderer.invoke('ssh:read-remote-file', payload),
        writeRemoteFile: (payload) => ipcRenderer.invoke('ssh:write-remote-file', payload),
        connect: (id) => ipcRenderer.invoke('ssh:connect', id),
        disconnect: (id) => ipcRenderer.invoke('ssh:disconnect', id),
        listDir: (payload) => ipcRenderer.invoke('ssh:list-dir', payload),
        upload: (payload) => ipcRenderer.invoke('ssh:upload', payload),
        download: (payload) => ipcRenderer.invoke('ssh:download', payload),
        downloadToTemp: (payload) => ipcRenderer.invoke('ssh:download-temp', payload),
        startDrag: (filePath) => ipcRenderer.invoke('ssh:start-drag', filePath),
        mkdir: (payload) => ipcRenderer.invoke('ssh:mkdir', payload),
        rename: (payload) => ipcRenderer.invoke('ssh:rename', payload),
        delete: (payload) => ipcRenderer.invoke('ssh:delete', payload),
        startTunnel: (payload) => ipcRenderer.invoke('ssh:tunnel-start', payload),
        stopTunnel: (id) => ipcRenderer.invoke('ssh:tunnel-stop', id),
        listSessions: () => ipcRenderer.invoke('ssh:list-sessions'),
        getHistory: () => ipcRenderer.invoke('ssh:get-history'),
        saveHistory: (data) => ipcRenderer.invoke('ssh:save-history', data),
        startShell: (payload) => ipcRenderer.invoke('ssh:shell-start', payload),
        writeShell: (payload) => ipcRenderer.invoke('ssh:shell-write', payload),
        resizeShell: (payload) => ipcRenderer.invoke('ssh:shell-resize', payload),
        stopShell: (payload) => ipcRenderer.invoke('ssh:shell-stop', payload),
        onShellData: (callback) => {
            const listener = (_event, payload) => callback(payload)
            ipcRenderer.on('ssh:shell-data', listener)
            return () => ipcRenderer.removeListener('ssh:shell-data', listener)
        },
        onTransferProgress: (callback) => {
            const listener = (_event, payload) => callback(payload)
            ipcRenderer.on('ssh:transfer-progress', listener)
            return () => ipcRenderer.removeListener('ssh:transfer-progress', listener)
        },
    },
    sshPlugins: {
        list: () => ipcRenderer.invoke('ssh-plugins:list'),
        load: (pluginId) => ipcRenderer.invoke('ssh-plugins:load', pluginId),
        setEnabled: (pluginId, enabled) => ipcRenderer.invoke('ssh-plugins:set-enabled', pluginId, enabled),
        setOrder: (orderedIds) => ipcRenderer.invoke('ssh-plugins:set-order', orderedIds),
        installFromUrl: (url) => ipcRenderer.invoke('ssh-plugins:install-url', url),
        installFromFile: () => ipcRenderer.invoke('ssh-plugins:install-file'),
        uninstall: (pluginId) => ipcRenderer.invoke('ssh-plugins:uninstall', pluginId),
        fetchRegistry: (registryUrl) => ipcRenderer.invoke('ssh-plugins:fetch-registry', registryUrl),
        listBundled: () => ipcRenderer.invoke('ssh-plugins:list-bundled'),
    },
    httpFetch: (url, options) => ipcRenderer.invoke('http:fetch', url, options),
    openTaskFlowWindow: (payload) => ipcRenderer.invoke('task-flow:open', payload),
    closeTaskFlowWindow: (sessionId) => ipcRenderer.invoke('task-flow:close', sessionId),
    getTaskFlowOptions: () => ipcRenderer.invoke('task-flow:get-options'),
    getTaskFlowConfig: () => ipcRenderer.invoke('task-flow:get-config'),
    updateTaskFlowConfig: (options) => ipcRenderer.invoke('task-flow:update-config', options),
    updateTaskFlowSession: (payload) => ipcRenderer.invoke('task-flow:update-session', payload),
    syncTaskFlowNodes: (payload) => ipcRenderer.invoke('task-flow:sync-nodes', payload),
    exportTaskFlow: (payload) => ipcRenderer.invoke('task-flow:export', payload),
    importTaskFlow: (payload) => ipcRenderer.invoke('task-flow:import', payload),
    onTaskFlowOptions: (callback) => {
        const listener = (_event, options) => callback(options)
        ipcRenderer.on('task-flow:options', listener)
        return () => ipcRenderer.removeListener('task-flow:options', listener)
    },
    sendTaskFlowEvent: (payload) => ipcRenderer.invoke('task-flow:event', payload),
    onTaskFlowEvent: (callback) => {
        const listener = (_event, payload) => callback(payload)
        ipcRenderer.on('task-flow:event', listener)
        return () => ipcRenderer.removeListener('task-flow:event', listener)
    },
    openImageViewer: (payload) => ipcRenderer.invoke('image-viewer:open', payload),
    getImageViewerData: () => ipcRenderer.invoke('image-viewer:get-data'),
    meme: {
        start: () => ipcRenderer.invoke('meme:start'),
        stop: () => ipcRenderer.invoke('meme:stop'),
        getStatus: () => ipcRenderer.invoke('meme:status'),
        download: () => ipcRenderer.invoke('meme:download'),
        downloadExternal: (url) => ipcRenderer.invoke('meme:download-external', url),
        getHome: () => ipcRenderer.invoke('meme:get-home'),
        uploadLocalImage: (filePath, port) => ipcRenderer.invoke('meme:upload-local-image', filePath, port),
        saveImageToPath: (imageUrl, savePath) => ipcRenderer.invoke('meme:save-image-to-path', imageUrl, savePath),
        onStatusChanged: (callback) => {
            const listener = (_event, payload) => callback(payload)
            ipcRenderer.on('meme:status-changed', listener)
            return () => ipcRenderer.removeListener('meme:status-changed', listener)
        },
    },
    getAutoLaunch: () => ipcRenderer.invoke('app:get-auto-launch'),
    setAutoLaunch: (enabled) => ipcRenderer.invoke('app:set-auto-launch', enabled),
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
    cloudSync: {
        getStatus: () => ipcRenderer.invoke('cloud-sync:get-status'),
        login: (payload) => ipcRenderer.invoke('cloud-sync:login', payload),
        register: (payload) => ipcRenderer.invoke('cloud-sync:register', payload),
        logout: () => ipcRenderer.invoke('cloud-sync:logout'),
        syncNow: () => ipcRenderer.invoke('cloud-sync:sync-now'),
        getConfig: () => ipcRenderer.invoke('cloud-sync:get-config'),
        getUsers: () => ipcRenderer.invoke('cloud-sync:get-users'),
        createUser: (data) => ipcRenderer.invoke('cloud-sync:create-user', data),
        updateUser: (data) => ipcRenderer.invoke('cloud-sync:update-user', data),
        deleteUser: (id) => ipcRenderer.invoke('cloud-sync:delete-user', id),
        approveUser: (id) => ipcRenderer.invoke('cloud-sync:approve-user', id),
        getServerSettings: () => ipcRenderer.invoke('cloud-sync:get-server-settings'),
        updateServerSettings: (data) => ipcRenderer.invoke('cloud-sync:update-server-settings', data),
        totpSetup: () => ipcRenderer.invoke('cloud-sync:totp-setup'),
        totpEnable: (data) => ipcRenderer.invoke('cloud-sync:totp-enable', data),
        totpDisable: (data) => ipcRenderer.invoke('cloud-sync:totp-disable', data),
        onDataUpdated: (callback) => {
            const listener = (_event, payload) => callback(payload)
            ipcRenderer.on('cloud-sync:data-updated', listener)
            return () => ipcRenderer.removeListener('cloud-sync:data-updated', listener)
        },
    },
    clicker: {
        getClickerState: () => ipcRenderer.invoke('clicker:get-state'),
        startClickRecording: () => ipcRenderer.invoke('clicker:start-recording'),
        stopClickRecording: () => ipcRenderer.invoke('clicker:stop-recording'),
        clearClickRecording: () => ipcRenderer.invoke('clicker:clear-recording'),
        deleteClickPoint: (index) => ipcRenderer.invoke('clicker:delete-point', index),
        startClickPlayback: (config) => ipcRenderer.invoke('clicker:start-playback', config),
        pauseClickPlayback: () => ipcRenderer.invoke('clicker:pause-playback'),
        resumeClickPlayback: () => ipcRenderer.invoke('clicker:resume-playback'),
        stopClickPlayback: () => ipcRenderer.invoke('clicker:stop-playback'),
        saveClickProfile: (profile) => ipcRenderer.invoke('clicker:save-profile', profile),
        loadClickProfiles: () => ipcRenderer.invoke('clicker:load-profiles'),
        deleteClickProfile: (id) => ipcRenderer.invoke('clicker:delete-profile', id),
        applyClickProfile: (profile) => ipcRenderer.invoke('clicker:apply-profile', profile),
        onClickerEvent: (callback) => {
            const listener = (_event, payload) => callback(payload)
            ipcRenderer.on('clicker:event', listener)
            return () => ipcRenderer.removeListener('clicker:event', listener)
        },
    },
})
