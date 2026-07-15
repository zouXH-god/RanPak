import { ref, computed } from "vue";
import { copyFile, startChunkedCopy, copyChunk, moveFile, deleteFile } from "../utils/api/files.ts";

const BIG_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

const queue = ref([]);
const concurrency = ref(2);
const chunkSize = ref(DEFAULT_CHUNK_SIZE);

const totalSize = computed(() => queue.value.reduce((sum, t) => sum + (t.fileSize || 0), 0));
const totalTransferred = computed(() => queue.value.reduce((sum, t) => sum + (t.transferred || 0), 0));
const totalProgress = computed(() => totalSize.value > 0 ? Math.round((totalTransferred.value / totalSize.value) * 100) : 0);

let taskIdCounter = 0;
function genId() {
    return `transfer-${Date.now()}-${++taskIdCounter}`;
}

const runningCount = computed(() => queue.value.filter((t) => t.status === "running").length);
const pendingCount = computed(() => queue.value.filter((t) => t.status === "pending").length);
const doneCount = computed(() => queue.value.filter((t) => t.status === "done").length);
const errorCount = computed(() => queue.value.filter((t) => t.status === "error").length);
const hasActive = computed(() => runningCount.value > 0 || pendingCount.value > 0);

function addTasks(files, targetDir, type = "copy") {
    const tasks = files.map((file) => ({
        id: genId(),
        type,
        source: file.path,
        target: targetDir + file.name,
        fileName: file.name,
        fileSize: file.size || 0,
        status: "pending",
        progress: 0,
        transferred: 0,
        speed: 0,
        error: null,
        backendTaskId: null,
        totalChunks: 0,
        completedChunks: 0,
        _cancelled: false,
    }));
    queue.value.push(...tasks);
    scheduleNext();
    return tasks;
}

function scheduleNext() {
    while (runningCount.value < concurrency.value) {
        const next = queue.value.find((t) => t.status === "pending");
        if (!next) break;
        executeTask(next);
    }
}

async function executeTask(task) {
    task.status = "running";
    task.error = null;
    const startTime = Date.now();

    try {
        if (task.fileSize > BIG_FILE_THRESHOLD) {
            await executeChunkedTask(task, startTime);
        } else {
            await executeDirectTask(task);
        }

        if (task._cancelled) return;
        task.status = "done";
        task.progress = 100;
        task.transferred = task.fileSize;
    } catch (err) {
        if (task._cancelled) return;
        task.status = "error";
        task.error = err?.message || String(err);
    } finally {
        scheduleNext();
    }
}

async function executeDirectTask(task) {
    if (task.type === "copy") {
        const res = await copyFile(task.source, task.target);
        if (!res) throw new Error("复制失败");
    } else {
        const res = await moveFile(task.source, task.target);
        if (!res) throw new Error("移动失败");
        if (res.data?.needChunked) {
            task.fileSize = res.data.size;
            await executeChunkedMoveTask(task, Date.now());
            return;
        }
    }
}

async function executeChunkedTask(task, startTime) {
    if (!task.backendTaskId) {
        const res = await startChunkedCopy(task.source, task.target, chunkSize.value);
        if (!res || !res.data) throw new Error("初始化分块复制失败");
        task.backendTaskId = res.data.taskId;
        task.totalChunks = res.data.totalChunks;
        task.completedChunks = 0;
    }

    for (let i = task.completedChunks; i < task.totalChunks; i++) {
        if (task._cancelled || task.status === "paused") return;

        const res = await copyChunk(task.backendTaskId, i);
        if (!res || !res.data) throw new Error(`块 ${i} 复制失败`);

        task.completedChunks = res.data.completedChunks;
        task.transferred = task.completedChunks * (task.fileSize / task.totalChunks);
        task.progress = Math.round((task.completedChunks / task.totalChunks) * 100);

        const elapsed = (Date.now() - startTime) / 1000;
        task.speed = elapsed > 0 ? Math.round(task.transferred / elapsed) : 0;
    }
}

async function executeChunkedMoveTask(task, startTime) {
    task.type = "move";
    await executeChunkedTask(task, startTime);
    if (task._cancelled) return;
    await deleteFile(task.source);
}

function pauseTask(id) {
    const task = queue.value.find((t) => t.id === id);
    if (task && task.status === "running") {
        task.status = "paused";
    }
}

function resumeTask(id) {
    const task = queue.value.find((t) => t.id === id);
    if (task && task.status === "paused") {
        task.status = "pending";
        scheduleNext();
    }
}

function retryTask(id) {
    const task = queue.value.find((t) => t.id === id);
    if (task && task.status === "error") {
        task.status = "pending";
        task.error = null;
        scheduleNext();
    }
}

function cancelTask(id) {
    const task = queue.value.find((t) => t.id === id);
    if (!task) return;
    task._cancelled = true;
    task.status = "cancelled";
    scheduleNext();
}

function clearCompleted() {
    queue.value = queue.value.filter((t) => t.status !== "done" && t.status !== "cancelled");
}

function pauseAll() {
    queue.value.forEach((t) => {
        if (t.status === "running") t.status = "paused";
        else if (t.status === "pending") t.status = "paused";
    });
}

function cancelAll() {
    queue.value.forEach((t) => {
        if (t.status === "pending" || t.status === "running" || t.status === "paused") {
            t._cancelled = true;
            t.status = "cancelled";
        }
    });
}

export function useTransferQueue() {
    return {
        queue,
        concurrency,
        chunkSize,
        totalSize,
        totalTransferred,
        totalProgress,
        runningCount,
        pendingCount,
        doneCount,
        errorCount,
        hasActive,
        addTasks,
        pauseTask,
        resumeTask,
        retryTask,
        cancelTask,
        clearCompleted,
        pauseAll,
        cancelAll,
    };
}
