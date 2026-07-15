"use strict";

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { parseRule, parseRuleFirst, parseRuleElements, parseJsonList, parseSearchUrl, resolveUrl, renderTemplate, applyReplaceRegex } = require("./rule-parser");

function generateId(prefix = "nr") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseJsonField(value) {
    if (!value) return {};
    if (typeof value === "object") return value;
    if (typeof value === "string") {
        try { return JSON.parse(value); } catch { return {}; }
    }
    return {};
}

class NovelReaderService {
    constructor({ storePath }) {
        this.storePath = storePath;
    }

    readStore() {
        try {
            const raw = JSON.parse(fs.readFileSync(this.storePath, "utf-8")) || {};
            return {
                sources: Array.isArray(raw.sources) ? raw.sources : [],
                bookshelf: Array.isArray(raw.bookshelf) ? raw.bookshelf : [],
                settings: raw.settings || { fontSize: 18, lineHeight: 1.8, theme: "light" },
            };
        } catch {
            return { sources: [], bookshelf: [], settings: { fontSize: 18, lineHeight: 1.8, theme: "light" } };
        }
    }

    writeStore(store) {
        fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
        fs.writeFileSync(this.storePath, JSON.stringify(store, null, 2), "utf-8");
    }

    // ─── 书源管理 ───

    listSources() {
        return this.readStore().sources;
    }

    importSources(jsonText) {
        if (!jsonText || typeof jsonText !== "string") throw new Error("导入内容不能为空");
        let parsed;
        try { parsed = JSON.parse(jsonText); } catch { throw new Error("JSON 格式错误"); }
        const arr = Array.isArray(parsed) ? parsed : [parsed];

        if (arr.length === 0) throw new Error("JSON 数组为空");
        const first = arr[0];
        if (first && !first.bookSourceUrl && !first.bookSourceName && (first.pattern || first.isRegex !== undefined)) {
            throw new Error("该文件是「替换净化规则」而非「书源」，请导入书源文件（包含 bookSourceUrl、bookSourceName 字段）");
        }

        const store = this.readStore();
        let added = 0;
        let updated = 0;
        let skipped = 0;
        for (const raw of arr) {
            if (!raw || typeof raw !== "object") { skipped++; continue; }
            if (!raw.bookSourceUrl && !raw.bookSourceName) { skipped++; continue; }
            const sourceUrl = String(raw.bookSourceUrl || raw.sourceUrl || "").trim();
            const sourceName = String(raw.bookSourceName || raw.sourceName || raw.name || "").trim();
            if (!sourceUrl) { skipped++; continue; }
            const existing = store.sources.find((s) => s.bookSourceUrl === sourceUrl);
            const source = {
                id: existing?.id || generateId("src"),
                bookSourceName: sourceName || sourceUrl,
                bookSourceUrl: sourceUrl,
                bookSourceGroup: String(raw.bookSourceGroup || raw.group || ""),
                bookSourceType: Number(raw.bookSourceType) || 0,
                enabled: raw.enabled !== false && raw.enabledExplore !== false,
                header: parseJsonField(raw.header),
                searchUrl: String(raw.searchUrl || ""),
                ruleSearch: parseJsonField(raw.ruleSearch),
                ruleBookInfo: parseJsonField(raw.ruleBookInfo),
                ruleToc: parseJsonField(raw.ruleToc),
                ruleContent: parseJsonField(raw.ruleContent),
                ruleExplore: parseJsonField(raw.ruleExplore),
                lastUpdateTime: raw.lastUpdateTime || Date.now(),
                weight: raw.weight || 0,
                customOrder: raw.customOrder || 0,
                exploreUrl: String(raw.exploreUrl || ""),
            };
            if (existing) {
                Object.assign(existing, source);
                updated++;
            } else {
                store.sources.push(source);
                added++;
            }
        }
        if (added === 0 && updated === 0 && skipped > 0) {
            throw new Error(`未找到有效书源（共 ${arr.length} 项，跳过 ${skipped} 项无 bookSourceUrl 字段）`);
        }
        this.writeStore(store);
        return { total: arr.length, added, updated, skipped };
    }

