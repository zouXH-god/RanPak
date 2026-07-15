"use strict";

const cheerio = require("cheerio");
const { JSONPath } = require("jsonpath-plus");
const vm = require("vm");

/**
 * legado 规则解析引擎
 * 支持: CSS选择器、class.xxx/id.xxx/tag.xxx 前缀、@css:/@json:/@js: 前缀、
 *       || (或) 分隔符、&& (与/拼接) 分隔符、JSONPath、JS沙箱、正则替换
 */

function resolveUrl(relative, base) {
    if (!relative) return "";
    if (/^https?:\/\//i.test(relative)) return relative;
    if (relative.startsWith("//")) return "https:" + relative;
    try { return new URL(relative, base).href; } catch { return relative; }
}

function renderTemplate(template, vars = {}) {
    if (!template || typeof template !== "string") return "";
    return template.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
        const trimmed = expr.trim();
        if (trimmed in vars) return encodeURIComponent(String(vars[trimmed]));
        try {
            const fn = new Function(...Object.keys(vars), `return ${trimmed}`);
            return encodeURIComponent(String(fn(...Object.values(vars))));
        } catch { return ""; }
    });
}

function applyReplaceRegex(text, replaceRegex) {
    if (!replaceRegex || !text) return text || "";
    const rules = Array.isArray(replaceRegex) ? replaceRegex : String(replaceRegex).split("&&");
    let result = text;
    for (const rule of rules) {
        const trimmed = String(rule).trim();
        if (!trimmed) continue;
        const parts = trimmed.split("##");
        const pattern = parts[0];
        const replacement = parts[1] || "";
        if (!pattern) continue;
        try { result = result.replace(new RegExp(pattern, "g"), replacement); } catch { /* skip */ }
    }
    return result;
}

function executeJs(code, context = {}) {
    const sandbox = { result: context.result || "", baseUrl: context.baseUrl || "", src: context.src || "", java: null, ...context };
    try {
        const script = new vm.Script(code, { timeout: 3000 });
        const ctx = vm.createContext(sandbox);
        script.runInContext(ctx);
        return sandbox.result !== undefined ? String(sandbox.result) : "";
    } catch { return ""; }
}

/**
 * 解析 legado searchUrl 格式
 * 支持: "url" 或 "url,{json}" 形式
 */
function parseSearchUrl(searchUrlRaw, baseUrl, vars = {}) {
    const searchUrl = renderTemplate(String(searchUrlRaw || ""), vars);
    const commaIdx = searchUrl.indexOf(",{");
    let url, method = "GET", body = "", headers = {}, charset = "";

    if (commaIdx > 0) {
        url = searchUrl.slice(0, commaIdx).trim();
        try {
            const config = JSON.parse(searchUrl.slice(commaIdx + 1));
            method = String(config.method || "GET").toUpperCase();
            body = config.body ? renderTemplate(config.body, vars) : "";
            charset = config.charset || "";
            if (config.headers) headers = config.headers;
        } catch { /* use defaults */ }
    } else {
        url = searchUrl.trim();
    }

    url = resolveUrl(url, baseUrl);
    return { url, method, body, headers, charset };
}

/**
 * 将 legado 规则选择器转换为标准 CSS 选择器
 * class.xxx -> .xxx
 * id.xxx -> #xxx
 * tag.xxx -> xxx
 * @css:selector -> selector
 */
function normalizeCssSelector(rule) {
    if (!rule) return "";
    let r = rule.trim();
    if (r.startsWith("@css:")) r = r.slice(5).trim();
    // class.xxx -> .xxx
    r = r.replace(/\bclass\./g, ".");
    // id.xxx -> #xxx
    r = r.replace(/\bid\./g, "#");
    // tag.xxx -> just xxx (tag name)
    r = r.replace(/\btag\./g, "");
    return r;
}

/**
 * 解析单条规则中的选择器和属性部分
 * 格式: selector@attr 或 selector (默认取 text)
 * 特殊 attr: text, textNodes, html, innerHtml, outerHtml, src, href, content
 */
function splitSelectorAttr(rule) {
    if (!rule) return { selector: "", attr: "" };
    const r = rule.trim();

    // 处理 @css: 前缀
    let working = r;
    if (working.startsWith("@css:")) working = working.slice(5).trim();

    // 处理最后一个 @attr（但要避免误切 CSS 中的 @media 等）
    const lastAt = working.lastIndexOf("@");
    if (lastAt > 0) {
        const possibleAttr = working.slice(lastAt + 1).trim();
        if (/^[a-zA-Z\-_]+$/.test(possibleAttr) && !possibleAttr.startsWith("media")) {
            return { selector: normalizeCssSelector(working.slice(0, lastAt).trim()), attr: possibleAttr };
        }
    }
    return { selector: normalizeCssSelector(working), attr: "" };
}

/**
 * 从 cheerio 元素提取属性值
 */
