const { getDnsAccount, getDnsAccounts } = require("../config");
const { domainInfo, normalizeProviderType } = require("./common");
const AliDnsProvider = require("./providers/aliyun");
const TencentDnsProvider = require("./providers/tencent");
const CloudflareDnsProvider = require("./providers/cloudflare");
const GoDaddyDnsProvider = require("./providers/godaddy");

function getProvider(account) {
    const type = normalizeProviderType(account.type);
    if (type === "ali" || type === "aliyun") return new AliDnsProvider(account);
    if (type === "tencent" || type === "dnspod") return new TencentDnsProvider(account);
    if (type === "cloudflare") return new CloudflareDnsProvider(account);
    if (type === "godaddy") return new GoDaddyDnsProvider(account);
    throw new Error(`不支持的 DNS 服务商: ${account.type}`);
}

function providerByName(name) {
    return getProvider(getDnsAccount(name));
}

function buildDomain(query) {
    return domainInfo(query.domain, query.domainId);
}

module.exports = {
    getDnsAccounts,
    getDnsAccount,
    getProvider,
    providerByName,
    buildDomain,
};
