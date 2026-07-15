package services

import (
	"encoding/json"
)

type SyncItem struct {
	ID        string      `json:"id"`
	UpdatedAt int64       `json:"updatedAt"`
	DeletedAt int64       `json:"deletedAt,omitempty"`
	Data      interface{} `json:"-"`
	RawJSON   json.RawMessage
}

// MergeData 执行双向合并，返回合并后的 JSON 字符串和是否存在冲突
func MergeData(dataType, serverData, clientData string) (string, bool) {
	switch dataType {
	case "ai_config", "feature_visibility":
		return mergeObject(serverData, clientData)
	case "ssh_profiles", "ssh_history", "dns_accounts":
		return mergeList(serverData, clientData)
	default:
		return clientData, false
	}
}

// mergeObject 对象型合并：逐字段比较 updatedAt 取最新值
func mergeObject(serverJSON, clientJSON string) (string, bool) {
	var serverMap map[string]interface{}
	var clientMap map[string]interface{}

	if err := json.Unmarshal([]byte(serverJSON), &serverMap); err != nil {
		return clientJSON, false
	}
	if err := json.Unmarshal([]byte(clientJSON), &clientMap); err != nil {
		return serverJSON, false
	}

	hasConflict := false
	merged := make(map[string]interface{})

	// 复制 server 数据作为基础
	for k, v := range serverMap {
		merged[k] = v
	}

	// 客户端字段覆盖（如果 client 有 _updatedAt 字段比 server 新）
	serverUpdated := getTimestamp(serverMap, "_updatedAt")
	clientUpdated := getTimestamp(clientMap, "_updatedAt")

	if clientUpdated > serverUpdated {
		for k, v := range clientMap {
			merged[k] = v
		}
	} else if clientUpdated == serverUpdated {
		// 时间相同，以客户端为准（last-write-wins）
		for k, v := range clientMap {
			merged[k] = v
		}
	} else {
		hasConflict = true
		// server 更新，但也需要把 client 独有的字段合并过来
		for k, v := range clientMap {
			if _, exists := serverMap[k]; !exists {
				merged[k] = v
			}
		}
	}

	result, err := json.Marshal(merged)
	if err != nil {
		return clientJSON, false
	}
	return string(result), hasConflict
}

// mergeList 列表型合并：基于 item.id + item.updatedAt 逐项合并
func mergeList(serverJSON, clientJSON string) (string, bool) {
	var serverItems []map[string]interface{}
	var clientItems []map[string]interface{}

	if err := json.Unmarshal([]byte(serverJSON), &serverItems); err != nil {
		// 尝试解包 wrapper 格式 {"items": [...]}
		serverItems = unwrapItems(serverJSON)
	}
	if err := json.Unmarshal([]byte(clientJSON), &clientItems); err != nil {
		clientItems = unwrapItems(clientJSON)
	}

	if serverItems == nil {
		serverItems = []map[string]interface{}{}
	}
	if clientItems == nil {
		clientItems = []map[string]interface{}{}
	}

	serverIndex := indexByID(serverItems)
	clientIndex := indexByID(clientItems)

	hasConflict := false
	merged := make([]map[string]interface{}, 0)
	seen := make(map[string]bool)

	// 处理 server 端所有项
	for _, item := range serverItems {
		id := getStringField(item, "id")
		if id == "" {
			merged = append(merged, item)
			continue
		}
		seen[id] = true

		clientItem, existsInClient := clientIndex[id]
		if !existsInClient {
			// 仅 server 有：保留（可能是其他设备上传的）
			if !isDeleted(item) {
				merged = append(merged, item)
			}
			continue
		}

		// 两端都有：比较 updatedAt
		serverTime := getTimestamp(item, "updatedAt")
		clientTime := getTimestamp(clientItem, "updatedAt")

		if isDeleted(clientItem) && !isDeleted(item) {
			// client 删除了，传播删除
			continue
		}
		if isDeleted(item) && !isDeleted(clientItem) {
			// server 删除了但 client 恢复/更新了
			merged = append(merged, clientItem)
			hasConflict = true
			continue
		}

		if clientTime >= serverTime {
			merged = append(merged, clientItem)
		} else {
			merged = append(merged, item)
			hasConflict = true
		}
	}

	// 处理仅 client 有的项
	for _, item := range clientItems {
		id := getStringField(item, "id")
		if id == "" || seen[id] {
			continue
		}
		if _, existsInServer := serverIndex[id]; !existsInServer {
			if !isDeleted(item) {
				merged = append(merged, item)
			}
		}
	}

	result, err := json.Marshal(merged)
	if err != nil {
		return clientJSON, false
	}
	return string(result), hasConflict
}

func unwrapItems(jsonStr string) []map[string]interface{} {
	var wrapper struct {
		Items []map[string]interface{} `json:"items"`
	}
	if err := json.Unmarshal([]byte(jsonStr), &wrapper); err == nil && wrapper.Items != nil {
		return wrapper.Items
	}
	return nil
}

func indexByID(items []map[string]interface{}) map[string]map[string]interface{} {
	index := make(map[string]map[string]interface{})
	for _, item := range items {
		id := getStringField(item, "id")
		if id != "" {
			index[id] = item
		}
	}
	return index
}

func getStringField(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getTimestamp(m map[string]interface{}, key string) int64 {
	if v, ok := m[key]; ok {
		switch t := v.(type) {
		case float64:
			return int64(t)
		case int64:
			return t
		case json.Number:
			n, _ := t.Int64()
			return n
		}
	}
	return 0
}

func isDeleted(item map[string]interface{}) bool {
	if v, ok := item["deletedAt"]; ok {
		switch t := v.(type) {
		case float64:
			return t > 0
		case int64:
			return t > 0
		}
	}
	return false
}