    deleteSource(id) {
        const store = this.readStore();
        store.sources = store.sources.filter((s) => s.id !== id);
        this.writeStore(store);
    }

    deleteSources(ids) {
        if (!Array.isArray(ids)) return;
        const idSet = new Set(ids);
        const store = this.readStore();
        store.sources = store.sources.filter((s) => !idSet.has(s.id));
        this.writeStore(store);
    }

    toggleSource(id, enabled) {
        const store = this.readStore();
        const source = store.sources.find((s) => s.id === id);
        if (source) { source.enabled = !!enabled; this.writeStore(store); }
    }

    // ─── 搜索 ───

    async fetchPage(url, options = {}) {
        const defaultHeaders = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" };
        const fetchOptions = {
            method: options.method || "GET",
            headers: { ...defaultHeaders, ...(options.headers || {}) },
            redirect: "follow",
        };
        if (options.body && fetchOptions.method !== "GET" && fetchOptions.method !== "HEAD") {
            fetchOptions.body = options.body;
            if (!fetchOptions.headers["Content-Type"]) {
                fetchOptions.headers["Content-Type"] = "application/x-www-form-urlencoded";
            }
        }
        const resp = await fetch(url, fetchOptions);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.text();
    }

    getSourceByUrl(sourceUrl) {
        const store = this.readStore();
        return store.sources.find((s) => s.bookSourceUrl === sourceUrl);
    }

