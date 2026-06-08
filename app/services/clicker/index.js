const { EventEmitter } = require("events");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const DEFAULT_PLAYBACK_CONFIG = {
    mode: "fixed",
    intervalMs: 100,
    loopCount: 1,
    infinite: false,
    startDelayMs: 3000,
    buttonMode: "recorded",
    button: "left",
    downMs: 30,
    minRecordedIntervalMs: 20,
    maxRecordedIntervalMs: 60000,
};

const BUTTONS = new Set(["left", "right", "middle"]);

function nowId(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
}

class ClickerRuntime extends EventEmitter {
    constructor(options = {}) {
        super();
        this.userDataPath = options.userDataPath;
        this.sourceAgentPath = path.join(__dirname, "click-agent.ps1");
        this.agentPath = path.join(this.userDataPath, "helpers", "click-agent.ps1");
        this.profilePath = path.join(this.userDataPath, "config", "clicker-profiles.json");
        this.agent = null;
        this.agentBuffer = "";
        this.recording = false;
        this.playing = false;
        this.paused = false;
        this.points = [];
        this.error = "";
        this.playback = null;
        this.pendingClicks = new Map();
    }

    getState() {
        return {
            supported: process.platform === "win32",
            recording: this.recording,
            playing: this.playing,
            paused: this.paused,
            points: this.points,
            error: this.error,
            playback: this.playback ? {
                mode: this.playback.config.mode,
                loopIndex: this.playback.loopIndex,
                pointIndex: this.playback.pointIndex,
                totalLoops: Number.isFinite(this.playback.totalLoops) ? this.playback.totalLoops : null,
                startedAt: this.playback.startedAt,
            } : null,
        };
    }

    async startRecording() {
        this.assertSupported();
        await this.ensureAgent();
        if (this.playing) throw new Error("播放中不能开始录制");
        this.recording = true;
        this.error = "";
        this.emitState("recording-started");
        return this.getState();
    }

    stopRecording() {
        this.recording = false;
        this.emitState("recording-stopped");
        return this.getState();
    }

    clearRecording() {
        if (this.playing) throw new Error("播放中不能清空点位");
        this.points = [];
        this.emitState("points-cleared");
        return this.getState();
    }

    deletePoint(index) {
        if (this.playing) throw new Error("播放中不能删除点位");
        const safeIndex = Number(index);
        if (Number.isInteger(safeIndex) && safeIndex >= 0 && safeIndex < this.points.length) {
            this.points.splice(safeIndex, 1);
            this.recalculateIntervals();
            this.emitState("point-deleted");
        }
        return this.getState();
    }

    async startPlayback(config = {}) {
        this.assertSupported();
        await this.ensureAgent();
        if (this.playing) throw new Error("已有播放任务正在运行");
        if (!this.points.length) throw new Error("没有可播放的点击点位");
        this.recording = false;
        const playbackConfig = this.normalizePlaybackConfig(config);
        const totalLoops = playbackConfig.infinite ? Infinity : playbackConfig.loopCount;
        this.playing = true;
        this.paused = false;
        this.playback = {
            config: playbackConfig,
            loopIndex: 0,
            pointIndex: 0,
            totalLoops,
            startedAt: Date.now(),
            timer: null,
            waitingClickId: "",
        };
        this.emitState("playback-started");
        this.scheduleNext(playbackConfig.startDelayMs, "playback-countdown");
        return this.getState();
    }

    pausePlayback() {
        if (!this.playing || this.paused) return this.getState();
        this.paused = true;
        if (this.playback?.timer) {
            clearTimeout(this.playback.timer);
            this.playback.timer = null;
        }
        this.emitState("playback-paused");
        return this.getState();
    }

    resumePlayback() {
        if (!this.playing || !this.paused) return this.getState();
        this.paused = false;
        this.emitState("playback-resumed");
        this.scheduleNext(0);
        return this.getState();
    }

    stopPlayback(reason = "playback-stopped") {
        if (this.playback?.timer) clearTimeout(this.playback.timer);
        this.playing = false;
        this.paused = false;
        this.playback = null;
        this.pendingClicks.clear();
        this.emitState(reason);
        return this.getState();
    }

    async saveProfile(profile = {}) {
        const profiles = await this.loadProfiles();
        const id = profile.id || nowId("profile");
        const next = {
            id,
            name: String(profile.name || "未命名方案").trim() || "未命名方案",
            points: Array.isArray(profile.points) ? profile.points : this.points,
            config: this.normalizePlaybackConfig(profile.config || {}),
            updatedAt: new Date().toISOString(),
        };
        const index = profiles.findIndex((item) => item.id === id);
        if (index >= 0) profiles.splice(index, 1, next);
        else profiles.unshift(next);
        await fs.promises.mkdir(path.dirname(this.profilePath), { recursive: true });
        await fs.promises.writeFile(this.profilePath, JSON.stringify(profiles, null, 2), "utf-8");
        this.emit("event", { type: "profiles-updated", profiles });
        return next;
    }

