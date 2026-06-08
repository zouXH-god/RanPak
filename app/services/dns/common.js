const SUPPORTED_TYPES = new Set(["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"]);

function normalizeProviderType(type = "") {
    return String(type).trim().toLowerCase();
}

function normalizeRecordType(type = "") {
    const value = String(type || "").toUpperCase();
    if (!SUPPORTED_TYPES.has(value)) {
        throw new Error(`不支持的解析记录类型: ${type}`);
    }
    return value;
}

function domainInfo(domain = "", domainId = "") {
    return {
        domainId: String(domainId || domain || ""),
        domain: String(domain || ""),
    };
}

function domainRecord({
    domain,
    rr = "",
    record_id = "",
    type = "",
    value = "",
    domain_type = "",
    line = "",
    status = "",
}) {
    return {
        domain,
        rr: String(rr || ""),
        record_id: String(record_id || ""),
        type: String(type || ""),
        value: String(value || ""),
        domain_type: String(domain_type || ""),
        line: String(line || ""),
        status: String(status || ""),
    };
}

function recordList(records = [], total = records.length, page = 1, limit = records.length) {
    return {
        total_count: Number(total || 0),
        page_number: Number(page || 1),
        page_size: Number(limit || records.length || 0),
        domain_records: records,
    };
}

function filterRecords(records, key = "", recordType = "") {
    const keyword = String(key || "").toLowerCase();
    const type = String(recordType || "").toUpperCase();
    return records.filter((record) => {
        if (type && record.type !== type) return false;
        if (!keyword) return true;
        return [record.rr, record.value, record.type, record.line]
            .some((value) => String(value || "").toLowerCase().includes(keyword));
    });
}

function pageRecords(records, limit = 10, page = 1) {
    const safeLimit = Math.max(1, Number(limit || 10));
    const safePage = Math.max(1, Number(page || 1));
    const start = (safePage - 1) * safeLimit;
    return records.slice(start, start + safeLimit);
}

module.exports = {
    normalizeProviderType,
    normalizeRecordType,
    domainInfo,
    domainRecord,
    recordList,
    filterRecords,
    pageRecords,
};
