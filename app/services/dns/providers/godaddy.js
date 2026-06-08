const {
    domainInfo,
    domainRecord,
    filterRecords,
    normalizeRecordType,
    pageRecords,
    recordList,
} = require("../common");

const DEFAULT_BASE_URL = "https://api.godaddy.com";

function encodeRecordId(record) {
    return Buffer.from(JSON.stringify(record), "utf8").toString("base64url");
}

function decodeRecordId(recordId) {
    try {
        return JSON.parse(Buffer.from(String(recordId), "base64url").toString("utf8"));
    } catch {
        throw new Error("无效的 GoDaddy 记录 ID");
    }
}

function normalizeName(value) {
    return value || "@";
}

class GoDaddyDnsProvider {
    constructor(config) {
        this.type = "godaddy";
        this.baseUrl = String(config.base_url || DEFAULT_BASE_URL).replace(/\/+$/, "");
        this.key = config.access_key_id;
        this.secret = config.access_key_secret;
    }

    async request(path, options = {}) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers: {
                Authorization: `sso-key ${this.key}:${this.secret}`,
                Accept: "application/json",
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
        });
        if (response.status === 204) return null;
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("json") ? await response.json().catch(() => null) : await response.text();
        if (!response.ok) {
            const message = data?.message || data?.detail || response.statusText || "GoDaddy API request failed";
            throw new Error(message);
        }
        return data;
    }

    async listDomains() {
        const data = await this.request("/v1/domains");
        return (Array.isArray(data) ? data : []).map((item) => {
            const name = item.domain || item.name || "";
            return domainInfo(name, item.domainId || name);
        });
    }

    async fetchRecords(domainName, type = "", name = "") {
        const paths = [];
        if (type && name) paths.push(`/v1/domains/${encodeURIComponent(domainName)}/records/${encodeURIComponent(type)}/${encodeURIComponent(name)}`);
        if (type) paths.push(`/v1/domains/${encodeURIComponent(domainName)}/records/${encodeURIComponent(type)}`);
        paths.push(`/v1/domains/${encodeURIComponent(domainName)}/records`);

        let lastError = null;
        for (const path of paths) {
            try {
                const data = await this.request(path);
                return Array.isArray(data) ? data : [];
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    }

    async listRecords(domain, { limit = 10, page = 1, key = "", record_type = "" } = {}) {
        const requestedType = record_type ? normalizeRecordType(record_type) : "";
        const rawRecords = await this.fetchRecords(domain.domain, requestedType);
        const records = rawRecords.map((item, index) => {
            const type = item.type || requestedType;
            const name = normalizeName(item.name);
            return domainRecord({
                domain,
                rr: name,
                record_id: encodeRecordId({ type, name, index, data: item.data, ttl: item.ttl }),
                type,
                value: item.data,
                domain_type: this.type,
                line: "",
                status: "ENABLE",
            });
        });
        const filtered = filterRecords(records, key, requestedType);
        return recordList(pageRecords(filtered, limit, page), filtered.length, page, limit);
    }

    async getGroup(domainName, type, name) {
        return await this.fetchRecords(domainName, type, name);
    }

    async putGroup(domainName, type, name, records) {
        if (records.length === 0) {
            await this.request(`/v1/domains/${encodeURIComponent(domainName)}/records/${encodeURIComponent(type)}/${encodeURIComponent(name)}`, {
                method: "DELETE",
            });
            return true;
        }
        await this.request(`/v1/domains/${encodeURIComponent(domainName)}/records/${encodeURIComponent(type)}/${encodeURIComponent(name)}`, {
            method: "PUT",
            body: JSON.stringify(records),
        });
        return true;
    }

    async addRecord(record) {
        const type = normalizeRecordType(record.record_type || record.type);
        const name = normalizeName(record.rr);
        await this.request(`/v1/domains/${encodeURIComponent(record.domain.domain)}/records`, {
            method: "PATCH",
            body: JSON.stringify([{
                type,
                name,
                data: record.value,
                ttl: Number(record.ttl || 600),
            }]),
        });
        return domainRecord({
            domain: record.domain,
            rr: name,
            record_id: encodeRecordId({ type, name, index: 0, data: record.value, ttl: Number(record.ttl || 600) }),
            type,
            value: record.value,
            domain_type: this.type,
            status: "ENABLE",
        });
    }

    async updateRecord(record) {
        const oldRecord = decodeRecordId(record.record_id);
        const oldType = normalizeRecordType(oldRecord.type);
        const oldName = normalizeName(oldRecord.name);
        const newType = normalizeRecordType(record.record_type || record.type);
        const newName = normalizeName(record.rr);
        const newItem = { data: record.value, ttl: Number(record.ttl || oldRecord.ttl || 600) };

        if (oldType !== newType || oldName !== newName) {
            await this.deleteRecord(record);
            await this.addRecord(record);
        } else {
            const group = await this.getGroup(record.domain.domain, oldType, oldName);
            const index = Math.min(Number(oldRecord.index || 0), Math.max(group.length - 1, 0));
            group[index] = newItem;
            await this.putGroup(record.domain.domain, oldType, oldName, group);
        }

        return domainRecord({
            domain: record.domain,
            rr: newName,
            record_id: encodeRecordId({ type: newType, name: newName, index: oldRecord.index || 0, data: record.value, ttl: newItem.ttl }),
            type: newType,
            value: record.value,
            domain_type: this.type,
            status: "ENABLE",
        });
    }

    async deleteRecord(record) {
        const oldRecord = decodeRecordId(record.record_id);
        const type = normalizeRecordType(oldRecord.type);
        const name = normalizeName(oldRecord.name);
        const group = await this.getGroup(record.domain.domain, type, name);
        const index = Number(oldRecord.index || 0);
        const next = group.filter((_, itemIndex) => itemIndex !== index);
        await this.putGroup(record.domain.domain, type, name, next);
        return true;
    }

    async setRecordStatus() {
        throw new Error("GoDaddy 不支持解析记录启停");
    }
}

module.exports = GoDaddyDnsProvider;
