import {serverRequest} from "./requests";

export const record_type_list = [
    { value: '', label: '全部' },
    { value: 'A', label: 'A' },
    { value: 'AAAA', label: 'AAAA' },
    { value: 'CNAME', label: 'CNAME' },
    { value: 'MX', label: 'MX' },
    { value: 'TXT', label: 'TXT' },
    { value: 'NS', label: 'NS' },
]

//  获取账号列表
export async function getAccountList() {
    return await serverRequest("/dns/access", "GET")
}

// 添加或更新访问账号
export async function saveAccount(account: {
    name: string,
    type: string,
    access_key_id: string,
    access_key_secret: string,
}) {
    return await serverRequest("/dns/access", "POST", null, account)
}

// 获取指定账号的域名列表
export async function getDomainList(access: string) {
    return await serverRequest(`/dns/access/${access}/list`, "GET")
}

// 获取指定域名的解析记录
export async function getDomainRecords(
    access: string, domainId: string, domain: string, limit: number = 20, page: number = 1,
    key: string = "", record_type: string = ""
) {
    return await serverRequest(
        `/dns/access/${access}/records`, "GET",
        { domainId, domain, limit, page, key, record_type }
        )
}

// 添加解析记录
export async function addDomainRecord(
    access: string,
    record: {
        domainId: string,
        domain: string,
        rr: string,
        record_type: string,
        value: string,
        line: string,
    }){
    return await serverRequest(
        `/dns/access/${access}/record`, "POST",
        null,
        record
    )
}

// 修改解析记录
export async function updateDomainRecord(
    access: string,
    record: {
        record_id: string,
        domainId: string,
        domain: string,
        rr: string,
        record_type: string,
        value: string,
        line: string,
    }){
    return await serverRequest(
        `/dns/access/${access}/record`, "PUT",
        null,
        record
    )
}

// 删除解析记录
export async function deleteDomainRecord(
    access: string,
    record: {
        record_id: string,
        domainId: string,
        domain: string,
    }){
    return await serverRequest(
        `/dns/access/${access}/record`, "DELETE",
        record
    )
}

// 修改解析状态
export async function toggleDomainRecordStatus(
    access: string,
    record: {
        record_id: string,
        domainId: string,
        domain: string,
        status: string,
    }){
    return await serverRequest(
        `/dns/access/${access}/record/status`, "PUT",
        null,
        record
    )
}
