/**
 * Electron 预加载脚本
 * 通过 contextBridge 安全地向渲染进程暴露有限的 API
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    apiBaseUrl: process.env.RAN_PAK_API_BASE_URL || 'http://127.0.0.1:8000/api',
    selectImageFiles: () => ipcRenderer.invoke('dialog:select-image-files'),
    selectVideoFiles: () => ipcRenderer.invoke('dialog:select-video-files'),
    selectAlarmSound: () => ipcRenderer.invoke('dialog:select-alarm-sound'),
    selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
    selectOutputDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
    selectFfmpegBinary: () => ipcRenderer.invoke('dialog:select-ffmpeg-binary'),
    selectFfprobeBinary: () => ipcRenderer.invoke('dialog:select-ffprobe-binary'),
    selectLive2dDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
    selectLive2dCatalogFile: () => ipcRenderer.invoke('dialog:select-live2d-catalog-file'),
    showItemInFolder: (filePath) => ipcRenderer.invoke('shell:show-item-in-folder', filePath),
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
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
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
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
