const {
    domainInfo,
    domainRecord,
    normalizeRecordType,
    recordList,
} = require("../common");

class CloudflareDnsProvider {
    constructor(config) {
        this.type = "cloudflare";
        this.baseUrl = String(config.base_url || "https://api.cloudflare.com/client/v4").replace(/\/+$/, "");
        this.token = config.access_key_secret || config.access_key_id;
    }

    async request(path, options = {}) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            const message = data?.errors?.[0]?.message || response.statusText || "Cloudflare API request failed";
            throw new Error(message);
        }
        return data;
    }

    async listDomains() {
        const data = await this.request("/zones?per_page=100");
        return (data.result || []).map((item) => domainInfo(item.name, item.id));
    }

    async listRecords(domain, { limit = 10, page = 1, key = "", record_type = "" } = {}) {
        const params = new URLSearchParams({
            per_page: String(limit),
            page: String(page),
        });
        if (record_type) params.set("type", record_type);
        if (key) params.set("name.contains", key);

        const data = await this.request(`/zones/${encodeURIComponent(domain.domainId)}/dns_records?${params}`);
        const info = data.result_info || {};
        const records = (data.result || []).map((item) => domainRecord({
            domain,
            rr: item.name,
            record_id: item.id,
            type: item.type,
            value: item.content,
            domain_type: this.type,
            line: "",
            status: "ENABLE",
        }));
        return recordList(records, info.total_count || records.length, info.page || page, info.per_page || limit);
    }

    async addRecord(record) {
        const type = normalizeRecordType(record.record_type || record.type);
        const data = await this.request(`/zones/${encodeURIComponent(record.domain.domainId)}/dns_records`, {
            method: "POST",
            body: JSON.stringify({
                type,
                name: record.rr,
                content: record.value,
                ttl: 1,
                proxied: false,
            }),
        });
        const item = data.result || {};
        return domainRecord({
            domain: record.domain,
            rr: item.name || record.rr,
            record_id: item.id,
            type,
            value: item.content || record.value,
            domain_type: this.type,
            status: "ENABLE",
        });
    }

    async updateRecord(record) {
        const type = normalizeRecordType(record.record_type || record.type);
        const data = await this.request(
            `/zones/${encodeURIComponent(record.domain.domainId)}/dns_records/${encodeURIComponent(record.record_id)}`,
            {
                method: "PUT",
                body: JSON.stringify({
                    type,
                    name: record.rr,
                    content: record.value,
                    ttl: 1,
                    proxied: false,
                }),
            },
        );
        const item = data.result || {};
        return domainRecord({
            domain: record.domain,
            rr: item.name || record.rr,
            record_id: item.id || record.record_id,
            type,
            value: item.content || record.value,
            domain_type: this.type,
            status: "ENABLE",
        });
    }

    async deleteRecord(record) {
        await this.request(
            `/zones/${encodeURIComponent(record.domain.domainId)}/dns_records/${encodeURIComponent(record.record_id)}`,
            { method: "DELETE" },
        );
        return true;
    }

    async setRecordStatus() {
        throw new Error("Cloudflare 不支持解析记录启停");
    }
}

module.exports = CloudflareDnsProvider;