    async search({ keyword, sourceUrls }) {
        if (!keyword) throw new Error("搜索关键词不能为空");
        const store = this.readStore();
        const sources = sourceUrls?.length
            ? store.sources.filter((s) => sourceUrls.includes(s.bookSourceUrl) && s.enabled)
            : store.sources.filter((s) => s.enabled);

        console.log(`[NovelReader] 搜索关键词: "${keyword}", 可用书源数: ${sources.length}`);
        if (sources.length === 0) throw new Error("没有可用的启用书源");

        const results = [];
        const errors = [];

        for (const source of sources.slice(0, 5)) {
            console.log(`[NovelReader] ---- 开始搜索书源: ${source.bookSourceName} (${source.bookSourceUrl})`);
            try {
                const searchUrlRaw = String(source.searchUrl || "");
                if (!searchUrlRaw) { errors.push({ sourceUrl: source.bookSourceUrl, sourceName: source.bookSourceName, error: "书源缺少 searchUrl" }); console.log(`[NovelReader]   跳过: 缺少 searchUrl`); continue; }

                const { url, method, body, headers: extraHeaders } = parseSearchUrl(searchUrlRaw, source.bookSourceUrl, { key: keyword, page: 1 });
                console.log(`[NovelReader]   请求: ${method} ${url}`);
                if (body) console.log(`[NovelReader]   body: ${body}`);

                const sourceHeaders = typeof source.header === "object" ? source.header : {};
                const text = await this.fetchPage(url, { method, body, headers: { ...sourceHeaders, ...extraHeaders } });
                console.log(`[NovelReader]   响应长度: ${text?.length || 0} 字符`);

                const rules = source.ruleSearch || {};
                const bookListRule = String(rules.bookList || "");
                console.log(`[NovelReader]   bookList 规则: "${bookListRule}"`);
                console.log(`[NovelReader]   ruleSearch: name="${rules.name || ""}", author="${rules.author || ""}", bookUrl="${rules.bookUrl || ""}", coverUrl="${rules.coverUrl || ""}"`);

                let isJson = false;
                let jsonData = null;
                if (bookListRule.startsWith("$.") || bookListRule.startsWith("$[") || bookListRule.startsWith("@json:")) {
                    isJson = true;
                    try { jsonData = JSON.parse(text); } catch { throw new Error("响应非 JSON 格式"); }
                }
                console.log(`[NovelReader]   解析模式: ${isJson ? "JSON" : "HTML"}`);

                if (isJson && jsonData) {
                    const items = parseJsonList(jsonData, bookListRule);
                    console.log(`[NovelReader]   JSON 匹配条目数: ${items.length}`);
                    for (const item of items) {
                        if (!item || typeof item !== "object") continue;
                        const name = parseRuleFirst(null, null, rules.name, source.bookSourceUrl, item);
                        if (!name) continue;
                        const bookUrl = parseRuleFirst(null, null, rules.bookUrl, source.bookSourceUrl, item);
                        const coverRaw = parseRuleFirst(null, null, rules.coverUrl, source.bookSourceUrl, item);
                        results.push({
                            sourceUrl: source.bookSourceUrl,
                            sourceName: source.bookSourceName,
                            name,
                            author: parseRuleFirst(null, null, rules.author, source.bookSourceUrl, item),
                            bookUrl: resolveUrl(bookUrl, url),
                            coverUrl: coverRaw ? resolveUrl(coverRaw, url) : "",
                            intro: parseRuleFirst(null, null, rules.intro, source.bookSourceUrl, item),
                        });
                    }
                } else {
                    const $ = cheerio.load(text);
                    const bookElements = parseRuleElements($, bookListRule, source.bookSourceUrl);
                    console.log(`[NovelReader]   HTML bookList 匹配元素数: ${bookElements.length}`);

                    if (bookElements.length === 0) {
                        console.log(`[NovelReader]   响应前500字符: ${text?.substring(0, 500)}`);
                        errors.push({ sourceUrl: source.bookSourceUrl, sourceName: source.bookSourceName, error: `bookList 规则「${bookListRule}」未匹配到元素` });
                        continue;
                    }

                    for (const $el of bookElements) {
                        const name = parseRuleFirst($, $el, rules.name, source.bookSourceUrl);
                        if (!name) continue;
                        const bookUrl = parseRuleFirst($, $el, rules.bookUrl, source.bookSourceUrl);
                        const coverRaw = parseRuleFirst($, $el, rules.coverUrl, source.bookSourceUrl);
                        results.push({
                            sourceUrl: source.bookSourceUrl,
                            sourceName: source.bookSourceName,
                            name,
                            author: parseRuleFirst($, $el, rules.author, source.bookSourceUrl),
                            bookUrl: resolveUrl(bookUrl, url),
                            coverUrl: coverRaw ? resolveUrl(coverRaw, url) : "",
                            intro: parseRuleFirst($, $el, rules.intro, source.bookSourceUrl),
                        });
                    }
                }
                console.log(`[NovelReader]   本书源搜索到 ${results.length} 条结果`);
            } catch (err) {
                console.log(`[NovelReader]   搜索出错: ${err?.message}`);
                errors.push({ sourceUrl: source.bookSourceUrl, sourceName: source.bookSourceName, error: err?.message || "搜索失败" });
            }
        }
        console.log(`[NovelReader] 搜索完成, 总结果: ${results.length}, 错误书源: ${errors.length}`);
        return { results, errors };
    }

    async getBookInfo({ sourceUrl, bookUrl }) {
        const source = this.getSourceByUrl(sourceUrl);
        if (!source) throw new Error("书源不存在");
        const url = resolveUrl(bookUrl, source.bookSourceUrl);
        const sourceHeaders = typeof source.header === "object" ? source.header : {};
        const html = await this.fetchPage(url, { headers: sourceHeaders });
        const $ = cheerio.load(html);
        const rules = source.ruleBookInfo || {};
        return {
            name: parseRuleFirst($, null, rules.name, url),
            author: parseRuleFirst($, null, rules.author, url),
            coverUrl: parseRuleFirst($, null, rules.coverUrl, url),
            intro: parseRuleFirst($, null, rules.intro, url),
            tocUrl: resolveUrl(parseRuleFirst($, null, rules.tocUrl, url), url) || url,
        };
    }

