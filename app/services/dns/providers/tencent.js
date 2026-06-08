const tencentcloud = require("tencentcloud-sdk-nodejs");
const {
    domainInfo,
    domainRecord,
    normalizeRecordType,
    recordList,
} = require("../common");

class TencentDnsProvider {
    constructor(config) {
        this.type = "tencent";
        const Client = tencentcloud.dnspod.v20210323.Client;
        this.client = new Client({
            credential: {
                secretId: config.access_key_id,
                secretKey: config.access_key_secret,
            },
            region: "",
            profile: {
                httpProfile: {
                    endpoint: "dnspod.tencentcloudapi.com",
                },
            },
        });
    }

    async listDomains() {
        const response = await this.client.DescribeDomainList({ Limit: 100 });
        const items = response?.DomainList || [];
        return items.map((item) => domainInfo(item.Name, item.DomainId));
    }

    async listRecords(domain, { limit = 10, page = 1, key = "", record_type = "" } = {}) {
        const response = await this.client.DescribeRecordList({
            Domain: domain.domain,
            DomainId: Number(domain.domainId),
            Limit: Number(limit),
            Offset: (Number(page) - 1) * Number(limit),
            Keyword: key || undefined,
            RecordType: record_type || undefined,
        });
        const items = response?.RecordList || [];
        return recordList(
            items.map((item) => domainRecord({
                domain,
                rr: item.Name,
                record_id: item.RecordId,
                type: item.Type,
                value: item.Value,
                domain_type: this.type,
                line: item.Line,
                status: String(item.Status || "").toUpperCase(),
            })),
            response?.RecordCountInfo?.TotalCount || items.length,
            page,
            limit,
        );
    }

    async addRecord(record) {
        const type = normalizeRecordType(record.record_type || record.type);
        const response = await this.client.CreateRecord({
            Domain: record.domain.domain,
            Value: record.value,
            SubDomain: record.rr,
            RecordType: type,
            RecordLine: record.line || "默认",
        });
        return domainRecord({
            domain: record.domain,
            rr: record.rr,
            record_id: response?.RecordId,
            type,
            value: record.value,
            domain_type: this.type,
            line: record.line || "默认",
            status: "ENABLE",
        });
    }

    async updateRecord(record) {
        const type = normalizeRecordType(record.record_type || record.type);
        await this.client.ModifyRecord({
            Domain: record.domain.domain,
            RecordId: Number(record.record_id),
            Value: record.value,
            SubDomain: record.rr,
            RecordType: type,
            RecordLine: record.line || "默认",
        });
        return domainRecord({
            domain: record.domain,
            rr: record.rr,
            record_id: record.record_id,
            type,
            value: record.value,
            domain_type: this.type,
            line: record.line || "默认",
            status: record.status || "ENABLE",
        });
    }

    async deleteRecord(record) {
        await this.client.DeleteRecord({
            Domain: record.domain.domain,
            RecordId: Number(record.record_id),
        });
        return true;
    }

    async setRecordStatus(record, status) {
        await this.client.ModifyRecordStatus({
            Domain: record.domain.domain,
            RecordId: Number(record.record_id),
            Status: status,
        });
        return true;
    }
}

module.exports = TencentDnsProvider;