    async loadProfiles() {
        try {
            const raw = await fs.promises.readFile(this.profilePath, "utf-8");
            const profiles = JSON.parse(raw);
            return Array.isArray(profiles) ? profiles : [];
        } catch {
            return [];
        }
    }

    async deleteProfile(id) {
        const profiles = (await this.loadProfiles()).filter((item) => item.id !== id);
        await fs.promises.mkdir(path.dirname(this.profilePath), { recursive: true });
        await fs.promises.writeFile(this.profilePath, JSON.stringify(profiles, null, 2), "utf-8");
        this.emit("event", { type: "profiles-updated", profiles });
        return profiles;
    }

    applyProfile(profile = {}) {
        if (this.playing) throw new Error("播放中不能加载方案");
        this.points = this.normalizePoints(profile.points || []);
        this.emitState("profile-applied");
        return this.getState();
    }

    handleHotkey(key) {
        if (key === "Escape") {
            if (this.playing) this.stopPlayback("playback-emergency-stopped");
            if (this.recording) this.stopRecording();
            return;
        }
        if (key === "F8") {
            if (this.playing) {
                if (this.paused) this.resumePlayback();
                else this.pausePlayback();
            }
        }
    }

    async ensureAgent() {
        if (this.agent && !this.agent.killed) return;
        await fs.promises.mkdir(path.dirname(this.agentPath), { recursive: true });
        await fs.promises.copyFile(this.sourceAgentPath, this.agentPath);
        this.agent = spawn("powershell.exe", [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            this.agentPath,
        ], {
            windowsHide: true,
            stdio: ["pipe", "pipe", "pipe"],
        });
        this.agent.stdout.setEncoding("utf-8");
        this.agent.stderr.setEncoding("utf-8");
        this.agent.stdout.on("data", (chunk) => this.handleAgentOutput(chunk));
        this.agent.stderr.on("data", (chunk) => {
            const message = String(chunk || "").trim();
            if (message) this.setError(message);
        });
        this.agent.on("exit", (code) => {
            this.agent = null;
            this.agentBuffer = "";
            if (this.playing) this.stopPlayback("helper-exited");
            this.recording = false;
            if (code !== 0 && code !== null) this.setError(`点击 helper 已退出，代码 ${code}`);
            this.emitState("helper-exited");
        });
        this.agent.on("error", (error) => {
            this.agent = null;
            this.setError(error.message || "点击 helper 启动失败");
            this.emitState("helper-error");
        });
    }

