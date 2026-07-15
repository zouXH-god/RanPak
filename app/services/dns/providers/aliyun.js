const Alidns = require("@alicloud/alidns20150109");
const Util = require("@alicloud/tea-util");
const {
    domainInfo,
    domainRecord,
    normalizeRecordType,
    recordList,
} = require("../common");

class AliDnsProvider {
    constructor(config) {
        this.type = "ali";
        this.client = new Alidns.default({
            accessKeyId: config.access_key_id,
            accessKeySecret: config.access_key_secret,
            endpoint: "alidns.cn-hangzhou.aliyuncs.com",
        });
    }

    runtime() {
        return new Util.RuntimeOptions({});
    }

    async listDomains() {
        const request = new Alidns.DescribeDomainsRequest({});
        const response = await this.client.describeDomainsWithOptions(request, this.runtime());
        const items = response?.body?.domains?.domain || [];
        return items.map((item) => domainInfo(item.domainName, item.domainId));
    }

    async listRecords(domain, { limit = 10, page = 1, key = "", record_type = "" } = {}) {
        const request = new Alidns.DescribeDomainRecordsRequest({
            domainName: domain.domain,
            pageSize: Number(limit),
            pageNumber: Number(page),
        });
        if (key) request.keyWord = key;
        if (record_type) request.type = record_type;

        const response = await this.client.describeDomainRecordsWithOptions(request, this.runtime());
        const body = response?.body || {};
        const items = body?.domainRecords?.record || [];
        return recordList(
            items.map((item) => domainRecord({
                domain,
                rr: item.RR || item.rr || "",
                record_id: item.recordId,
                type: item.type,
                value: item.value,
                domain_type: this.type,
                line: item.line,
                status: String(item.status || "").toUpperCase(),
            })),
            body.totalCount || items.length,
            body.pageNumber || page,
            body.pageSize || limit,
        );
    }

    async addRecord(record) {
        const request = new Alidns.AddDomainRecordRequest({
            domainName: record.domain.domain,
            RR: record.rr,
            type: normalizeRecordType(record.record_type || record.type),
            value: record.value,
            line: record.line || "default",
        });
        const response = await this.client.addDomainRecordWithOptions(request, this.runtime());
        return domainRecord({
            domain: record.domain,
            rr: record.rr,
            record_id: response?.body?.recordId,
            type: request.type,
            value: record.value,
            domain_type: this.type,
            line: request.line,
            status: "ENABLE",
        });
    }

    async updateRecord(record) {
        const request = new Alidns.UpdateDomainRecordRequest({
            recordId: record.record_id,
            RR: record.rr,
            type: normalizeRecordType(record.record_type || record.type),
            value: record.value,
        });
        const response = await this.client.updateDomainRecordWithOptions(request, this.runtime());
        return domainRecord({
            domain: record.domain,
            rr: record.rr,
            record_id: response?.body?.recordId || record.record_id,
            type: request.type,
            value: record.value,
            domain_type: this.type,
            line: record.line || "",
            status: record.status || "ENABLE",
        });
    }

    async deleteRecord(record) {
        const request = new Alidns.DeleteDomainRecordRequest({ recordId: record.record_id });
        await this.client.deleteDomainRecordWithOptions(request, this.runtime());
        return true;
    }

    async setRecordStatus(record, status) {
        const request = new Alidns.SetDomainRecordStatusRequest({
            recordId: record.record_id,
            status,
        });
        await this.client.setDomainRecordStatusWithOptions(request, this.runtime());
        return true;
    }
}

module.exports = AliDnsProvider;