    async getChapterList({ sourceUrl, bookUrl }) {
        const source = this.getSourceByUrl(sourceUrl);
        if (!source) throw new Error("书源不存在");
        const sourceHeaders = typeof source.header === "object" ? source.header : {};

        const info = await this.getBookInfo({ sourceUrl, bookUrl });
        const tocUrl = info.tocUrl || resolveUrl(bookUrl, source.bookSourceUrl);
        const html = await this.fetchPage(tocUrl, { headers: sourceHeaders });
        const $ = cheerio.load(html);
        const rules = source.ruleToc || {};
        const chapterListRule = String(rules.chapterList || "");
        const chapterElements = parseRuleElements($, chapterListRule, tocUrl);

        const chapters = [];
        for (const $el of chapterElements) {
            const name = parseRuleFirst($, $el, rules.chapterName, tocUrl);
            const chapterUrl = parseRuleFirst($, $el, rules.chapterUrl, tocUrl);
            if (name) chapters.push({ name, url: chapterUrl ? resolveUrl(chapterUrl, tocUrl) : "" });
        }
        return { info, chapters };
    }

    async getChapterContent({ sourceUrl, chapterUrl }) {
        const source = this.getSourceByUrl(sourceUrl);
        if (!source) throw new Error("书源不存在");
        const sourceHeaders = typeof source.header === "object" ? source.header : {};
        const url = resolveUrl(chapterUrl, source.bookSourceUrl);
        const html = await this.fetchPage(url, { headers: sourceHeaders });
        const $ = cheerio.load(html);
        const rules = source.ruleContent || {};
        let content = parseRuleFirst($, null, rules.content, url);
        if (rules.replaceRegex) content = applyReplaceRegex(content, rules.replaceRegex);

        let nextUrl = "";
        if (rules.nextContentUrl) {
            nextUrl = parseRuleFirst($, null, rules.nextContentUrl, url);
            if (nextUrl) nextUrl = resolveUrl(nextUrl, url);
        }
        return { content, nextUrl };
    }

    // ─── 书架 ───

    getBookshelf() {
        return this.readStore().bookshelf;
    }

    addToBookshelf(book) {
        const store = this.readStore();
        const existing = store.bookshelf.find((b) => b.sourceUrl === book.sourceUrl && b.bookUrl === book.bookUrl);
        if (existing) return existing;
        const entry = {
            id: generateId("book"),
            sourceUrl: book.sourceUrl || "",
            bookUrl: book.bookUrl || "",
            name: book.name || "",
            author: book.author || "",
            coverUrl: book.coverUrl || "",
            lastChapter: book.lastChapter || "",
            addedAt: Date.now(),
            lastReadAt: 0,
            progress: { chapterIndex: 0, scrollTop: 0 },
        };
        store.bookshelf.push(entry);
        this.writeStore(store);
        return entry;
    }

    removeFromBookshelf(id) {
        const store = this.readStore();
        store.bookshelf = store.bookshelf.filter((b) => b.id !== id);
        this.writeStore(store);
    }

    updateProgress({ bookId, chapterIndex, scrollTop, lastChapter }) {
        const store = this.readStore();
        const book = store.bookshelf.find((b) => b.id === bookId);
        if (!book) return;
        book.progress = { chapterIndex: chapterIndex ?? book.progress.chapterIndex, scrollTop: scrollTop ?? book.progress.scrollTop };
        book.lastReadAt = Date.now();
        if (lastChapter) book.lastChapter = lastChapter;
        this.writeStore(store);
    }

    // ─── 设置 ───

    getSettings() {
        return this.readStore().settings;
    }

    updateSettings(settings) {
        const store = this.readStore();
        store.settings = { ...store.settings, ...settings };
        this.writeStore(store);
        return store.settings;
    }
}

module.exports = NovelReaderService;