    handleAgentOutput(chunk) {
        this.agentBuffer += chunk;
        const lines = this.agentBuffer.split(/\r?\n/);
        this.agentBuffer = lines.pop() || "";
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const event = JSON.parse(line);
                this.handleAgentEvent(event);
            } catch {
                this.setError(`无法解析点击 helper 输出: ${line.slice(0, 120)}`);
            }
        }
    }

    handleAgentEvent(event) {
        if (event.type === "ready") {
            this.emit("event", { type: "helper-ready" });
            return;
        }
        if (event.type === "error") {
            this.setError(event.message || "点击 helper 错误");
            return;
        }
        if (event.type === "hotkey") {
            this.emit("event", event);
            this.handleHotkey(event.key);
            return;
        }
        if (event.type === "mouseDown") {
            if (this.recording && !this.playing) {
                this.points.push(this.normalizePoint(event));
                this.recalculateIntervals();
                this.emitState("point-recorded");
            }
            return;
        }
        if (event.type === "clickDone" && event.id) {
            const done = this.pendingClicks.get(event.id);
            if (done) {
                this.pendingClicks.delete(event.id);
                done();
            }
        }
    }

    normalizePoint(event) {
        return {
            id: nowId("point"),
            x: Math.round(Number(event.x) || 0),
            y: Math.round(Number(event.y) || 0),
            button: BUTTONS.has(event.button) ? event.button : "left",
            recordedAt: Date.now(),
            sourceTime: Number(event.time) || 0,
            delayFromPreviousMs: 0,
        };
    }

    normalizePoints(points) {
        return points.map((point) => ({
            id: point.id || nowId("point"),
            x: Math.round(Number(point.x) || 0),
            y: Math.round(Number(point.y) || 0),
            button: BUTTONS.has(point.button) ? point.button : "left",
            recordedAt: Number(point.recordedAt) || Date.now(),
            sourceTime: Number(point.sourceTime) || 0,
            delayFromPreviousMs: Math.max(0, Number(point.delayFromPreviousMs) || 0),
        }));
    }

    recalculateIntervals() {
        this.points = this.points.map((point, index, list) => ({
            ...point,
            delayFromPreviousMs: index === 0 ? 0 : Math.max(0, (point.recordedAt || 0) - (list[index - 1].recordedAt || 0)),
        }));
    }

    normalizePlaybackConfig(config = {}) {
        const next = { ...DEFAULT_PLAYBACK_CONFIG, ...config };
        next.mode = next.mode === "recorded" ? "recorded" : "fixed";
        next.intervalMs = clampNumber(next.intervalMs, 10, 60000, DEFAULT_PLAYBACK_CONFIG.intervalMs);
        next.loopCount = clampNumber(next.loopCount, 1, 100000, DEFAULT_PLAYBACK_CONFIG.loopCount);
        next.infinite = Boolean(next.infinite);
        next.startDelayMs = clampNumber(next.startDelayMs, 0, 60000, DEFAULT_PLAYBACK_CONFIG.startDelayMs);
        next.buttonMode = next.buttonMode === "override" ? "override" : "recorded";
        next.button = BUTTONS.has(next.button) ? next.button : "left";
        next.downMs = clampNumber(next.downMs, 0, 5000, DEFAULT_PLAYBACK_CONFIG.downMs);
        next.minRecordedIntervalMs = clampNumber(next.minRecordedIntervalMs, 0, 60000, DEFAULT_PLAYBACK_CONFIG.minRecordedIntervalMs);
        next.maxRecordedIntervalMs = clampNumber(next.maxRecordedIntervalMs, next.minRecordedIntervalMs, 120000, DEFAULT_PLAYBACK_CONFIG.maxRecordedIntervalMs);
        return next;
    }

    scheduleNext(delay, reason = "playback-scheduled") {
        if (!this.playback || !this.playing || this.paused) return;
        if (this.playback.timer) clearTimeout(this.playback.timer);
        this.emit("event", { type: reason, delayMs: delay, state: this.getState() });
        this.playback.timer = setTimeout(() => {
            this.playback.timer = null;
            this.runPlaybackStep().catch((error) => {
                this.setError(error.message || "播放失败");
                this.stopPlayback("playback-error");
            });
        }, Math.max(0, delay));
    }

    async runPlaybackStep() {
        if (!this.playback || !this.playing || this.paused) return;
        if (this.playback.loopIndex >= this.playback.totalLoops) {
            this.stopPlayback("playback-completed");
            return;
        }
        const point = this.points[this.playback.pointIndex];
        if (!point) {
            this.playback.loopIndex += 1;
            this.playback.pointIndex = 0;
            if (this.playback.loopIndex >= this.playback.totalLoops) {
                this.stopPlayback("playback-completed");
                return;
            }
            this.scheduleNext(this.nextDelayForIndex(0));
            return;
        }
        const button = this.playback.config.buttonMode === "override" ? this.playback.config.button : point.button;
        await this.sendClick(point.x, point.y, button, this.playback.config.downMs);
        if (!this.playing || !this.playback) return;
        this.playback.pointIndex += 1;
        this.emitState("playback-step");
        if (this.playback.pointIndex >= this.points.length) {
            this.playback.loopIndex += 1;
            this.playback.pointIndex = 0;
        }
        if (this.playback.loopIndex >= this.playback.totalLoops) {
            this.stopPlayback("playback-completed");
            return;
        }
        this.scheduleNext(this.nextDelayForIndex(this.playback.pointIndex));
    }

    nextDelayForIndex(index) {
        const config = this.playback.config;
        if (config.mode !== "recorded") return config.intervalMs;
        if (index === 0) return config.intervalMs;
        const point = this.points[index];
        return clampNumber(point?.delayFromPreviousMs, config.minRecordedIntervalMs, config.maxRecordedIntervalMs, config.intervalMs);
    }

    sendClick(x, y, button, downMs) {
        if (!this.agent?.stdin?.writable) throw new Error("点击 helper 未启动");
        const id = nowId("click");
        const payload = JSON.stringify({ type: "click", id, x, y, button, downMs });
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingClicks.delete(id);
                reject(new Error("点击 helper 响应超时"));
            }, 5000);
            this.pendingClicks.set(id, () => {
                clearTimeout(timeout);
                resolve();
            });
            this.agent.stdin.write(`${payload}\n`, "utf-8");
        });
    }

    setError(message) {
        this.error = message;
        this.emit("event", { type: "error", message, state: this.getState() });
    }

    emitState(type) {
        this.emit("event", { type, state: this.getState() });
    }

    assertSupported() {
        if (process.platform !== "win32") {
            throw new Error("模拟点击工具仅支持 Windows 桌面版");
        }
    }

    dispose() {
        if (this.playback?.timer) clearTimeout(this.playback.timer);
        this.pendingClicks.clear();
        if (this.agent?.stdin?.writable) {
            try {
                this.agent.stdin.write("{\"type\":\"shutdown\"}\n");
                this.agent.stdin.end();
            } catch {}
        }
        if (this.agent && !this.agent.killed) {
            setTimeout(() => {
                if (this.agent && !this.agent.killed) this.agent.kill();
            }, 500);
        }
    }
}

module.exports = {
    ClickerRuntime,
    DEFAULT_PLAYBACK_CONFIG,
};