function extractAttr($, $el, attr, baseUrl) {
    if (!$el || !$el.length) return "";
    switch (attr) {
        case "text": return $el.text().trim();
        case "textNodes": return $el.contents().filter((_, n) => n.type === "text").text().trim();
        case "html": case "innerHtml": case "innerHTML": return ($el.html() || "").trim();
        case "outerHtml": return ($.html($el) || "").trim();
        case "href": case "src": {
            const val = $el.attr(attr) || "";
            return val ? resolveUrl(val, baseUrl) : "";
        }
        case "": return $el.text().trim();
        default: return $el.attr(attr) || "";
    }
}

/**
 * 解析单条规则（不含 || 和 && 分隔符）
 * 返回结果数组
 */
function parseSingleRule($, $context, rule, baseUrl, jsonData) {
    if (!rule) return [];
    const r = rule.trim();

    // @js: 规则
    if (r.startsWith("@js:") || r.startsWith("<js>")) {
        const code = r.startsWith("@js:") ? r.slice(4) : r.replace(/^<js>/, "").replace(/<\/js>$/, "");
        const result = executeJs(code, { result: $context ? extractAttr($, $context, "html", baseUrl) : "", baseUrl, src: "" });
        return result ? [result] : [];
    }

    // @json: 或 $. JSONPath 规则
    if (r.startsWith("@json:") || r.startsWith("$.") || r.startsWith("$[")) {
        const jsonPath = r.startsWith("@json:") ? r.slice(6).trim() : r;
        const data = jsonData || (typeof $ === "string" ? JSON.parse($) : null);
        if (!data) return [];
        try {
            const results = JSONPath({ path: jsonPath, json: data, resultType: "value" });
            return Array.isArray(results) ? results.map((v) => typeof v === "object" ? JSON.stringify(v) : String(v)) : [];
        } catch { return []; }
    }

    // CSS 选择器规则
    const { selector, attr } = splitSelectorAttr(r);
    if (!selector && !attr) return [];

    const results = [];
    let targets;
    if (selector) {
        targets = $context && $context.length ? $context.find(selector) : $(selector);
    } else {
        targets = $context && $context.length ? $context : $.root();
    }

    if (!targets || !targets.length) {
        // 如果在 context 里没找到，尝试全局查找
        if ($context && $context.length && selector) {
            targets = $(selector);
        }
        if (!targets || !targets.length) return [];
    }

    targets.each((_, el) => {
        const val = extractAttr($, $(el), attr || "text", baseUrl);
        if (val) results.push(val);
    });
    return results;
}

/**
 * 解析规则（完整版，支持 || 和 && 分隔符）
 * || : 或，第一个有结果的规则生效
 * && : 与/拼接，所有规则的结果拼接
 */
function parseRule($, $context, rule, baseUrl, jsonData) {
    if (!rule || typeof rule !== "string") return [];
    const r = rule.trim();

    // || 分隔符：取第一个有结果的
    if (r.includes("||")) {
        const parts = r.split("||");
        for (const part of parts) {
            const results = parseRule($, $context, part.trim(), baseUrl, jsonData);
            if (results.length > 0) return results;
        }
        return [];
    }

    // && 分隔符：拼接所有结果
    if (r.includes("&&")) {
        const parts = r.split("&&");
        const combined = parts.map((part) => {
            const results = parseSingleRule($, $context, part.trim(), baseUrl, jsonData);
            return results[0] || "";
        });
        const joined = combined.join("");
        return joined ? [joined] : [];
    }

    return parseSingleRule($, $context, r, baseUrl, jsonData);
}

function parseRuleFirst($, $context, rule, baseUrl, jsonData) {
    const results = parseRule($, $context, rule, baseUrl, jsonData);
    return results[0] || "";
}

/**
 * 解析列表规则，返回 cheerio 元素数组
 */
function parseRuleElements($, rule, baseUrl) {
    if (!rule || typeof rule !== "string") return [];
    const r = rule.trim();

    // JSONPath
    if (r.startsWith("$.") || r.startsWith("$[") || r.startsWith("@json:")) {
        return []; // JSON 列表需要在 JSON 模式下处理
    }

    const { selector } = splitSelectorAttr(r);
    if (!selector) return [];
    const elements = [];
    $(selector).each((_, el) => elements.push($(el)));
    return elements;
}

/**
 * 解析 JSON 数据列表
 */
function parseJsonList(data, rule) {
    if (!rule || !data) return [];
    const r = rule.trim();
    const jsonPath = r.startsWith("@json:") ? r.slice(6).trim() : r;
    try {
        const results = JSONPath({ path: jsonPath, json: data, resultType: "value" });
        return Array.isArray(results) ? results : [];
    } catch { return []; }
}

module.exports = {
    resolveUrl,
    renderTemplate,
    applyReplaceRegex,
    executeJs,
    parseSearchUrl,
    normalizeCssSelector,
    parseRule,
    parseRuleFirst,
    parseRuleElements,
    parseJsonList,
};
